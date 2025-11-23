// 任务系统API路由 V2 - 基于user.mission字段的任务管理
const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();
const { 
  checkAndInitializeTodayMissions, 
  checkMissionCompletion, 
  updateMissionProgress 
} = require('../mission_manager');
const { recordKeyTransaction } = require('../key_transaction_helper');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

// 获取用户任务列表（自动初始化）
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { date } = req.query; // 可选：指定日期，默认为今天
    
    const targetDate = date || new Date().toISOString().slice(0, 10);
    
    // 1. 检查并初始化今日任务
    const initResult = await checkAndInitializeTodayMissions(userId);
    
    if (!initResult.success) {
      return res.status(400).json({
        success: false,
        message: initResult.message
      });
    }
    
    // 2. 获取用户任务列表
    let db = await mysql.createConnection(dbConfig);
    
    const [missions] = await db.execute(`
      SELECT 
        mc.id,
        mc.mission_key,
        mc.title,
        mc.description,
        mc.target_value,
        mc.reward_keys,
        mc.reward_karma,
        mc.reset_type,
        ump.current_progress,
        ump.is_completed,
        ump.is_claimed,
        ump.progress_date
      FROM mission_config mc
      LEFT JOIN user_mission_progress ump ON mc.id = ump.mission_id 
        AND ump.user_id = ? AND ump.progress_date = ?
      WHERE mc.is_active = 1
      ORDER BY mc.id ASC
    `, [userId, targetDate]);
    
    await db.end();
    
    // 3. 处理任务数据
    const processedMissions = missions.map(mission => ({
      id: mission.id,
      missionKey: mission.mission_key,
      title: mission.title,
      description: mission.description,
      targetValue: mission.target_value,
      rewardKeys: mission.reward_keys,
      rewardKarma: mission.reward_karma,
      resetType: mission.reset_type,
      currentProgress: mission.current_progress || 0,
      isCompleted: mission.is_completed || false,
      isClaimed: mission.is_claimed || false,
      progressDate: mission.progress_date || targetDate,
      progressPercentage: Math.min(100, Math.round((mission.current_progress || 0) / mission.target_value * 100))
    }));
    
    // 4. 检查任务完成状态
    const completionStatus = await checkMissionCompletion(userId);
    
    res.json({
      success: true,
      data: {
        missions: processedMissions,
        date: targetDate,
        userMissionStatus: initResult.status,
        allTasksCompleted: completionStatus.isCompleted,
        completionMessage: completionStatus.message
      }
    });
    
  } catch (error) {
    console.error('Failed to get user missions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user missions',
      error: error.message
    });
  }
});

// 更新任务进度（新版本）
router.post('/progress', async (req, res) => {
  try {
    const { userId, missionKey, progressValue = 1 } = req.body;
    
    if (!userId || !missionKey) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters'
      });
    }
    
    // 使用新的任务管理系统更新进度
    const result = await updateMissionProgress(userId, missionKey, progressValue);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
    
  } catch (error) {
    console.error('Failed to update mission progress:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update mission progress',
      error: error.message
    });
  }
});

// 检查任务完成状态
router.get('/completion/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await checkMissionCompletion(userId);
    res.json(result);
    
  } catch (error) {
    console.error('Failed to check mission completion status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check mission completion status',
      error: error.message
    });
  }
});

// 领取任务奖励
router.post('/claim/:userId/:missionId', async (req, res) => {
  let db;
  try {
    const { userId, missionId } = req.params;
    
    db = await mysql.createConnection(dbConfig);
    
    // 1. 检查任务是否完成
    const [progressResults] = await db.execute(`
      SELECT * FROM user_mission_progress 
      WHERE user_id = ? AND mission_id = ? AND is_completed = 1 AND is_claimed = 0
    `, [userId, missionId]);
    
    if (progressResults.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Mission not completed or reward already claimed'
      });
    }
    
    const progress = progressResults[0];
    
    // 2. 获取任务配置
    const [missionConfigs] = await db.execute(
      'SELECT reward_keys, reward_karma, title FROM mission_config WHERE id = ?',
      [missionId]
    );
    
    if (missionConfigs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Mission configuration not found'
      });
    }
    
    const mission = missionConfigs[0];
    
    // 3. 开始事务
    await db.query('START TRANSACTION');
    
    try {
      // 4. 更新任务状态为已领取（只更新今天的记录）
      const today = new Date().toISOString().slice(0, 10);
      await db.execute(`
        UPDATE user_mission_progress 
        SET is_claimed = 1, updated_at = NOW()
        WHERE user_id = ? AND mission_id = ? AND progress_date = ?
      `, [userId, missionId, today]);
      
      // 5. 更新用户余额并记录钥匙变动
      if (mission.reward_keys > 0) {
        await recordKeyTransaction(
          db, 
          userId, 
          'mission', 
          mission.reward_keys, 
          missionId, 
          'mission', 
          `Mission Reward: ${mission.title}`
        );
      }
      
      if (mission.reward_karma > 0) {
        await db.execute(`
          UPDATE user 
          SET karma = karma + ?
          WHERE id = ?
        `, [mission.reward_karma, userId]);
      }
      
      // 6. 更新完成日志的领取时间
      await db.execute(`
        UPDATE mission_completion_log 
        SET claimed_at = NOW()
        WHERE user_id = ? AND mission_id = ? AND claimed_at IS NULL
      `, [userId, missionId]);
      
      await db.query('COMMIT');
      
      res.json({
        success: true,
        message: 'Reward claimed successfully',
        data: {
          rewardKeys: mission.reward_keys,
          rewardKarma: mission.reward_karma
        }
      });
      
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('Failed to claim mission reward:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to claim mission reward',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

module.exports = router;
