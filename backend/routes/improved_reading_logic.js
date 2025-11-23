// 改进的阅读逻辑 - 按照用户建议实现
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
 * 改进的章节阅读逻辑
 * 操作顺序：
 * 1. 先记录阅读日志到 reading_log
 * 2. 再判断是否为新章节
 * 3. 最后更新任务进度
 */
router.post('/read-chapter-improved', async (req, res) => {
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
    
    // 1. 检查章节是否存在
    const [chapters] = await db.execute('SELECT id FROM chapter WHERE id = ?', [chapterId]);
    if (chapters.length === 0) {
      return res.status(404).json({ message: '章节不存在' });
    }
    
    // 2. 检查章节解锁状态
    const [chapterResults] = await db.execute(`
      SELECT c.*, n.title as novel_title
      FROM chapter c
      LEFT JOIN novel n ON c.novel_id = n.id
      WHERE c.id = ?
    `, [chapterId]);
    
    const chapter = chapterResults[0];
    
    // 3. 获取用户信息
    const [userResults] = await db.execute(`
      SELECT id, points, golden_karma FROM user WHERE id = ?
    `, [userId]);
    const user = userResults[0];
    
    // 4. 检查解锁状态
    const unlockStatus = await checkChapterUnlockStatus(db, userId, chapterId, chapter, user);
    
    if (!unlockStatus.isUnlocked) {
      return res.status(403).json({ 
        success: false,
        message: '章节未解锁，无法阅读',
        unlockInfo: unlockStatus
      });
    }
    
    // 5. 先记录阅读日志到 reading_log
    await db.execute(`
      INSERT INTO reading_log (user_id, chapter_id, read_at) 
      VALUES (?, ?, NOW())
      ON DUPLICATE KEY UPDATE read_at = NOW()
    `, [userId, chapterId]);
    
    // 6. 记录访问日志到 chapter_access_log
    await db.execute(`
      INSERT INTO chapter_access_log (user_id, chapter_id, access_method, access_time)
      VALUES (?, ?, ?, NOW())
    `, [userId, chapterId, unlockStatus.unlockMethod]);
    
    // 7. 判断是否为新章节（关键改进）
    const isNewChapter = await checkIsNewChapterImproved(db, userId, chapterId);
    
    // 8. 只有新章节才更新任务进度
    if (isNewChapter.isNewChapter) {
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
      }
    }
    
    res.json({ 
      success: true, 
      message: '阅读记录已保存',
      isNewChapter: isNewChapter.isNewChapter,
      reason: isNewChapter.reason,
      unlockMethod: unlockStatus.unlockMethod,
      details: isNewChapter.details
    });
    
  } catch (error) {
    console.error('记录阅读失败:', error);
    res.status(500).json({
      success: false,
      message: '记录阅读失败: ' + error.message
    });
  } finally {
    if (db) await db.end();
  }
});

/**
 * 正确的新章节判断逻辑
 * A. 付费章节判断:
 *    无Champion会员或已过期: 只有今天解锁且今天首次阅读才算新章节
 *    有有效Champion会员: 只有今天首次阅读才算新章节
 * B. 免费章节判断:
 *    免费章节: 只有今天首次阅读才算新章节
 */
