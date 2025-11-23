const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld'
};

async function checkRecords() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    console.log('📊 检查数据库记录...');
    
    const [results] = await db.execute(`
      SELECT id, user_id, chapter_id, unlock_method, status, next_chapter_id
      FROM chapter_unlocks 
      WHERE user_id = 1 AND chapter_id IN (1362, 1363) 
      ORDER BY id DESC
    `);
    
    console.log(`找到 ${results.length} 条记录:`);
    results.forEach((record, index) => {
      console.log(`   ${index + 1}. ID: ${record.id}, 章节: ${record.chapter_id}, 状态: ${record.status}, 下一章节: ${record.next_chapter_id || 'N/A'}`);
    });
    
  } catch (error) {
    console.error('❌ 检查失败:', error.message);
  } finally {
    if (db) await db.end();
  }
}

checkRecords();
