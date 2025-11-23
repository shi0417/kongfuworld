// 检查当前时间解锁状态
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function checkCurrentTimeUnlockStatus() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('\n🔍 检查当前时间解锁状态\n');
    
    // 1. 查看所有1362章节的解锁记录
    console.log('📊 1. 查看所有1362章节的解锁记录:');
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
        console.log(`      首次点击时间: ${record.first_clicked_at || 'NULL'}`);
        console.log(`      解锁时间: ${record.unlock_at || 'NULL'}`);
        console.log(`      解锁完成时间: ${record.unlocked_at || 'NULL'}`);
        console.log(`      更新时间: ${record.updated_at || 'NULL'}`);
        console.log('      ---');
      });
    }
    
    // 2. 检查是否有pending状态的时间解锁
    console.log('\n⏳ 2. 检查pending状态的时间解锁:');
    const [pendingRecords] = await db.execute(`
      SELECT * FROM chapter_unlocks 
      WHERE user_id = 1 AND chapter_id = 1362 
      AND unlock_method = 'time_unlock' AND status = 'pending'
    `);
    
    if (pendingRecords.length === 0) {
      console.log('   无pending状态的时间解锁记录');
    } else {
      console.log(`   找到 ${pendingRecords.length} 条pending记录:`);
      pendingRecords.forEach((record, index) => {
        console.log(`   ${index + 1}. ID: ${record.id}`);
        console.log(`      创建时间: ${record.created_at}`);
        console.log(`      解锁时间: ${record.unlock_at}`);
        
        // 计算剩余时间
        const now = new Date();
        const unlockAt = new Date(record.unlock_at);
        const timeRemaining = unlockAt.getTime() - now.getTime();
        
        if (timeRemaining > 0) {
          const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
          const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
          console.log(`      剩余时间: ${hours}小时${minutes}分钟${seconds}秒`);
        } else {
          console.log(`      已过期: ${Math.abs(timeRemaining)}毫秒前`);
        }
      });
    }
    
    // 3. 检查是否有unlocked状态的时间解锁
    console.log('\n✅ 3. 检查unlocked状态的时间解锁:');
    const [unlockedRecords] = await db.execute(`
      SELECT * FROM chapter_unlocks 
      WHERE user_id = 1 AND chapter_id = 1362 
      AND unlock_method = 'time_unlock' AND status = 'unlocked'
    `);
    
    if (unlockedRecords.length === 0) {
      console.log('   无unlocked状态的时间解锁记录');
    } else {
      console.log(`   找到 ${unlockedRecords.length} 条unlocked记录:`);
      unlockedRecords.forEach((record, index) => {
        console.log(`   ${index + 1}. ID: ${record.id}`);
        console.log(`      解锁完成时间: ${record.unlocked_at}`);
      });
    }
    
  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    if (db) await db.end();
  }
}

checkCurrentTimeUnlockStatus();
