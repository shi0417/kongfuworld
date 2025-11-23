// 优化的签到API - 使用checkinday字段
const mysql = require('mysql2/promise');
const timezoneHandler = require('./utils/timezone');
const { recordKeyTransaction } = require('./key_transaction_helper');

// 数据库连接配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
};

// 签到奖励配置
const REWARDS = [
  { day: 1, keys: 3 },
  { day: 2, keys: 3 },
  { day: 3, keys: 3 },
  { day: 4, keys: 5 },
  { day: 5, keys: 3 },
  { day: 6, keys: 3 },
  { day: 7, keys: 6 },
];

/**
 * 检查用户今日是否已签到（优化版本 - 使用checkinday字段）
 */
async function checkTodayCheckinOptimized(userId, userTimezone = 'UTC') {
  const today = timezoneHandler.getUserToday(userTimezone);
  
  try {
    const db = await mysql.createConnection(dbConfig);
    
    // 直接查询user表的checkinday字段
    const [results] = await db.execute(
      'SELECT id, username, checkinday FROM user WHERE id = ?',
      [userId]
    );
    
    await db.end();
    
    if (results.length === 0) {
      return { hasCheckedIn: false, user: null };
    }
    
    const user = results[0];
    const hasCheckedIn = user.checkinday === today;
    
    return {
      hasCheckedIn,
      user: hasCheckedIn ? user : null,
      checkinday: user.checkinday
    };
  } catch (error) {
    throw error;
  }
}

/**
 * 执行签到（优化版本）
 */
async function performCheckinOptimized(userId, userTimezone = 'UTC') {
  const today = timezoneHandler.getUserToday(userTimezone);
  const userNow = timezoneHandler.getUserNow(userTimezone);
  
  let db;
  try {
    // 创建数据库连接
    db = await mysql.createConnection(dbConfig);
    
    // 开始事务
    await db.beginTransaction();
    
    // 1. 检查今日是否已签到（使用checkinday字段）
    const checkinStatus = await checkTodayCheckinOptimized(userId, userTimezone);
    if (checkinStatus.hasCheckedIn) {
      await db.rollback();
      return { 
        success: false, 
        message: '今日已签到', 
        data: { checkinday: checkinStatus.checkinday }
      };
    }
    
    // 2. 获取用户信息
    const [userResults] = await db.execute(
      'SELECT * FROM user WHERE id = ?',
      [userId]
    );
    
    if (userResults.length === 0) {
      await db.rollback();
      return { success: false, message: '用户不存在' };
    }
    
    const user = userResults[0];
    
    // 3. 计算连续签到天数
    let streakDays = 1;
    if (user.checkinday) {
      const lastCheckinDate = new Date(user.checkinday);
      const todayDate = new Date(today);
      const diffTime = todayDate.getTime() - lastCheckinDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        // 连续签到
        streakDays = user.streak_days ? user.streak_days + 1 : 1;
      } else if (diffDays > 1) {
        // 中断了连续签到，重新开始
        streakDays = 1;
      }
    }
    
    // 4. 计算奖励钥匙数量
    const rewardDay = ((streakDays - 1) % 7) + 1;
    const keysEarned = REWARDS[rewardDay - 1].keys;
    
    // 5. 记录Key变动并更新用户余额
    const keyTransaction = await recordKeyTransaction(
      db, 
      userId, 
      'checkin', 
      keysEarned, 
      null, 
      'daily_checkin', 
      `每日签到奖励: +${keysEarned} keys (连续${streakDays}天)`
    );
    
    const currentTotalKeys = keyTransaction.balanceAfter;
    
    // 6. 更新用户checkinday字段和连续签到天数
    await db.execute(
      'UPDATE user SET checkinday = ?, streak_days = ?, points = ? WHERE id = ?',
      [today, streakDays, currentTotalKeys, userId]
    );
    
    // 7. 插入签到记录到daily_checkin表（用于历史记录）
    await db.execute(
      `INSERT INTO daily_checkin (user_id, checkin_date, keys_earned, streak_days, total_keys) 
       VALUES (?, ?, ?, ?, ?)`,
      [userId, today, keysEarned, streakDays, currentTotalKeys]
    );
    
    // 提交事务
    await db.commit();
    
    return {
      success: true,
      message: '签到成功',
      data: {
        keysEarned,
        streakDays,
        totalKeys: currentTotalKeys,
        rewardDay,
        checkinday: today
      }
    };
    
  } catch (error) {
    if (db) {
      await db.rollback();
    }
    console.error('签到失败:', error);
    return { success: false, message: '签到失败', error: error.message };
  } finally {
    if (db) {
      await db.end();
    }
  }
}

/**
 * 获取用户签到统计信息（优化版本）
 */
async function getUserCheckinStatsOptimized(userId) {
  try {
    const db = await mysql.createConnection(dbConfig);
    
    // 获取用户基本信息
    const [userResults] = await db.execute(
      'SELECT id, username, checkinday, streak_days, points FROM user WHERE id = ?',
      [userId]
    );
    
    if (userResults.length === 0) {
      await db.end();
      return null;
    }
    
    const user = userResults[0];
    
    // 获取签到历史统计
    const [statsResults] = await db.execute(`
      SELECT 
        COUNT(*) as total_checkins,
        MAX(streak_days) as max_streak,
        SUM(keys_earned) as total_keys_earned,
        MAX(checkin_date) as last_checkin_date
      FROM daily_checkin 
      WHERE user_id = ?
    `, [userId]);
    
    await db.end();
    
    const stats = statsResults[0];
    
    return {
      total_checkins: stats.total_checkins || 0,
      max_streak: Math.max(stats.max_streak || 0, user.streak_days || 0),
      total_keys_earned: stats.total_keys_earned || 0,
      last_checkin_date: stats.last_checkin_date || user.checkinday,
      current_streak: user.streak_days || 0,
      current_points: user.points || 0
    };
  } catch (error) {
    throw error;
  }
}

module.exports = {
  checkTodayCheckinOptimized,
  performCheckinOptimized,
  getUserCheckinStatsOptimized
};
