const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld'
};

async function checkTimeUnlock() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    console.log('🔍 检查1362章节的时间解锁记录...');
    
    const [results] = await db.execute(`
      SELECT id, user_id, chapter_id, unlock_method, status, 
             created_at, first_clicked_at, unlock_at, unlocked_at
      FROM chapter_unlocks 
      WHERE chapter_id = 1362 AND user_id = 1 AND unlock_method = 'time_unlock'
      ORDER BY created_at DESC
    `);
    
    console.log('📊 找到', results.length, '条记录:');
    results.forEach((record, index) => {
      console.log(`${index + 1}. ID: ${record.id}`);
      console.log(`   状态: ${record.status}`);
      console.log(`   创建时间: ${record.created_at}`);
      console.log(`   首次点击时间: ${record.first_clicked_at}`);
      console.log(`   解锁时间: ${record.unlock_at}`);
      console.log(`   解锁完成时间: ${record.unlocked_at}`);
      console.log('   ---');
    });
    
    if (results.length > 0) {
      const record = results[0];
      const now = new Date();
      const unlockAt = new Date(record.unlock_at);
      const timeRemaining = unlockAt.getTime() - now.getTime();
      
      console.log('⏰ 时间计算:');
      console.log('   当前时间:', now.toISOString());
      console.log('   解锁时间:', unlockAt.toISOString());
      console.log('   剩余时间(毫秒):', timeRemaining);
      console.log('   剩余时间(小时):', Math.floor(timeRemaining / (1000 * 60 * 60)));
      console.log('   剩余时间(分钟):', Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60)));
      console.log('   剩余时间(秒):', Math.floor((timeRemaining % (1000 * 60)) / 1000));
      
      // 检查时间设置是否正确
      const createdTime = new Date(record.created_at);
      const timeDiff = unlockAt.getTime() - createdTime.getTime();
      const expectedHours = 24;
      const actualHours = timeDiff / (1000 * 60 * 60);
      
      console.log('🔍 时间设置检查:');
      console.log('   创建时间到解锁时间差:', actualHours, '小时');
      console.log('   是否接近24小时:', Math.abs(actualHours - expectedHours) < 1 ? '✅' : '❌');
    }
    
  } catch (error) {
    console.error('❌ 查询失败:', error.message);
  } finally {
    if (db) await db.end();
  }
}

checkTimeUnlock();
