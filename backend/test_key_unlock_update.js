const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld'
};

async function testKeyUnlockUpdate() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    console.log('🔑 测试Key解锁更新逻辑...');
    
    const userId = 1;
    const chapterId = 1362;
    const keyCost = 1;
    
    // 开始事务
    await db.query('START TRANSACTION');
    
    try {
      // 1. 检查现有记录
      const [existingUnlocks] = await db.execute(`
        SELECT * FROM chapter_unlocks 
        WHERE user_id = ? AND chapter_id = ?
      `, [userId, chapterId]);
      
      console.log(`📊 找到 ${existingUnlocks.length} 条现有记录`);
      if (existingUnlocks.length > 0) {
        console.log(`   记录ID: ${existingUnlocks[0].id}, 方法: ${existingUnlocks[0].unlock_method}, 状态: ${existingUnlocks[0].status}`);
      }
      
      // 2. 模拟Key消耗（不实际扣除，只检查余额）
      const [users] = await db.execute('SELECT points FROM user WHERE id = ?', [userId]);
      if (users.length > 0) {
        console.log(`📊 用户Key余额: ${users[0].points}`);
        if (users[0].points >= keyCost) {
          console.log('✅ Key余额充足');
        } else {
          console.log('❌ Key余额不足');
          return;
        }
      }
      
      // 3. 更新现有记录
      if (existingUnlocks.length > 0) {
        console.log('🔄 更新现有记录为Key解锁...');
        const [updateResult] = await db.execute(`
          UPDATE chapter_unlocks 
          SET unlock_method = 'key', cost = ?, status = 'unlocked', unlocked_at = NOW()
          WHERE user_id = ? AND chapter_id = ?
        `, [keyCost, userId, chapterId]);
        
        console.log(`✅ 更新完成，影响行数: ${updateResult.affectedRows}`);
        
        // 验证更新结果
        const [updatedRecords] = await db.execute(`
          SELECT * FROM chapter_unlocks 
          WHERE user_id = ? AND chapter_id = ?
        `, [userId, chapterId]);
        
        if (updatedRecords.length > 0) {
          const record = updatedRecords[0];
          console.log(`📊 更新后记录: ID=${record.id}, 方法=${record.unlock_method}, 状态=${record.status}, 消耗=${record.cost}`);
        }
      }
      
      // 提交事务
      await db.query('COMMIT');
      console.log('✅ 事务提交成功');
      
    } catch (error) {
      // 回滚事务
      await db.query('ROLLBACK');
      console.error('❌ 事务回滚:', error.message);
      throw error;
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  } finally {
    if (db) await db.end();
  }
}

testKeyUnlockUpdate();
