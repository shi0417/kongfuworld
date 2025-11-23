const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld'
};

async function checkExistingUnlock() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    console.log('🔍 检查现有解锁记录...');
    
    // 检查用户1和章节1362的记录
    const [records] = await db.execute(`
      SELECT * FROM chapter_unlocks 
      WHERE user_id = 1 AND chapter_id = 1362
    `);
    
    console.log(`找到 ${records.length} 条记录:`);
    records.forEach((record, index) => {
      console.log(`  ${index + 1}. ID: ${record.id}, 方法: ${record.unlock_method}, 状态: ${record.status}, 消耗: ${record.cost}`);
      console.log(`     创建时间: ${record.created_at}, 解锁时间: ${record.unlocked_at}`);
    });
    
    // 检查唯一约束
    const [constraints] = await db.execute(`
      SELECT CONSTRAINT_NAME, COLUMN_NAME 
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_NAME = 'chapter_unlocks' 
      AND TABLE_SCHEMA = 'kongfuworld'
      AND CONSTRAINT_NAME = 'unique_user_chapter'
    `);
    
    console.log('\n🔍 唯一约束信息:');
    if (constraints.length > 0) {
      console.log(`约束名称: ${constraints[0].CONSTRAINT_NAME}`);
      console.log(`列名: ${constraints[0].COLUMN_NAME}`);
    } else {
      console.log('未找到unique_user_chapter约束');
    }
    
  } catch (error) {
    console.error('❌ 检查失败:', error.message);
  } finally {
    if (db) await db.end();
  }
}

checkExistingUnlock();
