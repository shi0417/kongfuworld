const express = require('express');
const jwt = require('jsonwebtoken');
const NewsLikeDislikeService = require('../services/newsLikeDislikeService');
const Db = require('../db');

/**
 * Public news router
 * 挂载方式（按需求）：
 *   app.use('/api', createPublicNewsRouter());
 */
function createPublicNewsRouter() {
  const router = express.Router();
  const newsLikeDislikeService = new NewsLikeDislikeService(Db.getPool());

  // 复用 server.js 的鉴权逻辑（JWT secret 与 payload 字段兼容 userId/id）
  const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Please login first' });
    jwt.verify(token, 'your-secret-key', (err, user) => {
      if (err) return res.status(403).json({ success: false, message: 'Token invalid or expired' });
      req.user = user;
      next();
    });
  };

  const getUserId = (req) => req.user?.id ?? req.user?.userId ?? null;

  // 0) GET /api/news （公告列表：General Announcements）
  // 支持 target_audience 查询参数：reader=读者端，writer=作者端
  // 默认只返回读者端公告（不传 target_audience 或传 reader）
  router.get('/news', async (req, res) => {
    try {
      const { target_audience } = req.query;
      let sql = `SELECT id, title, content, content_format, created_at, updated_at, link_url, display_order, target_audience
         FROM homepage_announcements
         WHERE is_active = 1
           AND (start_date IS NULL OR start_date <= NOW())
           AND (end_date IS NULL OR end_date >= NOW())`;
      const params = [];
      
      // 默认只返回读者端公告，除非明确指定 writer
      if (target_audience === 'writer') {
        sql += ' AND target_audience = ?';
        params.push('writer');
      } else {
        // 不传参数或传 reader，都只返回读者端
        sql += ' AND target_audience = ?';
        params.push('reader');
      }
      
      sql += ' ORDER BY display_order ASC, created_at DESC';
      
      const [rows] = await Db.query(sql, params, { tag: 'publicNews.list', idempotent: true });

      return res.json({ success: true, data: { items: rows || [] } });
    } catch (e) {
      console.error('[publicNews] GET /news failed:', { code: e && e.code, fatal: !!(e && e.fatal) });
      return res.status(500).json({ success: false, message: 'Failed to load news list' });
    }
  });

  // 1) GET /api/news/:id
  router.get('/news/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid id' });

    try {
      const [rows] = await Db.query(
        `SELECT id, title, content, content_format, created_at, updated_at, link_url, target_audience
         FROM homepage_announcements
         WHERE id = ?
           AND is_active = 1
           AND (start_date IS NULL OR start_date <= NOW())
           AND (end_date IS NULL OR end_date >= NOW())
         LIMIT 1`,
        [id],
        { tag: 'publicNews.detail', idempotent: true }
      );

      if (!rows || rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Not found' });
      }

      return res.json({ success: true, data: { item: rows[0] } });
    } catch (e) {
      console.error('[publicNews] GET /news/:id failed:', { code: e && e.code, fatal: !!(e && e.fatal) });
      return res.status(500).json({ success: false, message: 'Failed to load news' });
    }
  });

  // 2) GET /api/news/:id/comments?page=1&limit=10
  router.get('/news/:id/comments', async (req, res) => {
    const id = Number(req.params.id);
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimitRaw = Number.isFinite(limit) && limit > 0 ? limit : 10;
    const safeLimit = Math.min(100, Math.floor(safeLimitRaw));
    const offset = (safePage - 1) * safeLimit;
    const safeOffset = Math.max(0, Math.floor(offset));

    if (Number.isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid id' });

    try {
      // NOTE: 某些 MySQL 环境对 prepared statement 的 LIMIT/OFFSET 占位符不兼容，
      // 会抛出 "Incorrect arguments to mysqld_stmt_execute"。
      // 这里将 LIMIT/OFFSET 作为已校验整数直接拼接，避免该错误。
      const [rows] = await Db.query(
        `SELECT 
           nc.id,
           nc.content,
           nc.created_at,
           nc.likes,
           nc.dislikes,
           nc.parent_comment_id,
           nc.user_id,
           u.username,
           u.avatar,
           u.is_vip
         FROM newscomment nc
         JOIN user u ON nc.user_id = u.id
         WHERE nc.homepage_announcements_id = ?
         ORDER BY nc.created_at DESC
         LIMIT ${safeLimit} OFFSET ${safeOffset}`,
        [id],
        { tag: 'publicNews.comments', idempotent: true }
      );

      const [countRows] = await Db.query(
        'SELECT COUNT(*) as total FROM newscomment WHERE homepage_announcements_id = ?',
        [id],
        { tag: 'publicNews.comments.count', idempotent: true }
      );
      const total = countRows?.[0]?.total ? Number(countRows[0].total) : 0;
      const totalPages = Math.ceil(total / safeLimit);

      return res.json({
        success: true,
        data: { comments: rows, total, page: safePage, limit: safeLimit, totalPages }
      });
    } catch (e) {
      console.error('[publicNews] GET /news/:id/comments failed:', { code: e && e.code, fatal: !!(e && e.fatal) });
      return res.status(500).json({ success: false, message: 'Failed to load comments' });
    }
  });

  // 3) POST /api/news/:id/comment
  router.post('/news/:id/comment', authenticateToken, async (req, res) => {
    const id = Number(req.params.id);
    const userId = getUserId(req);
    const content = req.body?.content;

    if (!userId) return res.status(401).json({ success: false, message: 'Please login first' });
    if (Number.isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid id' });
    if (!content || String(content).trim().length < 10) {
      return res.status(400).json({ success: false, message: '评论内容至少需要10个字符' });
    }

    try {
      const [result] = await Db.query(
        `INSERT INTO newscomment
           (user_id, target_id, homepage_announcements_id, parent_comment_id, content, created_at, likes, dislikes)
         VALUES
           (?, ?, ?, NULL, ?, NOW(), 0, 0)`,
        [userId, id, id, String(content).trim()],
        { tag: 'publicNews.comment.create', idempotent: false }
      );

      const insertId = result.insertId;
      const [rows] = await Db.query(
        `SELECT 
           nc.id, nc.content, nc.created_at, nc.likes, nc.dislikes, nc.parent_comment_id, nc.user_id,
           u.username, u.avatar, u.is_vip
         FROM newscomment nc
         JOIN user u ON nc.user_id = u.id
         WHERE nc.id = ?
         LIMIT 1`,
        [insertId],
        { tag: 'publicNews.comment.fetch', idempotent: true }
      );

      return res.json({
        success: true,
        message: '评论提交成功',
        data: { comment: rows?.[0] || { id: insertId } }
      });
    } catch (e) {
      console.error('[publicNews] POST /news/:id/comment failed:', { code: e && e.code, fatal: !!(e && e.fatal) });
      return res.status(500).json({ success: false, message: '提交评论失败' });
    }
  });

  // 4) POST /api/newscomment/:commentId/reply
  router.post('/newscomment/:commentId/reply', authenticateToken, async (req, res) => {
    const commentId = Number(req.params.commentId);
    const userId = getUserId(req);
    const content = req.body?.content;

    if (!userId) return res.status(401).json({ success: false, message: 'Please login first' });
    if (Number.isNaN(commentId)) return res.status(400).json({ success: false, message: 'Invalid commentId' });
    if (!content || String(content).trim().length < 10) {
      return res.status(400).json({ success: false, message: '回复内容至少需要10个字符' });
    }

    try {
      const [parentRows] = await Db.query(
        'SELECT id, homepage_announcements_id FROM newscomment WHERE id = ? LIMIT 1',
        [commentId],
        { tag: 'publicNews.reply.parent', idempotent: true }
      );
      if (!parentRows || parentRows.length === 0) {
        return res.status(404).json({ success: false, message: 'Not found' });
      }
      const newsId = Number(parentRows[0].homepage_announcements_id);

      const [result] = await Db.query(
        `INSERT INTO newscomment
           (user_id, target_id, homepage_announcements_id, parent_comment_id, content, created_at, likes, dislikes)
         VALUES
           (?, ?, ?, ?, ?, NOW(), 0, 0)`,
        [userId, newsId, newsId, commentId, String(content).trim()],
        { tag: 'publicNews.reply.create', idempotent: false }
      );

      return res.json({
        success: true,
        message: '回复成功',
        data: { reply_id: result.insertId }
      });
    } catch (e) {
      console.error('[publicNews] POST /newscomment/:commentId/reply failed:', { code: e && e.code, fatal: !!(e && e.fatal) });
      return res.status(500).json({ success: false, message: '回复失败' });
    }
  });

  // 5) GET /api/newscomment/:commentId/replies?page=1&limit=50
  router.get('/newscomment/:commentId/replies', async (req, res) => {
    const commentId = Number(req.params.commentId);
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 50);
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimitRaw = Number.isFinite(limit) && limit > 0 ? limit : 50;
    const safeLimit = Math.min(200, Math.floor(safeLimitRaw));
    const offset = (safePage - 1) * safeLimit;
    const safeOffset = Math.max(0, Math.floor(offset));

    if (Number.isNaN(commentId)) return res.status(400).json({ success: false, message: 'Invalid commentId' });

    try {
      const [rows] = await Db.query(
        `SELECT 
           nc.id,
           nc.content,
           nc.created_at,
           nc.likes,
           nc.dislikes,
           nc.parent_comment_id,
           nc.user_id,
           u.username,
           u.avatar,
           u.is_vip
         FROM newscomment nc
         JOIN user u ON nc.user_id = u.id
         WHERE nc.parent_comment_id = ?
         ORDER BY nc.created_at ASC
         LIMIT ${safeLimit} OFFSET ${safeOffset}`,
        [commentId],
        { tag: 'publicNews.replies', idempotent: true }
      );

      return res.json({ success: true, data: rows });
    } catch (e) {
      console.error('[publicNews] GET /newscomment/:commentId/replies failed:', { code: e && e.code, fatal: !!(e && e.fatal) });
      return res.status(500).json({ success: false, message: '获取回复失败' });
    }
  });

  // 6) PUT /api/newscomment/:commentId
  router.put('/newscomment/:commentId', authenticateToken, async (req, res) => {
    const commentId = Number(req.params.commentId);
    const userId = getUserId(req);
    const content = req.body?.content;

    if (!userId) return res.status(401).json({ success: false, message: 'Please login first' });
    if (Number.isNaN(commentId)) return res.status(400).json({ success: false, message: 'Invalid commentId' });
    if (!content || String(content).trim().length < 10) {
      return res.status(400).json({ success: false, message: '评论内容至少需要10个字符' });
    }

    try {
      const [rows] = await Db.query(
        'SELECT user_id FROM newscomment WHERE id = ? LIMIT 1',
        [commentId],
        { tag: 'publicNews.comment.owner', idempotent: true }
      );
      if (!rows || rows.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
      if (Number(rows[0].user_id) !== Number(userId)) {
        return res.status(403).json({ success: false, message: '无权修改此评论' });
      }

      await Db.query('UPDATE newscomment SET content = ? WHERE id = ?', [String(content).trim(), commentId], { tag: 'publicNews.comment.update', idempotent: false });
      return res.json({ success: true, message: '评论更新成功' });
    } catch (e) {
      console.error('[publicNews] PUT /newscomment/:commentId failed:', { code: e && e.code, fatal: !!(e && e.fatal) });
      return res.status(500).json({ success: false, message: '更新评论失败' });
    }
  });

  // 7) POST /api/newscomment/:commentId/like
  router.post('/newscomment/:commentId/like', authenticateToken, async (req, res) => {
    const commentId = Number(req.params.commentId);
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Please login first' });
    if (Number.isNaN(commentId)) return res.status(400).json({ success: false, message: 'Invalid commentId' });

    try {
      const result = await newsLikeDislikeService.updateNewsCommentLikeStatus(commentId, userId, 1);
      return res.json({
        success: true,
        message: '点赞成功',
        action: 'liked',
        data: { likes: result.likes, dislikes: result.dislikes }
      });
    } catch (e) {
      console.error('[publicNews] POST /newscomment/:commentId/like failed:', { code: e && e.code, fatal: !!(e && e.fatal) });
      return res.status(500).json({ success: false, message: '点赞失败' });
    }
  });

  // 8) POST /api/newscomment/:commentId/dislike
  router.post('/newscomment/:commentId/dislike', authenticateToken, async (req, res) => {
    const commentId = Number(req.params.commentId);
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Please login first' });
    if (Number.isNaN(commentId)) return res.status(400).json({ success: false, message: 'Invalid commentId' });

    try {
      const result = await newsLikeDislikeService.updateNewsCommentLikeStatus(commentId, userId, 0);
      return res.json({
        success: true,
        message: '点踩成功',
        action: 'disliked',
        data: { likes: result.likes, dislikes: result.dislikes }
      });
    } catch (e) {
      console.error('[publicNews] POST /newscomment/:commentId/dislike failed:', { code: e && e.code, fatal: !!(e && e.fatal) });
      return res.status(500).json({ success: false, message: '点踩失败' });
    }
  });

  return router;
}

module.exports = createPublicNewsRouter;


