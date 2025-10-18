// Key交易记录API路由
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

// 获取用户Key交易记录
router.get('/transactions', async (req, res) => {
  let db;
  try {
    // 从请求头获取用户ID，如果没有则使用默认值
    const userId = req.headers['user-id'] || req.query.userId || 1;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    db = await mysql.createConnection(dbConfig);
    
    // 获取用户Key交易记录，排除user_id字段，按id倒序排列
    const [transactions] = await db.execute(`
      SELECT 
        id,
        transaction_type,
        amount,
        balance_before,
        balance_after,
        reference_id,
        reference_type,
        description,
        created_at
      FROM key_transaction 
      WHERE user_id = ? 
      ORDER BY id DESC 
      LIMIT ? OFFSET ?
    `, [parseInt(userId), parseInt(limit), parseInt(offset)]);
    
    // 获取总记录数
    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM key_transaction WHERE user_id = ?`,
      [parseInt(userId)]
    );
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        transactions: transactions,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalRecords: total,
          limit: limit
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取Key交易记录失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

module.exports = router;
