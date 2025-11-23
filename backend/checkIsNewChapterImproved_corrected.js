// 修复后的完整新章节判断逻辑（正确的版本）
async function checkIsNewChapterImproved(db, userId, chapterId) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    
    // 1. 查询章节基本信息
    const [chapters] = await db.execute(`
      SELECT id, novel_id, is_premium
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
    
    // 5. 分析阅读记录（修复时区问题）
    const todayReadingRecords = allReadingRecords.filter(record => {
      // 使用UTC时间避免时区问题
      const recordDate = new Date(record.read_at).toISOString().slice(0, 10);
      return recordDate === today;
    });
    const historyReadingRecords = allReadingRecords.filter(record => {
      const recordDate = new Date(record.read_at).toISOString().slice(0, 10);
      return recordDate !== today;
    });
    
    // 6. 检查今天是否有解锁记录
    const todayUnlockRecords = unlockRecords.filter(record => {
      const unlockDate = new Date(record.unlocked_at || record.created_at).toISOString().slice(0, 10);
      return unlockDate === today && record.status === 'unlocked';
    });
    
    // 7. 检查Champion会员解锁（今天首次阅读且有效Champion会员）
    const isChampionUnlocked = hasValidChampion && todayReadingRecords.length === 1 && historyReadingRecords.length === 0;
    
    // 8. 判断是否为新章节
    let isNewChapter = false;
    let reason = '';
    let details = {
      totalRecords: allReadingRecords.length,
      todayRecords: todayReadingRecords.length,
      historyRecords: historyReadingRecords.length,
      isTodayFirstRead: todayReadingRecords.length === 1,
      hasTodayUnlock: todayUnlockRecords.length > 0,
      hasValidChampion: hasValidChampion,
      isPremium: chapter.is_premium,
      isChampionUnlocked: isChampionUnlocked
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
    
    // 9. 特殊处理：Champion会员解锁的章节（覆盖之前的判断）
    if (isChampionUnlocked) {
      isNewChapter = true;
      reason = 'Champion会员解锁，今天首次阅读该章节';
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

module.exports = { checkIsNewChapterImproved };
