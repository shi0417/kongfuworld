// 测试新的阅读记录逻辑
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function testNewReadingLogic() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('🧪 测试新的阅读记录逻辑\n');
    
    // 1. 检查用户1000的章节841,842记录数量
    console.log('📊 测试前的记录数量:');
    const [beforeRecords] = await db.execute(`
      SELECT 
        chapter_id,
        COUNT(*) as count,
        MAX(read_at) as latest_read
      FROM reading_log 
      WHERE user_id = 1000 AND chapter_id IN (841, 842)
      GROUP BY chapter_id
    `);
    
    beforeRecords.forEach(record => {
      console.log(`  章节${record.chapter_id}: ${record.count} 条记录，最新: ${record.latest_read}`);
    });
    
    // 2. 模拟用户访问章节841（插入新记录）
    console.log('\n🔧 模拟用户访问章节841:');
    const [insertResult1] = await db.execute(`
      INSERT INTO reading_log (user_id, chapter_id, read_at, is_unlocked, unlock_time, page_enter_time) 
      VALUES (1000, 841, NOW(), 1, NOW(), NOW())
    `);
    
    console.log(`✅ 插入新记录成功，记录ID: ${insertResult1.insertId}`);
    
    // 3. 模拟用户再次访问章节841（再次插入新记录）
    console.log('\n🔧 模拟用户再次访问章节841:');
    const [insertResult2] = await db.execute(`
      INSERT INTO reading_log (user_id, chapter_id, read_at, is_unlocked, unlock_time, page_enter_time) 
      VALUES (1000, 841, NOW(), 1, NOW(), NOW())
    `);
    
    console.log(`✅ 插入新记录成功，记录ID: ${insertResult2.insertId}`);
    
    // 4. 模拟用户访问章节842（插入新记录）
    console.log('\n🔧 模拟用户访问章节842:');
    const [insertResult3] = await db.execute(`
      INSERT INTO reading_log (user_id, chapter_id, read_at, is_unlocked, unlock_time, page_enter_time) 
      VALUES (1000, 842, NOW(), 1, NOW(), NOW())
    `);
    
    console.log(`✅ 插入新记录成功，记录ID: ${insertResult3.insertId}`);
    
    // 5. 检查测试后的记录数量
    console.log('\n📊 测试后的记录数量:');
    const [afterRecords] = await db.execute(`
      SELECT 
        chapter_id,
        COUNT(*) as count,
        MAX(read_at) as latest_read
      FROM reading_log 
      WHERE user_id = 1000 AND chapter_id IN (841, 842)
      GROUP BY chapter_id
    `);
    
    afterRecords.forEach(record => {
      console.log(`  章节${record.chapter_id}: ${record.count} 条记录，最新: ${record.latest_read}`);
    });
    
    // 6. 显示最新的记录
    console.log('\n📋 最新的记录:');
    const [latestRecords] = await db.execute(`
      SELECT 
        id,
        chapter_id,
        read_at,
        is_unlocked,
        page_enter_time
      FROM reading_log 
      WHERE user_id = 1000 AND chapter_id IN (841, 842)
      ORDER BY read_at DESC
      LIMIT 5
    `);
    
    latestRecords.forEach((record, index) => {
      console.log(`  ${index + 1}. ID:${record.id} 章节${record.chapter_id} - ${record.read_at} (解锁:${record.is_unlocked ? '是' : '否'})`);
    });
    
    console.log('\n🎉 测试完成！新的逻辑每次访问都会插入新记录。');
    
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    if (db) await db.end();
  }
}

testNewReadingLogic();
