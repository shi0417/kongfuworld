const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld'
};

async function fixExistingTimeUnlock() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    console.log('🔧 修复现有的时间解锁记录...');
    
    // 查找所有pending状态的时间解锁记录
    const [results] = await db.execute(`
      SELECT id, user_id, chapter_id, first_clicked_at, unlock_at, created_at
      FROM chapter_unlocks 
      WHERE unlock_method = 'time_unlock' AND status = 'pending'
      ORDER BY created_at DESC
    `);
    
    console.log('📊 找到', results.length, '条pending的时间解锁记录:');
    
    for (const record of results) {
      const firstClickedAt = new Date(record.first_clicked_at);
      const newUnlockAt = new Date(firstClickedAt.getTime() + 23 * 60 * 60 * 1000); // 23小时后
      
      console.log(`\n🔍 处理记录 ID: ${record.id}`);
      console.log(`   章节ID: ${record.chapter_id}`);
      console.log(`   首次点击时间: ${record.first_clicked_at}`);
      console.log(`   原解锁时间: ${record.unlock_at}`);
      console.log(`   新解锁时间: ${newUnlockAt.toISOString()}`);
      
      // 更新解锁时间
      await db.execute(`
        UPDATE chapter_unlocks 
        SET unlock_at = ?, updated_at = NOW()
        WHERE id = ?
      `, [newUnlockAt, record.id]);
      
      console.log(`   ✅ 已更新为23小时解锁`);
    }
    
    console.log('\n🎉 所有记录已修复完成！');
    
  } catch (error) {
    console.error('❌ 修复失败:', error.message);
  } finally {
    if (db) await db.end();
  }
}

fixExistingTimeUnlock();
