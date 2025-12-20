/**
 * 公告评论点赞/点踩服务
 * 行为对齐章节评论 likeDislikeService.updateCommentLikeStatus：
 * - 单表 newscomment_like + is_like (1=like,0=dislike)
 * - UNIQUE(newscomment_id, user_id)
 * - 同态再次点击不取消（保持现状）
 * - 允许 like<->dislike 切换，并回写 newscomment.likes/dislikes
 */

class NewsLikeDislikeService {
  constructor(promisePool) {
    this.pool = promisePool;
  }

  async updateNewsCommentLikeStatus(newsCommentId, userId, isLike) {
    const conn = await this.pool.getConnection();
    await conn.beginTransaction();

    try {
      // 1) 查询现有记录并锁行（避免并发）
      const [rows] = await conn.execute(
        'SELECT id, is_like FROM newscomment_like WHERE newscomment_id = ? AND user_id = ? FOR UPDATE',
        [newsCommentId, userId]
      );

      if (rows.length > 0) {
        const existing = rows[0];
        // 同态不变（不可回到中立），仅在状态不同才更新
        if (Number(existing.is_like) !== Number(isLike)) {
          await conn.execute(
            'UPDATE newscomment_like SET is_like = ?, created_at = NOW() WHERE id = ?',
            [isLike, existing.id]
          );
        }
      } else {
        // 2) 无记录则插入
        await conn.execute(
          'INSERT INTO newscomment_like (newscomment_id, user_id, is_like, created_at) VALUES (?, ?, ?, NOW())',
          [newsCommentId, userId, isLike]
        );
      }

      // 3) 聚合统计 likes/dislikes
      const [statRows] = await conn.execute(
        `SELECT 
           SUM(CASE WHEN is_like = 1 THEN 1 ELSE 0 END) AS like_count,
           SUM(CASE WHEN is_like = 0 THEN 1 ELSE 0 END) AS dislike_count
         FROM newscomment_like
         WHERE newscomment_id = ?`,
        [newsCommentId]
      );
      const likes = statRows[0]?.like_count || 0;
      const dislikes = statRows[0]?.dislike_count || 0;

      // 4) 回写到 newscomment
      await conn.execute(
        'UPDATE newscomment SET likes = ?, dislikes = ? WHERE id = ?',
        [likes, dislikes, newsCommentId]
      );

      await conn.commit();
      return { likes, dislikes };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }
}

module.exports = NewsLikeDislikeService;


