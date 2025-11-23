const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();

// 数据库连接配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
};

// 创建数据库连接池
const pool = mysql.createPool(dbConfig);

// 切换章节书签锁定状态
router.post('/toggle', async (req, res) => {
  try {
    const { user_id, novel_id, chapter_id, bookmark_locked } = req.body;

    if (!user_id || !novel_id || !chapter_id || bookmark_locked === undefined) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: user_id, novel_id, chapter_id, bookmark_locked'
      });
    }

    const connection = await pool.getConnection();
    
    try {
      // 检查是否已存在记录
      const [existing] = await connection.execute(
        'SELECT id, bookmark_locked FROM bookmarklocked WHERE user_id = ? AND novel_id = ? AND chapter_id = ?',
        [user_id, novel_id, chapter_id]
      );

      if (existing.length > 0) {
        // 更新现有记录
        await connection.execute(
          'UPDATE bookmarklocked SET bookmark_locked = ?, updated_at = NOW() WHERE user_id = ? AND novel_id = ? AND chapter_id = ?',
          [bookmark_locked, user_id, novel_id, chapter_id]
        );
        
        console.log(`更新书签锁定状态: 用户${user_id}, 小说${novel_id}, 章节${chapter_id}, 状态${bookmark_locked}`);
      } else {
        // 插入新记录
        await connection.execute(
          'INSERT INTO bookmarklocked (user_id, novel_id, chapter_id, bookmark_locked) VALUES (?, ?, ?, ?)',
          [user_id, novel_id, chapter_id, bookmark_locked]
        );
        
        console.log(`新增书签锁定状态: 用户${user_id}, 小说${novel_id}, 章节${chapter_id}, 状态${bookmark_locked}`);
      }

      res.json({
        success: true,
        message: '书签锁定状态更新成功',
        data: {
          user_id,
          novel_id,
          chapter_id,
          bookmark_locked
        }
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('切换书签锁定状态失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
});

// 获取用户章节书签锁定状态
router.get('/status/:user_id/:novel_id/:chapter_id', async (req, res) => {
  try {
    const { user_id, novel_id, chapter_id } = req.params;

    const connection = await pool.getConnection();
    
    try {
      const [rows] = await connection.execute(
        'SELECT bookmark_locked FROM bookmarklocked WHERE user_id = ? AND novel_id = ? AND chapter_id = ?',
        [user_id, novel_id, chapter_id]
      );

      const bookmark_locked = rows.length > 0 ? rows[0].bookmark_locked : 0;

      res.json({
        success: true,
        data: {
          user_id: parseInt(user_id),
          novel_id: parseInt(novel_id),
          chapter_id: parseInt(chapter_id),
          bookmark_locked
        }
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('获取书签锁定状态失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
});

// 获取用户所有书签锁定状态
router.get('/user/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;

    const connection = await pool.getConnection();
    
    try {
      const [rows] = await connection.execute(
        'SELECT novel_id, chapter_id, bookmark_locked FROM bookmarklocked WHERE user_id = ?',
        [user_id]
      );

      res.json({
        success: true,
        data: rows
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('获取用户书签锁定状态失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
});

module.exports = router;
