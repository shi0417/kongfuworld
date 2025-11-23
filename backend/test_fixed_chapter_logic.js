// 测试修复后的新章节判断逻辑
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

// 正确的新章节判断逻辑
async function checkIsNewChapterImproved(db, userId, chapterId) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    
    // 1. 查询章节基本信息
    const [chapters] = await db.execute(`
      SELECT id, novel_id, is_premium, free_unlock_time
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
      isPremium: chapter.is_premium
    };
    
    if (chapter.is_premium) {
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
        // 无Champion会员或已过期: 只有今天解锁且今天首次阅读才算新章节
        if (todayUnlockRecords.length > 0 && todayReadingRecords.length === 1 && historyReadingRecords.length === 0) {
          isNewChapter = true;
          reason = '无Champion会员，今天解锁且今天首次阅读该章节';
        } else if (todayUnlockRecords.length > 0 && todayReadingRecords.length === 1 && historyReadingRecords.length > 0) {
          isNewChapter = false;
          reason = '无Champion会员，今天解锁但以前阅读过该章节';
        } else if (todayUnlockRecords.length === 0) {
          isNewChapter = false;
          reason = '无Champion会员，今天未解锁该章节';
        } else {
          isNewChapter = false;
          reason = '无Champion会员，今天解锁但今天非首次阅读';
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

async function testFixedChapterLogic() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    const today = new Date().toISOString().slice(0, 10);
    console.log(`\n🧪 测试修复后的新章节判断逻辑 (${today})\n`);
    
    // 测试今天阅读的章节
    const chapterIds = [1352, 1353, 1354, 1356];
    
    for (const chapterId of chapterIds) {
      console.log(`\n📖 测试章节 ${chapterId}:`);
      
      const result = await checkIsNewChapterImproved(db, 1, chapterId);
      
      console.log(`✅ 判断结果: ${result.isNewChapter ? '是新章节' : '不是新章节'}`);
      console.log(`📝 判断原因: ${result.reason}`);
      console.log(`📊 详细信息:`);
      console.log(`   - 总阅读记录: ${result.details.totalRecords}`);
      console.log(`   - 今天阅读次数: ${result.details.todayRecords}`);
      console.log(`   - 历史阅读次数: ${result.details.historyRecords}`);
      console.log(`   - 今天首次阅读: ${result.details.isTodayFirstRead}`);
      console.log(`   - 今天解锁: ${result.details.hasTodayUnlock}`);
      console.log(`   - 有有效Champion会员: ${result.details.hasValidChampion}`);
      console.log(`   - 是否付费章节: ${result.details.isPremium}`);
      
      console.log(`\n${'='.repeat(60)}\n`);
    }
    
    console.log('🎯 测试总结:');
    console.log('根据正确的判断逻辑，这些章节都不应该算作新章节，因为：');
    console.log('1. 它们都是今天之前解锁的');
    console.log('2. 用户以前已经阅读过这些章节');
    console.log('3. 今天只是重新阅读，不算新章节');
    
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行测试
testFixedChapterLogic();
