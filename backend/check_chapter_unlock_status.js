// 查询章节解锁状态和阅读记录
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function checkChapterUnlockStatus() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    const today = new Date().toISOString().slice(0, 10);
    console.log(`\n🔍 查询今天 (${today}) 阅读的章节解锁状态...\n`);
    
    // 今天阅读的章节ID
    const chapterIds = [1352, 1353, 1354, 1356];
    
    for (const chapterId of chapterIds) {
      console.log(`\n📖 章节 ${chapterId} 的详细信息：`);
      
      // 1. 查询章节基本信息
      const [chapters] = await db.execute(`
        SELECT 
          c.id,
          c.chapter_number,
          c.title as chapter_title,
          c.is_premium,
          c.free_unlock_time,
          n.id as novel_id,
          n.title as novel_title
        FROM chapter c
        JOIN novel n ON c.novel_id = n.id
        WHERE c.id = ?
      `, [chapterId]);
      
      if (chapters.length === 0) {
        console.log(`❌ 章节 ${chapterId} 不存在`);
        continue;
      }
      
      const chapter = chapters[0];
      console.log(`📚 小说: ${chapter.novel_title}`);
      console.log(`📄 章节: 第${chapter.chapter_number}章 - ${chapter.chapter_title}`);
      console.log(`💰 是否付费: ${chapter.is_premium ? '是' : '否'}`);
      if (chapter.free_unlock_time) {
        console.log(`🕐 免费解锁时间: ${chapter.free_unlock_time}`);
      }
      
      // 2. 查询用户1的Champion会员状态
      const [championStatus] = await db.execute(`
        SELECT 
          ucs.*,
          CASE 
            WHEN ucs.end_date > NOW() THEN '有效'
            ELSE '已过期'
          END as status
        FROM user_champion_subscription ucs
        WHERE ucs.user_id = 1 AND ucs.novel_id = ? AND ucs.is_active = 1
        ORDER BY ucs.end_date DESC
        LIMIT 1
      `, [chapter.novel_id]);
      
      if (championStatus.length > 0) {
        const champion = championStatus[0];
        console.log(`👑 Champion会员状态: ${champion.status}`);
        console.log(`📅 会员到期时间: ${champion.end_date}`);
      } else {
        console.log(`👑 Champion会员状态: 无会员资格`);
      }
      
      // 3. 查询章节解锁记录
      const [unlockRecords] = await db.execute(`
        SELECT 
          cu.*,
          DATE(cu.unlocked_at) as unlock_date,
          DATE(cu.created_at) as create_date
        FROM chapter_unlocks cu
        WHERE cu.user_id = 1 AND cu.chapter_id = ?
        ORDER BY cu.created_at ASC
      `, [chapterId]);
      
      if (unlockRecords.length > 0) {
        console.log(`🔓 解锁记录 (${unlockRecords.length} 条):`);
        unlockRecords.forEach((record, index) => {
          console.log(`   ${index + 1}. 解锁方式: ${record.unlock_method}`);
          console.log(`      状态: ${record.status}`);
          console.log(`      解锁时间: ${record.unlocked_at || '未解锁'}`);
          console.log(`      创建时间: ${record.created_at}`);
          console.log(`      解锁日期: ${record.unlock_date || record.create_date}`);
        });
      } else {
        console.log(`🔓 解锁记录: 无解锁记录`);
      }
      
      // 4. 查询阅读记录
      const [readingRecords] = await db.execute(`
        SELECT 
          rl.*,
          DATE(rl.read_at) as read_date
        FROM reading_log rl
        WHERE rl.user_id = 1 AND rl.chapter_id = ?
        ORDER BY rl.read_at ASC
      `, [chapterId]);
      
      if (readingRecords.length > 0) {
        console.log(`📖 阅读记录 (${readingRecords.length} 条):`);
        readingRecords.forEach((record, index) => {
          console.log(`   ${index + 1}. 阅读时间: ${record.read_at}`);
          console.log(`      阅读日期: ${record.read_date}`);
        });
      } else {
        console.log(`📖 阅读记录: 无阅读记录`);
      }
      
      // 5. 分析新章节判断
      console.log(`\n🎯 新章节判断分析:`);
      
      // 检查今天是否首次阅读
      const todayReadingCount = readingRecords.filter(record => record.read_date === today).length;
      const historyReadingCount = readingRecords.filter(record => record.read_date !== today).length;
      
      console.log(`📅 今天阅读次数: ${todayReadingCount}`);
      console.log(`📚 历史阅读次数: ${historyReadingCount}`);
      
      // 检查今天是否有解锁记录
      const todayUnlockRecords = unlockRecords.filter(record => {
        const unlockDate = record.unlock_date || record.create_date;
        return unlockDate === today && record.status === 'unlocked';
      });
      
      console.log(`🔓 今天解锁记录: ${todayUnlockRecords.length} 条`);
      
      // 判断逻辑
      let isNewChapter = false;
      let reason = '';
      
      if (chapter.is_premium) {
        // 付费章节
        if (championStatus.length > 0 && championStatus[0].status === '有效') {
          // 有有效Champion会员
          if (todayReadingCount === 1 && historyReadingCount === 0) {
            isNewChapter = true;
            reason = '有有效Champion会员，今天首次阅读';
          } else {
            isNewChapter = false;
            reason = '有有效Champion会员，但今天非首次阅读或以前阅读过';
          }
        } else {
          // 无Champion会员或已过期
          if (todayUnlockRecords.length > 0 && todayReadingCount === 1) {
            isNewChapter = true;
            reason = '今天解锁且今天首次阅读';
          } else {
            isNewChapter = false;
            reason = '今天未解锁或今天非首次阅读';
          }
        }
      } else {
        // 免费章节
        if (todayReadingCount === 1 && historyReadingCount === 0) {
          isNewChapter = true;
          reason = '免费章节，今天首次阅读';
        } else {
          isNewChapter = false;
          reason = '免费章节，但今天非首次阅读或以前阅读过';
        }
      }
      
      console.log(`✅ 判断结果: ${isNewChapter ? '是新章节' : '不是新章节'}`);
      console.log(`📝 判断原因: ${reason}`);
      
      // 6. 检查解锁时间
      if (unlockRecords.length > 0) {
        const firstUnlock = unlockRecords[0];
        const unlockDate = firstUnlock.unlock_date || firstUnlock.create_date;
        console.log(`🕐 首次解锁日期: ${unlockDate}`);
        
        if (unlockDate < today) {
          console.log(`⚠️  警告: 章节在 ${unlockDate} 就已经解锁，今天阅读不应该算作新章节！`);
        }
      }
      
      console.log(`\n${'='.repeat(80)}\n`);
    }
    
  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行查询
checkChapterUnlockStatus();
