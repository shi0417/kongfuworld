const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

// 根据用户名获取用户ID
router.get('/get-id', async (req, res) => {
  let db;
  try {
    const { username } = req.query;
    
    if (!username) {
      return res.status(400).json({
        success: false,
        message: '用户名参数缺失'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    // 查询用户ID
    const [users] = await db.execute(
      'SELECT id FROM user WHERE username = ?',
      [username]
    );
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    res.json({
      success: true,
      userId: users[0].id,
      username: username
    });
    
  } catch (error) {
    console.error('获取用户ID失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户ID失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

module.exports = router;
