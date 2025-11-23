const express = require('express');
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const router = express.Router();

// 数据库配置
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld'
});

// 中间件：验证用户认证
const authenticateUser = (req, res, next) => {
  // 先从token获取用户ID
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (token) {
    try {
      const decoded = jwt.verify(token, 'your-secret-key');
      req.userId = decoded.id || decoded.userId;
      return next();
    } catch (err) {
      // Token无效，继续检查其他方式
    }
  }
  
  // 如果token无效或不存在，尝试从请求参数获取（用于开发测试）
  const userId = req.body.user_id || req.query.user_id || req.params.user_id;
  if (userId) {
    req.userId = parseInt(userId);
    return next();
  }
  
  return res.status(401).json({ success: false, message: '用户未认证' });
};

// 创建草稿（自动保存）
router.post('/create', authenticateUser, (req, res) => {
  const userId = req.userId;
  const { novel_id, chapter_id, chapter_number, title, content, translator_note, word_count } = req.body;

  // 验证必填字段
  if (!novel_id || !chapter_number) {
    return res.status(400).json({ success: false, message: 'novel_id 和 chapter_number 是必填字段' });
  }

  const query = `
    INSERT INTO draft (
      user_id,
      novel_id,
      chapter_id,
      chapter_number,
      title,
      content,
      translator_note,
      word_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    userId,
    parseInt(novel_id),
    chapter_id ? parseInt(chapter_id) : null,
    parseInt(chapter_number),
    title || `第${chapter_number}章`,
    content || '',
    translator_note || '',
    parseInt(word_count) || 0
  ];

  db.query(query, values, (err, results) => {
    if (err) {
      console.error('保存草稿失败:', err);
      return res.status(500).json({ success: false, message: '保存草稿失败', error: err.message });
    }

    res.json({ 
      success: true, 
      message: '草稿保存成功',
      draft_id: results.insertId 
    });
  });
});

// 获取草稿列表
router.get('/list', authenticateUser, (req, res) => {
  const { novel_id, chapter_number } = req.query;
  const userId = req.userId;

  let query = `
    SELECT 
      id,
      user_id,
      novel_id,
      chapter_id,
      chapter_number,
      title,
      content,
      translator_note,
      word_count,
      created_at
    FROM draft
    WHERE user_id = ?
  `;
  const params = [userId];

  if (novel_id) {
    query += ` AND novel_id = ?`;
    params.push(parseInt(novel_id));
  }

  if (chapter_number) {
    query += ` AND chapter_number = ?`;
    params.push(parseInt(chapter_number));
  }

  query += ` ORDER BY created_at DESC`;

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('获取草稿列表失败:', err);
      return res.status(500).json({ success: false, message: '获取草稿列表失败', error: err.message });
    }

    res.json({ success: true, data: results });
  });
});

// 获取最新的草稿
router.get('/latest', authenticateUser, (req, res) => {
  const { novel_id, chapter_number } = req.query;
  const userId = req.userId;

  if (!novel_id || !chapter_number) {
    return res.status(400).json({ success: false, message: 'novel_id 和 chapter_number 是必填字段' });
  }

  const query = `
    SELECT 
      id,
      user_id,
      novel_id,
      chapter_id,
      chapter_number,
      title,
      content,
      translator_note,
      word_count,
      created_at
    FROM draft
    WHERE user_id = ? AND novel_id = ? AND chapter_number = ?
    ORDER BY created_at DESC
    LIMIT 1
  `;

  db.query(query, [userId, parseInt(novel_id), parseInt(chapter_number)], (err, results) => {
    if (err) {
      console.error('获取最新草稿失败:', err);
      return res.status(500).json({ success: false, message: '获取最新草稿失败', error: err.message });
    }

    if (results.length === 0) {
      return res.json({ success: true, data: null });
    }

    res.json({ success: true, data: results[0] });
  });
});

// 删除草稿
router.delete('/:id', authenticateUser, (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  const query = `DELETE FROM draft WHERE id = ? AND user_id = ?`;

  db.query(query, [parseInt(id), userId], (err, results) => {
    if (err) {
      console.error('删除草稿失败:', err);
      return res.status(500).json({ success: false, message: '删除草稿失败', error: err.message });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '草稿不存在或无权限删除' });
    }

    res.json({ success: true, message: '草稿删除成功' });
  });
});

module.exports = router;

