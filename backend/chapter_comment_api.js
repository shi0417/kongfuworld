// 章节评论API实现
const express = require('express');
const mysql = require('mysql2/promise');

// 获取章节评论
app.get('/api/chapter/:chapterId/comments', async (req, res) => {
  const { chapterId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld'
    });

    // 获取评论列表
    const [comments] = await connection.execute(`
      SELECT 
        c.id,
        c.content,
        c.created_at,
        c.likes,
        c.dislikes,
        c.parent_comment_id,
        u.username,
        u.avatar,
        u.is_vip
      FROM comment c
      JOIN user u ON c.user_id = u.id
      WHERE c.target_type = 'chapter' AND c.target_id = ?
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `, [chapterId, parseInt(limit), parseInt(offset)]);

    // 获取评论统计
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_comments,
        SUM(CASE WHEN likes > 0 THEN 1 ELSE 0 END) as liked_comments,
        SUM(likes) as total_likes
      FROM comment 
      WHERE target_type = 'chapter' AND target_id = ?
    `, [chapterId]);

    const stat = stats[0];
    const likeRate = stat.total_comments > 0 ? 
      Math.round((stat.liked_comments / stat.total_comments) * 100) : 0;

    await connection.end();

    res.json({
      success: true,
      data: {
        comments: comments,
        total: stat.total_comments,
        like_rate: likeRate,
        total_likes: stat.total_likes
      }
    });

  } catch (error) {
    console.error('获取章节评论失败:', error);
    res.status(500).json({ message: '获取章节评论失败' });
  }
});

// 提交章节评论
app.post('/api/chapter/:chapterId/comment', authenticateToken, async (req, res) => {
  const { chapterId } = req.params;
  const { content } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: '请先登录' });
  }

  if (!content || content.trim().length < 10) {
    return res.status(400).json({ message: '评论内容至少需要10个字符' });
  }

  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld'
    });

    const [result] = await connection.execute(`
      INSERT INTO comment (user_id, target_type, target_id, content, created_at)
      VALUES (?, 'chapter', ?, ?, NOW())
    `, [userId, chapterId, content]);

    await connection.end();

    res.json({
      success: true,
      message: '评论提交成功',
      data: {
        comment_id: result.insertId
      }
    });

  } catch (error) {
    console.error('提交章节评论失败:', error);
    res.status(500).json({ message: '提交章节评论失败' });
  }
});

// 点赞章节评论
app.post('/api/comment/:commentId/like', authenticateToken, async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: '请先登录' });
  }

  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld'
    });

    // 检查是否已经点赞
    const [existing] = await connection.execute(`
      SELECT id FROM comment_like 
      WHERE comment_id = ? AND user_id = ?
    `, [commentId, userId]);

    if (existing.length > 0) {
      await connection.end();
      return res.status(400).json({ message: '已经点赞过了' });
    }

    // 插入点赞记录
    await connection.execute(`
      INSERT INTO comment_like (comment_id, user_id, created_at)
      VALUES (?, ?, NOW())
    `, [commentId, userId]);

    // 更新评论点赞数
    await connection.execute(`
      UPDATE comment SET likes = likes + 1 WHERE id = ?
    `, [commentId]);

    await connection.end();

    res.json({
      success: true,
      message: '点赞成功'
    });

  } catch (error) {
    console.error('点赞失败:', error);
    res.status(500).json({ message: '点赞失败' });
  }
});

console.log('✅ 章节评论API已实现！');
