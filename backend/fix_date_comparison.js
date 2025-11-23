// 修复日期比较问题
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function debugDateComparison() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    const today = new Date().toISOString().slice(0, 10);
    console.log(`\n🔍 调试日期比较问题 (${today})\n`);
    
    // 1. 查询阅读记录
    const [readingRecords] = await db.execute(`
      SELECT 
        rl.*,
        DATE(rl.read_at) as read_date
      FROM reading_log rl
      WHERE rl.user_id = 1 AND rl.chapter_id = 1355
      ORDER BY rl.read_at ASC
    `);
    
    console.log('📖 阅读记录详情:');
    readingRecords.forEach((record, index) => {
      const recordDate = record.read_date;
      const isToday = recordDate === today;
      console.log(`   ${index + 1}. 阅读时间: ${record.read_at}`);
      console.log(`      阅读日期: ${recordDate}`);
      console.log(`      是否今天: ${isToday}`);
      console.log(`      今天日期: ${today}`);
      console.log('');
    });
    
    // 2. 查询解锁记录
    const [unlockRecords] = await db.execute(`
      SELECT 
        cu.*,
        DATE(cu.unlocked_at) as unlock_date,
        DATE(cu.created_at) as create_date
      FROM chapter_unlocks cu
      WHERE cu.user_id = 1 AND cu.chapter_id = 1355
      ORDER BY cu.created_at ASC
    `);
    
    console.log('🔓 解锁记录详情:');
    unlockRecords.forEach((record, index) => {
      const unlockDate = record.unlock_date || record.create_date;
      const isToday = unlockDate === today;
      console.log(`   ${index + 1}. 解锁时间: ${record.unlocked_at}`);
      console.log(`      解锁日期: ${unlockDate}`);
      console.log(`      是否今天: ${isToday}`);
      console.log(`      今天日期: ${today}`);
      console.log('');
    });
    
    // 3. 手动计算
    const todayReadingRecords = readingRecords.filter(record => {
      const recordDate = record.read_date;
      return recordDate === today;
    });
    
    const todayUnlockRecords = unlockRecords.filter(record => {
      const unlockDate = record.unlock_date || record.create_date;
      return unlockDate === today && record.status === 'unlocked';
    });
    
    console.log('📊 手动计算结果:');
    console.log(`   今天阅读记录: ${todayReadingRecords.length} 条`);
    console.log(`   今天解锁记录: ${todayUnlockRecords.length} 条`);
    
    // 4. 正确的判断逻辑
    const historyReadingRecords = readingRecords.filter(record => record.read_date !== today);
    
    console.log('\n🎯 正确的判断逻辑:');
    console.log(`   今天阅读次数: ${todayReadingRecords.length}`);
    console.log(`   历史阅读次数: ${historyReadingRecords.length}`);
    console.log(`   今天解锁次数: ${todayUnlockRecords.length}`);
    
    // 判断是否为新章节
    let isNewChapter = false;
    let reason = '';
    
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
    
    console.log(`\n✅ 判断结果: ${isNewChapter ? '是新章节' : '不是新章节'}`);
    console.log(`📝 判断原因: ${reason}`);
    
  } catch (error) {
    console.error('调试失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行调试
debugDateComparison();
