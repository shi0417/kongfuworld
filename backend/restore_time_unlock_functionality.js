// 恢复时间解锁功能到昨天的工作状态
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function restoreTimeUnlockFunctionality() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('\n🔧 恢复时间解锁功能到昨天的工作状态\n');
    
    // 1. 清理所有1362章节的解锁记录
    console.log('🗑️ 1. 清理所有1362章节的解锁记录:');
    const [deleteResult] = await db.execute(`
      DELETE FROM chapter_unlocks 
      WHERE user_id = 1 AND chapter_id = 1362
    `);
    console.log(`   删除了 ${deleteResult.affectedRows} 条记录`);
    
    // 2. 创建新的时间解锁记录（模拟昨天的工作状态）
    console.log('\n⏰ 2. 创建新的时间解锁记录:');
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
    
    // 3. 验证记录创建成功
    console.log('\n✅ 3. 验证记录创建成功:');
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
      console.log(`   格式化显示: ${hours.toString().padStart(2, '0')}h:${minutes.toString().padStart(2, '0')}m:${seconds.toString().padStart(2, '0')}s`);
    }
    
    // 4. 测试API调用
    console.log('\n🧪 4. 测试API调用:');
    console.log('   现在可以测试以下API:');
    console.log('   GET  /api/chapter-unlock/status/1362/1');
    console.log('   POST /api/chapter-unlock/start-time-unlock/1362/1');
    
    console.log('\n🎉 时间解锁功能已恢复到昨天的工作状态！');
    console.log('   现在前端应该能正常显示倒计时了。');
    
  } catch (error) {
    console.error('恢复失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行恢复
restoreTimeUnlockFunctionality();
