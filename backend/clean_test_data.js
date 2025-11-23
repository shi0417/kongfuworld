const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld'
};

async function cleanTestData() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    console.log('🧹 清理测试数据...');
    
    // 删除1362和1363章节的pending时间解锁记录
    await db.execute(`
      DELETE FROM chapter_unlocks 
      WHERE user_id = 1 AND chapter_id IN (1362, 1363) AND unlock_method = 'time_unlock' AND status = 'pending'
    `);
    
    console.log('✅ 测试数据已清理');
    
  } catch (error) {
    console.error('❌ 清理失败:', error.message);
  } finally {
    if (db) await db.end();
  }
}

cleanTestData();
