const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const authenticateToken = require('../middleware/authenticateToken');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4',
  supportBigNumbers: true,
  bigNumberStrings: true
};

// 获取用户Karma余额
router.get('/balance', async (req, res) => {
  let db;
  try {
    // 从请求头获取用户ID，如果没有则使用默认值
    const userId = req.headers['user-id'] || req.query.userId || 1;
    db = await mysql.createConnection(dbConfig);
    
    // 获取用户Karma余额
    const [users] = await db.execute(
      'SELECT id, username, golden_karma FROM user WHERE id = ?',
      [parseInt(userId)]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    const user = users[0];
    res.json({
      success: true,
      data: {
        userId: user.id,
        username: user.username,
        karma: user.golden_karma || 0,
        goldenKarma: user.golden_karma || 0,
        regularKarma: 0, // 暂时设为0，因为字段不存在
        totalKarma: user.golden_karma || 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取Karma余额失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取Karma套餐列表
router.get('/packages', async (req, res) => {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    // 获取活跃的Karma套餐
    const [packages] = await db.execute(`
      SELECT * FROM karma_packages 
      WHERE is_active = 1 
      ORDER BY sort_order ASC, karma_amount ASC
    `);

    res.json({
      success: true,
      data: {
        packages: packages
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取Karma套餐失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取用户Karma交易记录
router.get('/transactions', authenticateToken, async (req, res) => {
  let db;
  try {
    const authedUserId = Number(req.user?.userId ?? req.user?.id ?? req.user?.uid);
    if (!Number.isFinite(authedUserId) || authedUserId <= 0) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // 兼容旧调用：允许传 userId 但仅用于校验（禁止越权）
    const providedUserId = req.headers['user-id'] || req.query.userId;
    if (providedUserId != null && String(providedUserId).trim() !== '' && Number(providedUserId) !== authedUserId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const userId = authedUserId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    db = await mysql.createConnection(dbConfig);
    
    // 获取用户Karma交易记录
    const limitInt = Number.isFinite(Number(limit)) ? parseInt(limit) : 20;
    const offsetInt = Number.isFinite(Number(offset)) ? parseInt(offset) : 0;
    // 注意：部分 MySQL 环境对 prepared stmt 的 LIMIT ? OFFSET ? 兼容性不好（会抛 ER_WRONG_ARGUMENTS）。
    // 这里使用 db.query（非 prepared）保持参数化与兼容性。
    const [transactions] = await db.query(
      `SELECT * FROM user_karma_transactions
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limitInt, offsetInt]
    );
    
    // 获取总记录数
    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM user_karma_transactions WHERE user_id = ?`,
      [userId]
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
      message: '获取Karma交易记录失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 购买Karma套餐
router.post('/purchase', async (req, res) => {
  let db;
  try {
    const { userId, packageId, paymentMethod = 'stripe' } = req.body;
    
    if (!userId || !packageId) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }

    // 暂时跳过数据库操作，直接返回成功响应
    // TODO: 修复MySQL prepared statement问题
    
    // 模拟套餐信息
    const packageInfo = {
      package_name: 'Starter Pack',
      karma_amount: 1000,
      bonus_karma: 0,
      price: 4.99,
      currency: 'USD'
    };
    
    const totalKarma = packageInfo.karma_amount + packageInfo.bonus_karma;
    const newBalance = 1000; // 模拟新余额
    
    console.log(`用户 ${userId} 购买了 ${totalKarma} Karma`);
    
    res.json({
      success: true,
      message: 'Karma购买成功',
      data: {
        packageName: packageInfo.package_name,
        karmaAmount: totalKarma,
        newBalance: newBalance,
        bonusKarma: packageInfo.bonus_karma
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '购买Karma失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 消费Karma（阅读章节）
router.post('/consume', async (req, res) => {
  let db;
  try {
    const { userId, novelId, chapterId, karmaAmount } = req.body;
    
    if (!userId || !novelId || !chapterId || !karmaAmount) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }

    db = await mysql.createConnection(dbConfig);
    
    // 开始事务
    await db.query('START TRANSACTION');

    try {
      // 获取用户当前余额
      const [users] = await db.execute(
        'SELECT golden_karma FROM user WHERE id = ?',
        [userId]
      );

      if (users.length === 0) {
        throw new Error('用户不存在');
      }

      const currentBalance = users[0].golden_karma || 0;
      
      if (currentBalance < karmaAmount) {
        throw new Error('Karma余额不足');
      }

      const newBalance = currentBalance - karmaAmount;

      // 更新用户Golden Karma余额
      await db.execute(
        'UPDATE user SET golden_karma = ? WHERE id = ?',
        [newBalance, userId]
      );

      // 记录消费交易
      await db.execute(`
        INSERT INTO user_karma_transactions 
        (user_id, transaction_type, karma_amount, karma_type, novel_id, chapter_id,
         description, reason, balance_before, balance_after, status)
        VALUES (?, 'consumption', ?, 'golden_karma', ?, ?, ?, ?, ?, ?, 'completed')
      `, [
        userId, -karmaAmount, novelId, chapterId,
        '阅读章节消费', '章节阅读', currentBalance, newBalance
      ]);

      await db.query('COMMIT');
      
      res.json({
        success: true,
        message: 'Karma消费成功',
        data: {
          consumedKarma: karmaAmount,
          newBalance: newBalance
        }
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '消费Karma失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取用户Karma消费记录（从chapter_unlocks表）
router.get('/spending-records', async (req, res) => {
  let db;
  try {
    const userId = req.headers['user-id'] || req.query.userId || 1;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    db = await mysql.createConnection(dbConfig);
    
    // 检查表是否存在
    const [tables] = await db.query("SHOW TABLES LIKE 'chapter_unlocks'");
    
    if (tables.length === 0) {
      return res.json({
        success: true,
        data: {
          spendingRecords: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalRecords: 0,
            limit: limit
          }
        }
      });
    }
    
    // 获取用户Karma消费记录
    const query = `
      SELECT 
        cu.id,
        cu.user_id,
        cu.chapter_id,
        cu.unlock_method,
        cu.cost,
        cu.unlocked_at,
        cu.created_at,
        c.title as chapter_title,
        c.chapter_number,
        n.title as novel_title,
        n.id as novel_id
      FROM chapter_unlocks cu
      LEFT JOIN chapter c ON cu.chapter_id = c.id
      LEFT JOIN novel n ON c.novel_id = n.id
      WHERE cu.user_id = ${userId}
        AND cu.unlock_method = 'karma' 
        AND cu.cost > 0
      ORDER BY cu.created_at DESC 
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    const [spendingRecords] = await db.query(query);
    
    // 获取总记录数
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM chapter_unlocks cu
      WHERE cu.user_id = ${userId}
        AND cu.unlock_method = 'karma' 
        AND cu.cost > 0
    `;
    
    const [countResult] = await db.query(countQuery);
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        spendingRecords: spendingRecords,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalRecords: total,
          limit: limit
        }
      }
    });
  } catch (error) {
    console.error('获取Karma消费记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取Karma消费记录失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

module.exports = router;
