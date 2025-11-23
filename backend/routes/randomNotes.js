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

// 获取随记列表（支持搜索和分页）
router.get('/list', authenticateUser, (req, res) => {
  const { novel_id, keyword, page = 1, limit = 10 } = req.query;
  const userId = req.userId;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = `
    SELECT 
      id,
      user_id,
      novel_id,
      random_note,
      created_at,
      updated_at
    FROM randomNotes
    WHERE user_id = ? AND novel_id = ?
  `;
  const params = [userId, parseInt(novel_id)];

  // 如果有搜索关键词
  if (keyword && keyword.trim()) {
    query += ` AND random_note LIKE ?`;
    params.push(`%${keyword.trim()}%`);
  }

  query += ` ORDER BY updated_at DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), offset);

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('获取随记列表失败:', err);
      return res.status(500).json({ success: false, message: '获取随记列表失败', error: err.message });
    }

    // 获取总数
    let countQuery = `
      SELECT COUNT(*) as total
      FROM randomNotes
      WHERE user_id = ? AND novel_id = ?
    `;
    const countParams = [userId, parseInt(novel_id)];

    if (keyword && keyword.trim()) {
      countQuery += ` AND random_note LIKE ?`;
      countParams.push(`%${keyword.trim()}%`);
    }

    db.query(countQuery, countParams, (err, countResults) => {
      if (err) {
        console.error('获取随记总数失败:', err);
        return res.status(500).json({ success: false, message: '获取随记总数失败', error: err.message });
      }

      const total = countResults[0].total;
      const hasMore = offset + results.length < total;

      res.json({
        success: true,
        data: results,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          hasMore
        }
      });
    });
  });
});

// 创建随记
router.post('/create', authenticateUser, (req, res) => {
  const { novel_id, random_note } = req.body;
  const userId = req.userId;

  if (!novel_id) {
    return res.status(400).json({ success: false, message: '小说ID不能为空' });
  }

  if (!random_note || !random_note.trim()) {
    return res.status(400).json({ success: false, message: '随记内容不能为空' });
  }

  const query = `
    INSERT INTO randomNotes (user_id, novel_id, random_note)
    VALUES (?, ?, ?)
  `;

  db.query(query, [userId, parseInt(novel_id), random_note.trim()], (err, result) => {
    if (err) {
      console.error('创建随记失败:', err);
      return res.status(500).json({ success: false, message: '创建随记失败', error: err.message });
    }

    res.json({
      success: true,
      message: '随记创建成功',
      data: {
        id: result.insertId,
        user_id: userId,
        novel_id: parseInt(novel_id),
        random_note: random_note.trim(),
        created_at: new Date(),
        updated_at: new Date()
      }
    });
  });
});

// 更新随记
router.put('/update/:id', authenticateUser, (req, res) => {
  const { id } = req.params;
  const { random_note } = req.body;
  const userId = req.userId;

  if (!random_note || !random_note.trim()) {
    return res.status(400).json({ success: false, message: '随记内容不能为空' });
  }

  // 先检查随记是否存在且属于当前用户
  const checkQuery = `SELECT id FROM randomNotes WHERE id = ? AND user_id = ?`;
  
  db.query(checkQuery, [parseInt(id), userId], (err, results) => {
    if (err) {
      console.error('检查随记失败:', err);
      return res.status(500).json({ success: false, message: '检查随记失败', error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: '随记不存在或无权访问' });
    }

    // 更新随记
    const updateQuery = `
      UPDATE randomNotes
      SET random_note = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `;

    db.query(updateQuery, [random_note.trim(), parseInt(id), userId], (err, result) => {
      if (err) {
        console.error('更新随记失败:', err);
        return res.status(500).json({ success: false, message: '更新随记失败', error: err.message });
      }

      // 获取更新后的数据
      const selectQuery = `SELECT * FROM randomNotes WHERE id = ?`;
      db.query(selectQuery, [parseInt(id)], (err, results) => {
        if (err) {
          console.error('获取更新后的随记失败:', err);
          return res.status(500).json({ success: false, message: '获取更新后的随记失败', error: err.message });
        }

        res.json({
          success: true,
          message: '随记更新成功',
          data: results[0]
        });
      });
    });
  });
});

// 删除随记
router.delete('/delete/:id', authenticateUser, (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  // 先检查随记是否存在且属于当前用户
  const checkQuery = `SELECT id FROM randomNotes WHERE id = ? AND user_id = ?`;
  
  db.query(checkQuery, [parseInt(id), userId], (err, results) => {
    if (err) {
      console.error('检查随记失败:', err);
      return res.status(500).json({ success: false, message: '检查随记失败', error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: '随记不存在或无权访问' });
    }

    // 删除随记
    const deleteQuery = `DELETE FROM randomNotes WHERE id = ? AND user_id = ?`;

    db.query(deleteQuery, [parseInt(id), userId], (err, result) => {
      if (err) {
        console.error('删除随记失败:', err);
        return res.status(500).json({ success: false, message: '删除随记失败', error: err.message });
      }

      res.json({
        success: true,
        message: '随记删除成功'
      });
    });
  });
});

// 获取单个随记
router.get('/:id', authenticateUser, (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  const query = `SELECT * FROM randomNotes WHERE id = ? AND user_id = ?`;

  db.query(query, [parseInt(id), userId], (err, results) => {
    if (err) {
      console.error('获取随记失败:', err);
      return res.status(500).json({ success: false, message: '获取随记失败', error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: '随记不存在或无权访问' });
    }

    res.json({
      success: true,
      data: results[0]
    });
  });
});

module.exports = router;

