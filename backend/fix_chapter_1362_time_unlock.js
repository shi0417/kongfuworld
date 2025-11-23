// 修复章节1362的时间解锁问题
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function fixChapter1362TimeUnlock() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('\n🔧 修复章节1362的时间解锁问题\n');
    
    // 1. 查看当前1362章节的解锁记录
    console.log('📊 1. 查看当前1362章节的解锁记录:');
    const [records] = await db.execute(`
      SELECT * FROM chapter_unlocks 
      WHERE user_id = 1 AND chapter_id = 1362 
      ORDER BY created_at DESC
    `);
    
    if (records.length === 0) {
      console.log('   无解锁记录');
    } else {
      records.forEach((record, index) => {
        console.log(`   ${index + 1}. ID: ${record.id}`);
        console.log(`      解锁方法: ${record.unlock_method}`);
        console.log(`      状态: ${record.status}`);
        console.log(`      创建时间: ${record.created_at}`);
        console.log(`      解锁时间: ${record.unlock_at}`);
        console.log(`      首次点击时间: ${record.first_clicked_at || 'NULL'}`);
        console.log(`      解锁完成时间: ${record.unlocked_at || 'NULL'}`);
      });
    }
    
    // 2. 删除有问题的记录（如果有的话）
    console.log('\n🗑️ 2. 清理有问题的记录:');
    const [deleteResult] = await db.execute(`
      DELETE FROM chapter_unlocks 
      WHERE user_id = 1 AND chapter_id = 1362 AND status = 'pending'
    `);
    console.log(`   删除了 ${deleteResult.affectedRows} 条记录`);
    
    // 3. 创建新的时间解锁记录，包含first_clicked_at
    console.log('\n⏰ 3. 创建新的时间解锁记录:');
    const now = new Date();
    const unlockAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24小时后解锁
    
    const [insertResult] = await db.execute(`
      INSERT INTO chapter_unlocks (
        user_id, chapter_id, unlock_method, status, 
        created_at, first_clicked_at, unlock_at, updated_at
      ) VALUES (?, ?, 'time_unlock', 'pending', ?, ?, ?, ?)
    `, [1, 1362, now, now, unlockAt, now]);
    
    console.log(`   新记录ID: ${insertResult.insertId}`);
    console.log(`   创建时间: ${now.toISOString()}`);
    console.log(`   首次点击时间: ${now.toISOString()}`);
    console.log(`   解锁时间: ${unlockAt.toISOString()}`);
    
    // 4. 验证新记录
    console.log('\n✅ 4. 验证新记录:');
    const [newRecords] = await db.execute(`
      SELECT * FROM chapter_unlocks 
      WHERE user_id = 1 AND chapter_id = 1362 
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    if (newRecords.length > 0) {
      const record = newRecords[0];
      console.log(`   记录ID: ${record.id}`);
      console.log(`   解锁方法: ${record.unlock_method}`);
      console.log(`   状态: ${record.status}`);
      console.log(`   创建时间: ${record.created_at}`);
      console.log(`   首次点击时间: ${record.first_clicked_at}`);
      console.log(`   解锁时间: ${record.unlock_at}`);
      
      // 计算剩余时间
      const remainingTime = new Date(record.unlock_at).getTime() - now.getTime();
      const hours = Math.floor(remainingTime / (1000 * 60 * 60));
      const minutes = Math.floor((remainingTime % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remainingTime % (1000 * 60)) / 1000);
      
      console.log(`   剩余时间: ${hours}小时${minutes}分钟${seconds}秒`);
    }
    
    console.log('\n🎉 修复完成！');
    
  } catch (error) {
    console.error('修复失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行修复
fixChapter1362TimeUnlock();
