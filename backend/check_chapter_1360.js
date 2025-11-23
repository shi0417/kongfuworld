// 检查章节1360的解锁和阅读记录情况
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function checkChapter1360() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    const today = new Date().toISOString().slice(0, 10);
    console.log(`\n🔍 检查章节1360的解锁和阅读记录情况 (${today})\n`);
    
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
      WHERE c.id = 1360
    `);
    
    if (chapters.length === 0) {
      console.log('❌ 章节1360不存在');
      return;
    }
    
    const chapter = chapters[0];
    console.log(`📚 小说: ${chapter.novel_title}`);
    console.log(`📄 章节: 第${chapter.chapter_number}章 - ${chapter.chapter_title}`);
    console.log(`💰 是否付费: ${chapter.is_premium ? '是' : '否'}`);
    
    // 2. 查询章节解锁记录
    const [unlockRecords] = await db.execute(`
      SELECT 
        cu.*,
        DATE(cu.unlocked_at) as unlock_date,
        DATE(cu.created_at) as create_date
      FROM chapter_unlocks cu
      WHERE cu.user_id = 1 AND cu.chapter_id = 1360
      ORDER BY cu.created_at ASC
    `);
    
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
    
    // 3. 查询阅读记录
    const [readingRecords] = await db.execute(`
      SELECT 
        rl.*,
        DATE(rl.read_at) as read_date
      FROM reading_log rl
      WHERE rl.user_id = 1 AND rl.chapter_id = 1360
      ORDER BY rl.read_at ASC
    `);
    
    if (readingRecords.length > 0) {
      console.log(`📖 阅读记录 (${readingRecords.length} 条):`);
      readingRecords.forEach((record, index) => {
        console.log(`   ${index + 1}. 阅读时间: ${record.read_at}`);
        console.log(`      阅读日期: ${record.read_date}`);
        console.log(`      是否解锁: ${record.is_unlocked ? '是' : '否'}`);
        console.log(`      解锁时间: ${record.unlock_time || '无'}`);
        console.log('');
      });
    } else {
      console.log(`📖 阅读记录: 无阅读记录`);
    }
    
    // 4. 分析时间顺序
    console.log('⏰ 时间顺序分析:');
    
    if (unlockRecords.length > 0 && readingRecords.length > 0) {
      const latestReading = readingRecords[readingRecords.length - 1];
      const latestUnlock = unlockRecords[unlockRecords.length - 1];
      
      const readingTime = new Date(latestReading.read_at);
      const unlockTime = new Date(latestUnlock.unlocked_at);
      
      console.log(`   阅读时间: ${readingTime.toISOString()}`);
      console.log(`   解锁时间: ${unlockTime.toISOString()}`);
      console.log(`   时间差: ${unlockTime.getTime() - readingTime.getTime()} 毫秒`);
      
      if (unlockTime > readingTime) {
        console.log('   ⚠️  问题: 解锁时间晚于阅读时间！');
        console.log('   这说明用户阅读时章节还没有解锁，但阅读后立即解锁了');
      } else {
        console.log('   ✅ 解锁时间早于或等于阅读时间');
      }
    }
    
    // 5. 分析新章节判断
    console.log('\n🎯 新章节判断分析:');
    
    const todayReadingCount = readingRecords.filter(record => {
      const recordDate = record.read_date.toISOString().slice(0, 10);
      return recordDate === today;
    }).length;
    
    const historyReadingCount = readingRecords.filter(record => {
      const recordDate = record.read_date.toISOString().slice(0, 10);
      return recordDate !== today;
    }).length;
    
    const todayUnlockRecords = unlockRecords.filter(record => {
      const unlockDate = new Date(record.unlocked_at || record.created_at).toISOString().slice(0, 10);
      return unlockDate === today && record.status === 'unlocked';
    });
    
    console.log(`   今天阅读次数: ${todayReadingCount}`);
    console.log(`   历史阅读次数: ${historyReadingCount}`);
    console.log(`   今天解锁记录: ${todayUnlockRecords.length} 条`);
    
    // 根据您的判断标准
    let isNewChapter = false;
    let reason = '';
    
    if (chapter.is_premium) {
      // 付费章节
      if (todayUnlockRecords.length > 0) {
        isNewChapter = true;
        reason = '无Champion会员，今天解锁该章节';
      } else {
        isNewChapter = false;
        reason = '无Champion会员，今天未解锁该章节';
      }
    } else {
      // 免费章节
      if (todayReadingCount === 1 && historyReadingCount === 0) {
        isNewChapter = true;
        reason = '免费章节，今天首次阅读该章节';
      } else {
        isNewChapter = false;
        reason = '免费章节，但今天非首次阅读或以前阅读过';
      }
    }
    
    console.log(`\n✅ 判断结果: ${isNewChapter ? '是新章节' : '不是新章节'}`);
    console.log(`📝 判断原因: ${reason}`);
    
    // 6. 问题分析
    console.log('\n🔍 问题分析:');
    console.log('   1. 时间解锁到期点: 2025-10-18 10:01:00');
    console.log('   2. 用户阅读时间: 2025-10-18 10:02:55');
    console.log('   3. 实际解锁时间: 2025-10-18 10:02:55');
    console.log('   4. 问题: 程序记录顺序有问题');
    
    console.log('\n💡 建议解决方案:');
    console.log('   1. 在记录reading_log之前，先检查时间解锁状态');
    console.log('   2. 如果时间解锁已到期，先更新解锁状态');
    console.log('   3. 然后再记录阅读日志');
    console.log('   4. 最后进行新章节判断');
    
  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行检查
checkChapter1360();
