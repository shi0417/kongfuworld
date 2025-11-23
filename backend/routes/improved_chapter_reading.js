// 改进的章节阅读检查逻辑
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

/**
 * 检查是否为新章节（改进版）
 * 判断条件：
 * 1. 今天第一次阅读
 * 2. 章节已解锁（免费/会员/付费解锁）
 * 3. 用户有权限访问该章节
 */
const checkIsNewChapter = async (userId, chapterId) => {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    // 1. 检查今天是否已经阅读过
    const today = new Date().toISOString().slice(0, 10);
    const [todayReading] = await db.execute(`
      SELECT id FROM reading_log 
      WHERE user_id = ? AND chapter_id = ? AND DATE(read_at) = ?
    `, [userId, chapterId, today]);
    
    if (todayReading.length > 0) {
      return {
        isNewChapter: false,
        reason: '今天已经阅读过该章节'
      };
    }
    
    // 2. 获取章节信息
    const [chapterResults] = await db.execute(`
      SELECT 
        c.*,
        n.title as novel_title
      FROM chapter c
      LEFT JOIN novel n ON c.novel_id = n.id
      WHERE c.id = ?
    `, [chapterId]);
    
    const chapter = chapterResults[0];
    if (!chapter) {
      return {
        isNewChapter: false,
        reason: '章节不存在'
      };
    }
    
    // 3. 获取用户信息
    const [userResults] = await db.execute(`
      SELECT id, points, golden_karma, username
      FROM user WHERE id = ?
    `, [userId]);
    
    const user = userResults[0];
    if (!user) {
      return {
        isNewChapter: false,
        reason: '用户不存在'
      };
    }
    
    // 4. 检查章节解锁状态
    const unlockStatus = await checkChapterUnlockStatus(db, userId, chapterId, chapter, user);
    
    if (!unlockStatus.isUnlocked) {
      return {
        isNewChapter: false,
        reason: '章节未解锁，无法阅读',
        unlockInfo: unlockStatus
      };
    }
    
    // 5. 检查历史阅读记录（防止重复计算）
    const [historyReading] = await db.execute(`
      SELECT id, read_at FROM reading_log 
      WHERE user_id = ? AND chapter_id = ?
      ORDER BY read_at DESC
      LIMIT 1
    `, [userId, chapterId]);
    
    const hasReadBefore = historyReading.length > 0;
    const lastReadDate = hasReadBefore ? new Date(historyReading[0].read_at).toISOString().slice(0, 10) : null;
    
    return {
      isNewChapter: true,
      reason: '符合新章节条件',
      details: {
        todayFirstRead: true,
        chapterUnlocked: true,
        unlockMethod: unlockStatus.unlockMethod,
        hasReadBefore: hasReadBefore,
        lastReadDate: lastReadDate,
        unlockInfo: unlockStatus
      }
    };
    
  } catch (error) {
    console.error('检查新章节失败:', error);
    return {
      isNewChapter: false,
      reason: '检查失败: ' + error.message
    };
  } finally {
    if (db) await db.end();
  }
};

/**
 * 检查章节解锁状态
 */
