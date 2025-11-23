// 重新设计的点赞逻辑 - 简化版本
const mysql = require('mysql2/promise');

// 1. 主评论点赞API - 简化版本
app.post('/api/review/:reviewId/like', authenticateToken, async (req, res) => {
  const { reviewId } = req.params;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: '请先登录' });
  }

  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld'
    });

    // 检查是否已经点赞
    const [existingLike] = await conn.execute(
      'SELECT id FROM review_like WHERE review_id = ? AND user_id = ?',
      [reviewId, userId]
    );

    // 如果已经点赞，直接返回
    if (existingLike.length > 0) {
      await conn.end();
      return res.json({
        success: true,
        message: '已经点赞过了',
        action: 'already_liked'
      });
    }

    // 检查是否有点踩记录（互斥逻辑）
    const [existingDislike] = await conn.execute(
      'SELECT id FROM review_dislike WHERE review_id = ? AND user_id = ?',
      [reviewId, userId]
    );

    // 如果有点踩记录，先删除
    if (existingDislike.length > 0) {
      await conn.execute(
        'DELETE FROM review_dislike WHERE review_id = ? AND user_id = ?',
        [reviewId, userId]
      );
      await conn.execute(
        'UPDATE review SET dislikes = dislikes - 1 WHERE id = ?',
        [reviewId]
      );
    }

    // 添加点赞记录
    await conn.execute(
      'INSERT INTO review_like (review_id, user_id, created_at) VALUES (?, ?, NOW())',
      [reviewId, userId]
    );
    await conn.execute(
      'UPDATE review SET likes = likes + 1 WHERE id = ?',
      [reviewId]
    );

    await conn.end();

    res.json({
      success: true,
      message: '点赞成功',
      action: 'liked'
    });

  } catch (error) {
    console.error('点赞失败:', error);
    res.status(500).json({ message: '点赞失败' });
  }
});

// 2. 主评论点踩API - 简化版本
app.post('/api/review/:reviewId/dislike', authenticateToken, async (req, res) => {
  const { reviewId } = req.params;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: '请先登录' });
  }

  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld'
    });

    // 检查是否已经点踩
    const [existingDislike] = await conn.execute(
      'SELECT id FROM review_dislike WHERE review_id = ? AND user_id = ?',
      [reviewId, userId]
    );

    // 如果已经点踩，直接返回
    if (existingDislike.length > 0) {
      await conn.end();
      return res.json({
        success: true,
        message: '已经点踩过了',
        action: 'already_disliked'
      });
    }

    // 检查是否有点赞记录（互斥逻辑）
    const [existingLike] = await conn.execute(
      'SELECT id FROM review_like WHERE review_id = ? AND user_id = ?',
      [reviewId, userId]
    );

    // 如果有点赞记录，先删除
    if (existingLike.length > 0) {
      await conn.execute(
        'DELETE FROM review_like WHERE review_id = ? AND user_id = ?',
        [reviewId, userId]
      );
      await conn.execute(
        'UPDATE review SET likes = likes - 1 WHERE id = ?',
        [reviewId]
      );
    }

    // 添加点踩记录
    await conn.execute(
      'INSERT INTO review_dislike (review_id, user_id, created_at) VALUES (?, ?, NOW())',
      [reviewId, userId]
    );
    await conn.execute(
      'UPDATE review SET dislikes = dislikes + 1 WHERE id = ?',
      [reviewId]
    );

    await conn.end();

    res.json({
      success: true,
      message: '点踩成功',
      action: 'disliked'
    });

  } catch (error) {
    console.error('点踩失败:', error);
    res.status(500).json({ message: '点踩失败' });
  }
});

// 3. 评论回复点赞API - 简化版本
app.post('/api/comment/:commentId/like', authenticateToken, async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: '请先登录' });
  }

  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld'
    });

    // 检查是否已经点赞
    const [existingLike] = await conn.execute(
      'SELECT id FROM comment_like WHERE comment_id = ? AND user_id = ?',
      [commentId, userId]
    );

    // 如果已经点赞，直接返回
    if (existingLike.length > 0) {
      await conn.end();
      return res.json({
        success: true,
        message: '已经点赞过了',
        action: 'already_liked'
      });
    }

    // 检查是否有点踩记录（互斥逻辑）
    const [existingDislike] = await conn.execute(
      'SELECT id FROM comment_dislike WHERE comment_id = ? AND user_id = ?',
      [commentId, userId]
    );

    // 如果有点踩记录，先删除
    if (existingDislike.length > 0) {
      await conn.execute(
        'DELETE FROM comment_dislike WHERE comment_id = ? AND user_id = ?',
        [commentId, userId]
      );
      await conn.execute(
        'UPDATE comment SET dislikes = dislikes - 1 WHERE id = ?',
        [commentId]
      );
    }

    // 添加点赞记录
    await conn.execute(
      'INSERT INTO comment_like (comment_id, user_id, created_at) VALUES (?, ?, NOW())',
      [commentId, userId]
    );
    await conn.execute(
      'UPDATE comment SET likes = likes + 1 WHERE id = ?',
      [commentId]
    );

    await conn.end();

    res.json({
      success: true,
      message: '点赞成功',
      action: 'liked'
    });

  } catch (error) {
    console.error('点赞失败:', error);
    res.status(500).json({ message: '点赞失败' });
  }
});

// 4. 评论回复点踩API - 简化版本
app.post('/api/comment/:commentId/dislike', authenticateToken, async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: '请先登录' });
  }

  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld'
    });

    // 检查是否已经点踩
    const [existingDislike] = await conn.execute(
      'SELECT id FROM comment_dislike WHERE comment_id = ? AND user_id = ?',
      [commentId, userId]
    );

    // 如果已经点踩，直接返回
    if (existingDislike.length > 0) {
      await conn.end();
      return res.json({
        success: true,
        message: '已经点踩过了',
        action: 'already_disliked'
      });
    }

    // 检查是否有点赞记录（互斥逻辑）
    const [existingLike] = await conn.execute(
      'SELECT id FROM comment_like WHERE comment_id = ? AND user_id = ?',
      [commentId, userId]
    );

    // 如果有点赞记录，先删除
    if (existingLike.length > 0) {
      await conn.execute(
        'DELETE FROM comment_like WHERE comment_id = ? AND user_id = ?',
        [commentId, userId]
      );
      await conn.execute(
        'UPDATE comment SET likes = likes - 1 WHERE id = ?',
        [commentId]
      );
    }

    // 添加点踩记录
    await conn.execute(
      'INSERT INTO comment_dislike (comment_id, user_id, created_at) VALUES (?, ?, NOW())',
      [commentId, userId]
    );
    await conn.execute(
      'UPDATE comment SET dislikes = dislikes + 1 WHERE id = ?',
      [commentId]
    );

    await conn.end();

    res.json({
      success: true,
      message: '点踩成功',
      action: 'disliked'
    });

  } catch (error) {
    console.error('点踩失败:', error);
    res.status(500).json({ message: '点踩失败' });
  }
});

module.exports = {
  // 导出新的API逻辑
};
