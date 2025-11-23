// 更新现有记录的时间追踪字段
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function updateExistingRecords() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('🔧 更新现有记录的时间追踪字段\n');
    
    // 1. 查找用户1000的章节841,842记录
    const [records] = await db.execute(`
      SELECT id, user_id, chapter_id, read_at, page_enter_time
      FROM reading_log 
      WHERE user_id = 1000 AND chapter_id IN (841, 842)
      ORDER BY read_at DESC
    `);
    
    console.log(`找到 ${records.length} 条记录需要更新`);
    
    for (const record of records) {
      // 模拟用户停留5分钟
      const enterTime = new Date(record.read_at);
      const exitTime = new Date(enterTime.getTime() + 5 * 60 * 1000); // 5分钟后
      const duration = 300; // 5分钟
      
      await db.execute(`
        UPDATE reading_log 
        SET page_enter_time = ?, page_exit_time = ?, stay_duration = ?
        WHERE id = ?
      `, [enterTime, exitTime, duration, record.id]);
      
      console.log(`✅ 更新记录 ${record.id}: 章节${record.chapter_id} - 停留${duration}秒`);
    }
    
    // 2. 验证更新结果
    console.log('\n📊 验证更新结果:');
    const [updatedRecords] = await db.execute(`
      SELECT 
        user_id, 
        chapter_id, 
        read_at,
        page_enter_time,
        page_exit_time,
        stay_duration
      FROM reading_log 
      WHERE user_id = 1000 AND chapter_id IN (841, 842)
      ORDER BY read_at DESC
    `);
    
    updatedRecords.forEach((record, index) => {
      console.log(`   ${index + 1}. 章节${record.chapter_id}:`);
      console.log(`      进入时间: ${record.page_enter_time}`);
      console.log(`      离开时间: ${record.page_exit_time}`);
      console.log(`      停留时长: ${record.stay_duration} 秒`);
      console.log('');
    });
    
    console.log('🎉 现有记录更新完成！');
    
  } catch (error) {
    console.error('更新失败:', error);
  } finally {
    if (db) await db.end();
  }
}

updateExistingRecords();
