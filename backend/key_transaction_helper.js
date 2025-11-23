// Key变动记录辅助函数
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

/**
 * 记录Key变动
 * @param {Object} db - 数据库连接
 * @param {number} userId - 用户ID
 * @param {string} transactionType - 交易类型 (checkin, mission, unlock, purchase, refund, admin)
 * @param {number} amount - 变动数量（正数为增加，负数为减少）
 * @param {number} referenceId - 关联ID（可选）
 * @param {string} referenceType - 关联类型（可选）
 * @param {string} description - 交易描述（可选）
 * @returns {Promise<Object>} 返回变动记录
 */
async function recordKeyTransaction(db, userId, transactionType, amount, referenceId = null, referenceType = null, description = null) {
  try {
    // 注意：这里不需要开始事务，因为调用方已经开始了事务
    
    // 获取当前余额
    const [userResult] = await db.execute('SELECT points FROM user WHERE id = ?', [userId]);
    if (userResult.length === 0) {
      throw new Error('用户不存在');
    }
    
    const balanceBefore = userResult[0].points;
    const balanceAfter = balanceBefore + amount;
    
    // 检查余额是否足够（如果是减少）
    if (amount < 0 && balanceAfter < 0) {
      throw new Error('余额不足');
    }
    
    // 更新用户余额
    await db.execute('UPDATE user SET points = ? WHERE id = ?', [balanceAfter, userId]);
    
    // 记录变动
    const [result] = await db.execute(`
      INSERT INTO key_transaction (
        user_id, transaction_type, amount, balance_before, balance_after,
        reference_id, reference_type, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [userId, transactionType, amount, balanceBefore, balanceAfter, referenceId, referenceType, description]);
    
    // 提交事务
    // 注意：这里不需要提交事务，由调用方处理
    
    return {
      success: true,
      transactionId: result.insertId,
      balanceBefore,
      balanceAfter,
      amount
    };
    
  } catch (error) {
    // 回滚事务
    // 注意：这里不需要回滚事务，由调用方处理
    throw error;
  }
}

/**
 * 获取用户Key变动记录
 * @param {Object} db - 数据库连接
 * @param {number} userId - 用户ID
 * @param {number} limit - 限制数量
 * @param {number} offset - 偏移量
 * @returns {Promise<Array>} 返回变动记录列表
 */
async function getUserKeyTransactions(db, userId, limit = 20, offset = 0) {
  try {
    const [transactions] = await db.execute(`
      SELECT 
        kt.*,
        u.username,
        CASE 
          WHEN kt.transaction_type = 'checkin' THEN CONCAT('Check-in Reward: +', kt.amount, ' keys')
          WHEN kt.transaction_type = 'mission' THEN CONCAT('Mission Reward: +', kt.amount, ' keys')
          WHEN kt.transaction_type = 'unlock' THEN CONCAT('Chapter Unlock: -', ABS(kt.amount), ' keys')
          WHEN kt.transaction_type = 'purchase' THEN CONCAT('Purchase: +', kt.amount, ' keys')
          WHEN kt.transaction_type = 'refund' THEN CONCAT('Refund: +', kt.amount, ' keys')
          ELSE CONCAT('Other: ', IF(kt.amount > 0, '+', ''), kt.amount, ' keys')
        END as transaction_description
      FROM key_transaction kt
      JOIN user u ON kt.user_id = u.id
      WHERE kt.user_id = ?
      ORDER BY kt.created_at DESC
      LIMIT ? OFFSET ?
    `, [userId, limit, offset]);
    
    return transactions;
  } catch (error) {
    throw error;
  }
}

/**
 * 获取用户Key统计信息
 * @param {Object} db - 数据库连接
 * @param {number} userId - 用户ID
 * @returns {Promise<Object>} 返回统计信息
 */
async function getUserKeyStats(db, userId) {
  try {
    const [stats] = await db.execute(`
      SELECT 
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_earned,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_spent,
        COUNT(*) as total_transactions,
        MAX(created_at) as last_transaction_time
      FROM key_transaction 
      WHERE user_id = ?
    `, [userId]);
    
    const [currentBalance] = await db.execute('SELECT points FROM user WHERE id = ?', [userId]);
    
    return {
      currentBalance: currentBalance[0].points,
      totalEarned: stats[0].total_earned || 0,
      totalSpent: stats[0].total_spent || 0,
      totalTransactions: stats[0].total_transactions || 0,
      lastTransactionTime: stats[0].last_transaction_time
    };
  } catch (error) {
    throw error;
  }
}

module.exports = {
  recordKeyTransaction,
  getUserKeyTransactions,
  getUserKeyStats
};
