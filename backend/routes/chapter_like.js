/**
 * 章节点赞/点踩 API
 *
 * - POST /api/chapter-like/:chapterId        body: { is_like: 1|0 }
 * - GET  /api/chapter-like/:chapterId/summary
 *
 * 说明：
 * - created_at 作为“最后一次动作时间”，与现有 like 系统保持一致：UPDATE 时同步 created_at = NOW()
 * - 支持取消：重复点击同一状态会取消（删除该条记录）
 */

const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

const router = express.Router();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

function getBearerToken(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  const parts = String(authHeader).split(' ');
  if (parts.length !== 2) return null;
  if (parts[0] !== 'Bearer') return null;
  return parts[1] || null;
}

function tryGetUserId(req) {
  const token = getBearerToken(req);
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    // 兼容不同登录实现的 payload 字段：有的用 { userId }, 有的用 { id }
    const rawId =
      decoded && (Object.prototype.hasOwnProperty.call(decoded, 'userId') ? decoded.userId : decoded.id);
    return rawId ? Number(rawId) : null;
  } catch (_e) {
    return null;
  }
}

async function getChapterLikeSummary(connection, chapterId, userIdOrNull) {
  const [aggRows] = await connection.execute(
    `
      SELECT
        COALESCE(SUM(CASE WHEN is_like = 1 THEN 1 ELSE 0 END), 0) AS like_count,
        COALESCE(SUM(CASE WHEN is_like = 0 THEN 1 ELSE 0 END), 0) AS dislike_count
      FROM chapter_like
      WHERE chapter_id = ?
    `,
    [chapterId]
  );

  let userStatus = null;
  if (userIdOrNull) {
    const [userRows] = await connection.execute(
      `SELECT is_like FROM chapter_like WHERE chapter_id = ? AND user_id = ? LIMIT 1`,
      [chapterId, userIdOrNull]
    );
    if (userRows.length > 0) userStatus = userRows[0].is_like;
  }

  return {
    like_count: aggRows[0].like_count || 0,
    dislike_count: aggRows[0].dislike_count || 0,
    user_status: userStatus
  };
}

/**
 * GET /api/chapter-like/:chapterId/summary
 * 获取章节当前聚合（like/dislike）+ 当前用户状态（若已登录）
 */
router.get('/:chapterId/summary', async (req, res) => {
  let connection;
  try {
    const chapterId = Number(req.params.chapterId);
    if (!Number.isFinite(chapterId) || !Number.isInteger(chapterId) || chapterId <= 0) {
      return res.status(400).json({ success: false, message: '无效的 chapterId' });
    }

    const userId = tryGetUserId(req); // 可选：未登录也能看总计数
    connection = await mysql.createConnection(dbConfig);

    // 可选：校验章节存在（避免 join 聚合误导）
    const [chapters] = await connection.execute('SELECT id FROM chapter WHERE id = ? LIMIT 1', [chapterId]);
    if (chapters.length === 0) {
      return res.status(404).json({ success: false, message: '章节不存在' });
    }

    const summary = await getChapterLikeSummary(connection, chapterId, userId);
    return res.json({ success: true, data: summary });
  } catch (error) {
    console.error('获取章节点赞/点踩摘要失败:', error);
    return res.status(500).json({ success: false, message: '获取章节点赞/点踩摘要失败', error: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * POST /api/chapter-like/:chapterId
 * body: { is_like: 1|0 }
 */
router.post('/:chapterId', async (req, res) => {
  let connection;
  try {
    const chapterId = Number(req.params.chapterId);
    if (!Number.isFinite(chapterId) || !Number.isInteger(chapterId) || chapterId <= 0) {
      return res.status(400).json({ success: false, message: '无效的 chapterId' });
    }

    const userId = tryGetUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '请先登录' });
    }

    const isLikeRaw = req.body && Object.prototype.hasOwnProperty.call(req.body, 'is_like') ? req.body.is_like : undefined;
    const isLike = Number(isLikeRaw);
    if (!(isLike === 0 || isLike === 1)) {
      return res.status(400).json({ success: false, message: '无效的 is_like（必须是 1 或 0）' });
    }

    connection = await mysql.createConnection(dbConfig);
    await connection.beginTransaction();

    // 校验章节存在
    const [chapters] = await connection.execute('SELECT id FROM chapter WHERE id = ? LIMIT 1', [chapterId]);
    if (chapters.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: '章节不存在' });
    }

    const [rows] = await connection.execute(
      'SELECT id, is_like FROM chapter_like WHERE chapter_id = ? AND user_id = ? FOR UPDATE',
      [chapterId, userId]
    );

    if (rows.length > 0) {
      const existing = rows[0];
      if (Number(existing.is_like) === isLike) {
        // 同状态再次点击：取消（删除该条记录）
        await connection.execute('DELETE FROM chapter_like WHERE id = ?', [existing.id]);
      } else {
        // 状态不同：更新 is_like，并刷新 created_at=NOW()（作为最后动作时间）
        await connection.execute(
          'UPDATE chapter_like SET is_like = ?, created_at = NOW() WHERE id = ?',
          [isLike, existing.id]
        );
      }
    } else {
      // 无记录：插入
      await connection.execute(
        'INSERT INTO chapter_like (chapter_id, user_id, is_like, created_at) VALUES (?, ?, ?, NOW())',
        [chapterId, userId, isLike]
      );
    }

    const summary = await getChapterLikeSummary(connection, chapterId, userId);
    await connection.commit();

    return res.json({ success: true, data: summary });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_e) {
        // ignore
      }
    }
    console.error('更新章节点赞/点踩失败:', error);
    return res.status(500).json({ success: false, message: '更新章节点赞/点踩失败', error: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

module.exports = router;


