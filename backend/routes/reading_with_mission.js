// 阅读章节API - 集成新的任务管理系统
const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();
const { updateMissionProgress } = require('../mission_manager');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

/**
 * 检查是否为新章节（改进版）
 */
async function checkIsNewChapterImproved(db, userId, chapterId) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    
    // 1. 检查今天是否已经阅读过这个章节
    const [todayReadings] = await db.execute(`
      SELECT * FROM reading_log 
      WHERE user_id = ? AND chapter_id = ? AND DATE(read_at) = ?
    `, [userId, chapterId, today]);
    
    if (todayReadings.length > 0) {
      return {
        isNewChapter: false,
        reason: '今天已经阅读过这个章节',
        details: { todayReadings: todayReadings.length }
      };
    }
    
    // 2. 检查章节解锁状态
    const [unlockResults] = await db.execute(`
      SELECT * FROM chapter_unlocks 
      WHERE user_id = ? AND chapter_id = ? AND status = 'unlocked'
    `, [userId, chapterId]);
    
    if (unlockResults.length === 0) {
      return {
        isNewChapter: false,
        reason: '章节未解锁',
        details: { unlockStatus: 'locked' }
      };
    }
    
    // 3. 检查解锁时间是否为今天
    const unlockTime = unlockResults[0].unlocked_at;
    const unlockDate = new Date(unlockTime).toISOString().slice(0, 10);
    
    if (unlockDate !== today) {
      return {
        isNewChapter: false,
        reason: '章节不是今天解锁的',
        details: { unlockDate, today }
      };
    }
    
    // 4. 检查是否为新章节（今天解锁且今天首次阅读）
    return {
      isNewChapter: true,
      reason: '今天解锁的新章节，首次阅读',
      details: { 
        unlockDate, 
        today, 
        isTodayUnlocked: true,
        isTodayFirstRead: true
      }
    };
    
  } catch (error) {
    console.error('检查新章节失败:', error);
    return {
      isNewChapter: false,
      reason: '检查新章节时出错',
      details: { error: error.message }
    };
  }
}

/**
 * 记录章节阅读（集成任务系统）
 */
router.post('/read-chapter', async (req, res) => {
  const { userId, chapterId } = req.body;
  
  if (!userId || !chapterId) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数'
    });
  }
  
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    // 1. 检查是否为新章节
    const newChapterCheck = await checkIsNewChapterImproved(db, userId, chapterId);
    
    if (!newChapterCheck.isNewChapter) {
      return res.status(400).json({
        success: false,
        message: newChapterCheck.reason,
        details: newChapterCheck
      });
    }
    
    // 2. 记录阅读日志
    await db.execute(`
      INSERT INTO reading_log (user_id, chapter_id, read_at) 
      VALUES (?, ?, NOW())
      ON DUPLICATE KEY UPDATE read_at = NOW()
    `, [userId, chapterId]);
    
    // 3. 更新任务进度（只有新章节才更新）
    console.log(`[DEBUG] 用户 ${userId} 阅读新章节 ${chapterId}，开始更新任务进度...`);
    
    const missionKeys = ['read_2_chapters', 'read_5_chapters', 'read_10_chapters'];
    const missionResults = [];
    
    for (const missionKey of missionKeys) {
      try {
        const result = await updateMissionProgress(userId, missionKey, 1);
        missionResults.push({
          missionKey,
          success: result.success,
          message: result.message,
          data: result.data
        });
        
        if (result.success) {
          console.log(`[DEBUG] 任务 ${missionKey} 进度更新成功:`, result.data);
        } else {
          console.log(`[DEBUG] 任务 ${missionKey} 进度更新失败:`, result.message);
        }
      } catch (error) {
        console.error(`[ERROR] 更新任务 ${missionKey} 进度失败:`, error);
        missionResults.push({
          missionKey,
          success: false,
          message: error.message
        });
      }
    }
    
    await db.end();
    
    res.json({
      success: true,
      message: '阅读记录已保存',
      isNewChapter: newChapterCheck.isNewChapter,
      reason: newChapterCheck.reason,
      details: newChapterCheck.details,
      missionResults: missionResults
    });
    
  } catch (error) {
    console.error('记录阅读失败:', error);
    res.status(500).json({
      success: false,
      message: '记录阅读失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

module.exports = router;