async function checkIsNewChapterImproved(db, userId, chapterId) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    
    // 1. 查询章节基本信息
    const [chapters] = await db.execute(`
      SELECT id, novel_id, unlock_price
      FROM chapter 
      WHERE id = ?
    `, [chapterId]);
    
    if (chapters.length === 0) {
      return {
        isNewChapter: false,
        reason: '章节不存在',
        details: {}
      };
    }
    
    const chapter = chapters[0];
    
    // 2. 查询用户Champion会员状态
    const [championStatus] = await db.execute(`
      SELECT 
        ucs.*,
        CASE 
          WHEN ucs.end_date > NOW() THEN 1
          ELSE 0
        END as is_valid
      FROM user_champion_subscription ucs
      WHERE ucs.user_id = ? AND ucs.novel_id = ? AND ucs.is_active = 1
      ORDER BY ucs.end_date DESC
      LIMIT 1
    `, [userId, chapter.novel_id]);
    
    const hasValidChampion = championStatus.length > 0 && championStatus[0].is_valid === 1;
    
    // 3. 查询该章节的所有阅读记录
    const [allReadingRecords] = await db.execute(`
      SELECT id, read_at, DATE(read_at) as read_date
      FROM reading_log 
      WHERE user_id = ? AND chapter_id = ?
      ORDER BY read_at ASC
    `, [userId, chapterId]);
    
    // 4. 查询该章节的解锁记录
    const [unlockRecords] = await db.execute(`
      SELECT id, unlock_method, status, unlocked_at, created_at
      FROM chapter_unlocks 
      WHERE user_id = ? AND chapter_id = ?
      ORDER BY created_at ASC
    `, [userId, chapterId]);
    
    // 5. 分析阅读记录
    const todayReadingRecords = allReadingRecords.filter(record => record.read_date === today);
    const historyReadingRecords = allReadingRecords.filter(record => record.read_date !== today);
    
    // 6. 检查今天是否有解锁记录
    const todayUnlockRecords = unlockRecords.filter(record => {
      const unlockDate = new Date(record.unlocked_at || record.created_at).toISOString().slice(0, 10);
      return unlockDate === today && record.status === 'unlocked';
    });
    
    // 7. 判断是否为新章节
    let isNewChapter = false;
    let reason = '';
    let details = {
      totalRecords: allReadingRecords.length,
      todayRecords: todayReadingRecords.length,
      historyRecords: historyReadingRecords.length,
      isTodayFirstRead: todayReadingRecords.length === 1,
      hasTodayUnlock: todayUnlockRecords.length > 0,
      hasValidChampion: hasValidChampion,
      unlock_price: chapter.unlock_price || 0
    };
    
    if (chapter.unlock_price && chapter.unlock_price > 0) {
      // A. 付费章节判断
      if (hasValidChampion) {
        // 有有效Champion会员: 只有今天首次阅读才算新章节
        if (todayReadingRecords.length === 1 && historyReadingRecords.length === 0) {
          isNewChapter = true;
          reason = '有有效Champion会员，今天首次阅读该章节';
        } else if (todayReadingRecords.length === 1 && historyReadingRecords.length > 0) {
          isNewChapter = false;
          reason = '有有效Champion会员，但以前阅读过该章节';
        } else if (todayReadingRecords.length > 1) {
          isNewChapter = false;
          reason = '有有效Champion会员，但今天已经阅读过该章节';
        } else {
          isNewChapter = false;
          reason = '有有效Champion会员，但今天没有阅读该章节';
        }
      } else {
        // 无Champion会员或已过期: 今天解锁就算新章节（不管是否今天首次阅读）
        if (todayUnlockRecords.length > 0) {
          isNewChapter = true;
          reason = '无Champion会员，今天解锁该章节';
        } else {
          isNewChapter = false;
          reason = '无Champion会员，今天未解锁该章节';
        }
      }
    } else {
      // B. 免费章节判断: 只有今天首次阅读才算新章节
      if (todayReadingRecords.length === 1 && historyReadingRecords.length === 0) {
        isNewChapter = true;
        reason = '免费章节，今天首次阅读该章节';
      } else if (todayReadingRecords.length === 1 && historyReadingRecords.length > 0) {
        isNewChapter = false;
        reason = '免费章节，但以前阅读过该章节';
      } else if (todayReadingRecords.length > 1) {
        isNewChapter = false;
        reason = '免费章节，但今天已经阅读过该章节';
      } else {
        isNewChapter = false;
        reason = '免费章节，但今天没有阅读该章节';
      }
    }
    
    return {
      isNewChapter,
      reason,
      details
    };
    
  } catch (error) {
    console.error('检查新章节失败:', error);
    return {
      isNewChapter: false,
      reason: '检查失败: ' + error.message
    };
  }
}

/**
 * 检查章节解锁状态
 */
async function checkChapterUnlockStatus(db, userId, chapterId, chapter, user) {
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
        reason: 'Champion会员永久解锁'
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
        reason: `通过${getUnlockMethodName(unlock.unlock_method)}解锁`
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
          reason: '时间解锁已完成'
        };
      } else {
        return {
          isUnlocked: false,
          unlockMethod: 'time_unlock',
          reason: '时间解锁等待中',
          unlockAt: unlockAt
        };
      }
    }
    
    // 5. 章节未解锁
    return {
      isUnlocked: false,
      unlockMethod: 'none',
      reason: '章节未解锁'
    };
    
  } catch (error) {
    console.error('检查解锁状态失败:', error);
    return {
      isUnlocked: false,
      unlockMethod: 'error',
      reason: '检查解锁状态失败: ' + error.message
    };
  }
}

/**
 * 获取解锁方法的中文名称
 */
function getUnlockMethodName(method) {
  const methodNames = {
    'free': '免费',
    'champion': 'Champion会员',
    'key': '钥匙解锁',
    'karma': 'Karma解锁',
    'time_unlock': '时间解锁',
    'subscription': '订阅解锁'
  };
  return methodNames[method] || method;
}

module.exports = router;