const checkChapterUnlockStatus = async (db, userId, chapterId, chapter, user) => {
  try {
    // 1. 检查章节是否免费
    const now = new Date();
    const isFree = !chapter.unlock_price || chapter.unlock_price <= 0;
    
    if (isFree) {
      return {
        isUnlocked: true,
        unlockMethod: 'free',
        reason: '免费章节'
      };
    }
    
    // 2. 检查用户Champion会员状态
    const [championResults] = await db.execute(`
      SELECT * FROM user_champion_subscription 
      WHERE user_id = ? AND novel_id = ? AND is_active = 1 AND end_date > NOW()
    `, [userId, chapter.novel_id]);
    
    if (championResults.length > 0) {
      return {
        isUnlocked: true,
        unlockMethod: 'champion',
        reason: 'Champion会员永久解锁',
        subscription: championResults[0]
      };
    }
    
    // 3. 检查付费解锁记录
    const [unlockResults] = await db.execute(`
      SELECT * FROM chapter_unlocks 
      WHERE user_id = ? AND chapter_id = ? AND status = 'unlocked'
    `, [userId, chapterId]);
    
    if (unlockResults.length > 0) {
      const unlock = unlockResults[0];
      return {
        isUnlocked: true,
        unlockMethod: unlock.unlock_method,
        reason: `通过${getUnlockMethodName(unlock.unlock_method)}解锁`,
        unlockRecord: unlock
      };
    }
    
    // 4. 检查时间解锁状态
    const [timeUnlockResults] = await db.execute(`
      SELECT * FROM chapter_unlocks 
      WHERE user_id = ? AND chapter_id = ? AND unlock_method = 'time_unlock' AND status = 'pending'
    `, [userId, chapterId]);
    
    if (timeUnlockResults.length > 0) {
      const timeUnlock = timeUnlockResults[0];
      const unlockAt = new Date(timeUnlock.unlock_at);
      
      if (now >= unlockAt) {
        // 时间解锁已到期，自动解锁
        await db.execute(`
          UPDATE chapter_unlocks 
          SET status = 'unlocked', unlocked_at = ?, updated_at = ?
          WHERE id = ?
        `, [now, now, timeUnlock.id]);
        
        return {
          isUnlocked: true,
          unlockMethod: 'time_unlock',
          reason: '时间解锁已完成',
          unlockRecord: timeUnlock
        };
      } else {
        return {
          isUnlocked: false,
          unlockMethod: 'time_unlock',
          reason: '时间解锁等待中',
          unlockAt: unlockAt,
          timeRemaining: unlockAt - now
        };
      }
    }
    
    // 5. 章节未解锁
    return {
      isUnlocked: false,
      unlockMethod: 'none',
      reason: '章节未解锁',
      canUnlockWith: {
        key: user.points >= chapter.key_cost,
        karma: chapter.unlock_price > 0,
        time: null
      }
    };
    
  } catch (error) {
    console.error('检查解锁状态失败:', error);
    return {
      isUnlocked: false,
      unlockMethod: 'error',
      reason: '检查解锁状态失败: ' + error.message
    };
  }
};

/**
 * 获取解锁方法的中文名称
 */
const getUnlockMethodName = (method) => {
  const methodNames = {
    'free': '免费',
    'champion': 'Champion会员',
    'key': '钥匙解锁',
    'karma': 'Karma解锁',
    'time_unlock': '时间解锁',
    'subscription': '订阅解锁'
  };
  return methodNames[method] || method;
};

/**
 * 记录章节阅读（改进版）
 */
router.post('/read-chapter', async (req, res) => {
  const { userId, chapterId } = req.body;
  
  if (!userId || !chapterId) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数'
    });
  }
  
  try {
    // 1. 检查是否为新章节
    const newChapterCheck = await checkIsNewChapter(userId, chapterId);
    
    if (!newChapterCheck.isNewChapter) {
      return res.status(400).json({
        success: false,
        message: newChapterCheck.reason,
        details: newChapterCheck
      });
    }
    
    // 2. 记录阅读日志
    let db = await mysql.createConnection(dbConfig);
    
    await db.execute(`
      INSERT INTO reading_log (user_id, chapter_id, read_at) 
      VALUES (?, ?, NOW())
      ON DUPLICATE KEY UPDATE read_at = NOW()
    `, [userId, chapterId]);
    
    // 3. 更新任务进度（只有新章节才更新）
    if (newChapterCheck.isNewChapter) {
      try {
        const missionKeys = ['read_2_chapters', 'read_5_chapters', 'read_10_chapters'];
        
        for (const missionKey of missionKeys) {
          const response = await fetch(`http://localhost:5000/api/mission/progress`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: parseInt(userId),
              missionKey: missionKey,
              progressValue: 1
            })
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log(`任务 ${missionKey} 进度更新:`, result.data);
          }
        }
      } catch (error) {
        console.error('更新任务进度失败:', error);
        // 不影响阅读记录的主要功能
      }
    }
    
    await db.end();
    
    res.json({
      success: true,
      message: '阅读记录已保存',
      isNewChapter: newChapterCheck.isNewChapter,
      details: newChapterCheck.details
    });
    
  } catch (error) {
    console.error('记录阅读失败:', error);
    res.status(500).json({
      success: false,
      message: '记录阅读失败: ' + error.message
    });
  }
});

/**
 * 获取章节解锁状态（改进版）
 */
router.get('/unlock-status/:chapterId/:userId', async (req, res) => {
  const { chapterId, userId } = req.params;
  
  try {
    const newChapterCheck = await checkIsNewChapter(userId, chapterId);
    
    res.json({
      success: true,
      data: {
        isNewChapter: newChapterCheck.isNewChapter,
        reason: newChapterCheck.reason,
        details: newChapterCheck.details || newChapterCheck.unlockInfo
      }
    });
    
  } catch (error) {
    console.error('获取解锁状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取解锁状态失败: ' + error.message
    });
  }
});

module.exports = router;
