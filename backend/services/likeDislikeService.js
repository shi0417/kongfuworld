/**
 * 点赞/点踩服务
 * 统一管理 review 和 comment 的点赞/点踩逻辑
 * 使用单表 + is_like 字段模式（参考 paragraph_comment_like 的实现）
 */

const mysql = require('mysql2/promise');

class LikeDislikeService {
  constructor(dbPoolOrConfig) {
    // 如果传入的是 pool，直接使用；否则创建新的 connection
    if (dbPoolOrConfig && typeof dbPoolOrConfig.promise === 'function') {
      // 这是一个 pool
      this.dbPool = dbPoolOrConfig;
    } else {
      // 这是配置对象，创建新的 pool
      this.dbConfig = dbPoolOrConfig;
    }
  }

  /**
   * 从 pool 获取连接（用于事务）
   */
  async getConnection() {
    if (this.dbPool) {
      return await this.dbPool.promise().getConnection();
    } else {
      return await mysql.createConnection(this.dbConfig);
    }
  }

  /**
   * 更新评价的点赞/点踩状态
   * @param {number} reviewId - 评价ID
   * @param {number} userId - 用户ID
   * @param {number} isLike - 1=点赞，0=点踩
   * @returns {Promise<{likes: number, dislikes: number}>} 更新后的点赞/点踩数
   */
  async updateReviewLikeStatus(reviewId, userId, isLike) {
    const connection = await this.getConnection();
    // 开启事务
    await connection.beginTransaction();

    try {
      // 1. 查询现有记录（并锁住这一行，防止并发更新）
      const [rows] = await connection.execute(
        'SELECT id, is_like FROM review_like WHERE review_id = ? AND user_id = ? FOR UPDATE',
        [reviewId, userId]
      );

      if (rows.length > 0) {
        const existing = rows[0];
        if (existing.is_like !== isLike) {
          // 2.a 状态不同，更新 is_like
          await connection.execute(
            'UPDATE review_like SET is_like = ?, created_at = NOW() WHERE id = ?',
            [isLike, existing.id]
          );
        }
        // 2.b 状态相同，不需要更新明细表
      } else {
        // 3. 没有记录，插入一条
        await connection.execute(
          'INSERT INTO review_like (review_id, user_id, is_like, created_at) VALUES (?, ?, ?, NOW())',
          [reviewId, userId, isLike]
        );
      }

      // 4. 聚合计算新的 likes / dislikes
      const [statRows] = await connection.execute(
        `SELECT 
           SUM(CASE WHEN is_like = 1 THEN 1 ELSE 0 END) AS like_count,
           SUM(CASE WHEN is_like = 0 THEN 1 ELSE 0 END) AS dislike_count
         FROM review_like
         WHERE review_id = ?`,
        [reviewId]
      );
      const likeCount = statRows[0].like_count || 0;
      const dislikeCount = statRows[0].dislike_count || 0;

      // 5. 回写到 review 表
      await connection.execute(
        'UPDATE review SET likes = ?, dislikes = ? WHERE id = ?',
        [likeCount, dislikeCount, reviewId]
      );

      // 6. 提交事务
      await connection.commit();

      // 返回新计数
      return { likes: likeCount, dislikes: dislikeCount };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release(); // 释放连接回 pool
    }
  }

  /**
   * 更新章节评论的点赞/点踩状态
   * @param {number} commentId - 评论ID
   * @param {number} userId - 用户ID
   * @param {number} isLike - 1=点赞，0=点踩
   * @returns {Promise<{likes: number, dislikes: number}>} 更新后的点赞/点踩数
   */
  async updateCommentLikeStatus(commentId, userId, isLike) {
    const connection = await this.getConnection();
    // 开启事务
    await connection.beginTransaction();

    try {
      // 1. 查询现有记录（并锁住这一行，防止并发更新）
      const [rows] = await connection.execute(
        'SELECT id, is_like FROM comment_like WHERE comment_id = ? AND user_id = ? FOR UPDATE',
        [commentId, userId]
      );

      if (rows.length > 0) {
        const existing = rows[0];
        if (existing.is_like !== isLike) {
          // 2.a 状态不同，更新 is_like
          await connection.execute(
            'UPDATE comment_like SET is_like = ?, created_at = NOW() WHERE id = ?',
            [isLike, existing.id]
          );
        }
        // 2.b 状态相同，不需要更新明细表
      } else {
        // 3. 没有记录，插入一条
        await connection.execute(
          'INSERT INTO comment_like (comment_id, user_id, is_like, created_at) VALUES (?, ?, ?, NOW())',
          [commentId, userId, isLike]
        );
      }

      // 4. 聚合计算新的 likes / dislikes
      const [statRows] = await connection.execute(
        `SELECT 
           SUM(CASE WHEN is_like = 1 THEN 1 ELSE 0 END) AS like_count,
           SUM(CASE WHEN is_like = 0 THEN 1 ELSE 0 END) AS dislike_count
         FROM comment_like
         WHERE comment_id = ?`,
        [commentId]
      );
      const likeCount = statRows[0].like_count || 0;
      const dislikeCount = statRows[0].dislike_count || 0;

      // 5. 回写到 comment 表
      await connection.execute(
        'UPDATE comment SET likes = ?, dislikes = ? WHERE id = ?',
        [likeCount, dislikeCount, commentId]
      );

      // 6. 提交事务
      await connection.commit();

      // 返回新计数
      return { likes: likeCount, dislikes: dislikeCount };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release(); // 释放连接回 pool
    }
  }
}

module.exports = LikeDislikeService;

