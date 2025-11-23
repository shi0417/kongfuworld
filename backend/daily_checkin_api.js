// 每日签到API接口
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

// 检查用户今日是否已签到（支持时区）
async function checkTodayCheckin(userId, userTimezone = 'UTC') {
  const today = timezoneHandler.getUserToday(userTimezone);
  
  try {
    const db = await mysql.createConnection(dbConfig);
    
    // 1. 首先检查user.checkinday字段
    const [userResults] = await db.execute(
      'SELECT checkinday FROM user WHERE id = ?',
      [userId]
    );
    
    if (userResults.length === 0) {
      await db.end();
      return null;
    }
    
    const user = userResults[0];
    
    // 2. 如果user.checkinday等于今天，说明已签到
    console.log(`[DEBUG] 用户 ${userId} checkinday: ${user.checkinday}, 今天: ${today}`);
    if (user.checkinday === today) {
      console.log(`[DEBUG] 用户 ${userId} 今日已签到（checkinday匹配）`);
      // 今天已签到，获取签到记录
      const [checkinResults] = await db.execute(
        'SELECT * FROM daily_checkin WHERE user_id = ? AND checkin_date = ?',
        [userId, today]
      );
      await db.end();
      return checkinResults.length > 0 ? checkinResults[0] : null;
    } else {
      // 3. 如果user.checkinday不等于今天（包括null或其他日期），检查daily_checkin表
      const [checkinResults] = await db.execute(
        'SELECT * FROM daily_checkin WHERE user_id = ? AND checkin_date = ?',
        [userId, today]
      );
      
      if (checkinResults.length > 0) {
        // 4. 如果daily_checkin表中有今天记录，更新user.checkinday
        await db.execute(
          'UPDATE user SET checkinday = ? WHERE id = ?',
          [today, userId]
        );
        await db.end();
        return checkinResults[0];
      } else {
        // 5. 如果daily_checkin表中没有今天记录，返回null（需要签到）
        await db.end();
        return null;
      }
    }
  } catch (error) {
    throw error;
  }
}

// 获取用户签到统计信息
async function getUserCheckinStats(userId) {
  try {
    const db = await mysql.createConnection(dbConfig);
    const [results] = await db.execute(
      `SELECT 
        COUNT(*) as total_checkins,
        MAX(streak_days) as max_streak,
        SUM(keys_earned) as total_keys_earned,
        MAX(created_at) as last_checkin_date
      FROM daily_checkin 
      WHERE user_id = ?`,
      [userId]
    );
    await db.end();
    return results[0] || { total_checkins: 0, max_streak: 0, total_keys_earned: 0, last_checkin_date: null };
  } catch (error) {
    throw error;
  }
}

// 执行签到（支持时区）
async function performCheckin(userId, userTimezone = 'UTC') {
  const today = timezoneHandler.getUserToday(userTimezone);
  const userNow = timezoneHandler.getUserNow(userTimezone);
  
  let db;
  try {
    // 创建数据库连接
    db = await mysql.createConnection(dbConfig);
    
    // 检查今日是否已签到
    console.log(`[DEBUG] 检查用户 ${userId} 今日签到状态，时区: ${userTimezone}`);
    const todayCheckin = await checkTodayCheckin(userId, userTimezone);
    console.log(`[DEBUG] 签到检查结果:`, todayCheckin);
    if (todayCheckin) {
      console.log(`[DEBUG] 用户 ${userId} 今日已签到，返回失败`);
      return { success: false, message: '今日已签到', data: todayCheckin };
    }
    
    // 获取用户最近一次签到记录
    const [lastCheckinResults] = await db.execute(
      'SELECT * FROM daily_checkin WHERE user_id = ? ORDER BY checkin_date DESC LIMIT 1',
      [userId]
    );
    const lastCheckin = lastCheckinResults.length > 0 ? lastCheckinResults[0] : null;
    
    // 计算连续签到天数
    let streakDays = 1;
    if (lastCheckin) {
      const lastCheckinDate = new Date(lastCheckin.checkin_date);
      const todayDate = new Date(today);
      const diffTime = todayDate.getTime() - lastCheckinDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        // 连续签到
        streakDays = lastCheckin.streak_days + 1;
      } else if (diffDays > 1) {
        // 中断了连续签到，重新开始
        streakDays = 1;
      }
    }
    
    // 计算奖励钥匙数量
    const rewardDay = ((streakDays - 1) % 7) + 1;
    const keysEarned = REWARDS[rewardDay - 1].keys;
    
    // 记录Key变动并更新用户余额
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
    
    // 更新用户checkinday字段和钥匙余额
    await db.execute(
      'UPDATE user SET checkinday = ?, points = ? WHERE id = ?',
      [today, currentTotalKeys, userId]
    );
    
    // 插入签到记录
    const [checkinResult] = await db.execute(
      `INSERT INTO daily_checkin (user_id, checkin_date, keys_earned, streak_days, total_keys) 
       VALUES (?, ?, ?, ?, ?)`,
      [userId, today, keysEarned, streakDays, currentTotalKeys]
    );
    
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
    console.error('签到失败:', error);
    return { success: false, message: '签到失败', error: error.message };
  } finally {
    if (db) {
      await db.end();
    }
  }
}

// 获取用户签到历史
async function getUserCheckinHistory(userId, limit = 30) {
  try {
    const db = await mysql.createConnection(dbConfig);
    const [results] = await db.execute(
      `SELECT 
        checkin_date,
        keys_earned,
        streak_days,
        total_keys,
        created_at
      FROM daily_checkin 
      WHERE user_id = ? 
      ORDER BY checkin_date DESC 
      LIMIT ?`,
      [userId, limit]
    );
    await db.end();
    return results;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  checkTodayCheckin,
  getUserCheckinStats,
  performCheckin,
  getUserCheckinHistory,
  REWARDS
};
