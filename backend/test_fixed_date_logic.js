// 测试修复后的日期比较逻辑
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function testFixedDateLogic() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    const today = new Date().toISOString().slice(0, 10);
    console.log(`\n🧪 测试修复后的日期比较逻辑 (${today})\n`);
    
    // 1. 查询阅读记录
    const [allReadingRecords] = await db.execute(`
      SELECT id, read_at, DATE(read_at) as read_date
      FROM reading_log 
      WHERE user_id = 1 AND chapter_id = 1355
      ORDER BY read_at ASC
    `);
    
    // 2. 查询解锁记录
    const [unlockRecords] = await db.execute(`
      SELECT id, unlock_method, status, unlocked_at, created_at
      FROM chapter_unlocks 
      WHERE user_id = 1 AND chapter_id = 1355
      ORDER BY created_at ASC
    `);
    
    // 3. 使用修复后的日期比较逻辑
    const todayReadingRecords = allReadingRecords.filter(record => {
      const recordDate = record.read_date.toISOString().slice(0, 10);
      return recordDate === today;
    });
    
    const historyReadingRecords = allReadingRecords.filter(record => {
      const recordDate = record.read_date.toISOString().slice(0, 10);
      return recordDate !== today;
    });
    
    const todayUnlockRecords = unlockRecords.filter(record => {
      const unlockDate = new Date(record.unlocked_at || record.created_at).toISOString().slice(0, 10);
      return unlockDate === today && record.status === 'unlocked';
    });
    
    console.log('📊 修复后的计算结果:');
    console.log(`   今天阅读记录: ${todayReadingRecords.length} 条`);
    console.log(`   历史阅读记录: ${historyReadingRecords.length} 条`);
    console.log(`   今天解锁记录: ${todayUnlockRecords.length} 条`);
    
    // 4. 判断是否为新章节（使用修复后的逻辑）
    let isNewChapter = false;
    let reason = '';
    
    // 无Champion会员或已过期: 今天解锁就算新章节（不管是否今天首次阅读）
    if (todayUnlockRecords.length > 0) {
      isNewChapter = true;
      reason = '无Champion会员，今天解锁该章节';
    } else {
      isNewChapter = false;
      reason = '无Champion会员，今天未解锁该章节';
    }
    
    console.log(`\n✅ 判断结果: ${isNewChapter ? '是新章节' : '不是新章节'}`);
    console.log(`📝 判断原因: ${reason}`);
    
    // 5. 详细分析
    console.log(`\n🔍 详细分析:`);
    console.log(`   章节1355今天解锁: ${todayUnlockRecords.length > 0 ? '是' : '否'}`);
    console.log(`   章节1355今天阅读: ${todayReadingRecords.length} 次`);
    console.log(`   章节1355历史阅读: ${historyReadingRecords.length} 次`);
    
    if (todayUnlockRecords.length > 0) {
      console.log(`   解锁方式: ${todayUnlockRecords[0].unlock_method}`);
      console.log(`   解锁时间: ${todayUnlockRecords[0].unlocked_at}`);
    }
    
    // 6. 根据您的判断标准分析
    console.log(`\n🎯 根据您的判断标准:`);
    console.log(`   A. 章节是锁定付费的: 是`);
    console.log(`   1. 用户没有Champion会员: 是`);
    console.log(`   2. 该章节在今天被用户解锁: ${todayUnlockRecords.length > 0 ? '是' : '否'}`);
    console.log(`   3. 触发判定新章节的时间是用户解锁该章节的时候: ${todayUnlockRecords.length > 0 ? '是' : '否'}`);
    
    if (todayUnlockRecords.length > 0) {
      console.log(`\n✅ 结论: 应该算作新章节！`);
      console.log(`   原因: 章节今天解锁，符合判断标准A.1`);
    } else {
      console.log(`\n❌ 结论: 不算新章节`);
      console.log(`   原因: 章节今天没有解锁`);
    }
    
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行测试
testFixedDateLogic();
