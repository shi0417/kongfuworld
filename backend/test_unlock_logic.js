// 测试解锁逻辑
const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
});

async function testUnlockLogic() {
  try {
    console.log('测试章节解锁逻辑...\n');
    
    const userId = 1;
    const chapterId = 1306;
    
    // 1. 检查用户是否已解锁该章节
    console.log('1. 检查用户是否已解锁该章节:');
    const existingUnlock = await new Promise((resolve, reject) => {
      db.query(`
        SELECT * FROM chapter_unlocks 
        WHERE user_id = ? AND chapter_id = ?
      `, [userId, chapterId], (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    });
    
    console.log(`- 用户${userId}在chapter_unlocks表中是否有章节${chapterId}的记录:`, !!existingUnlock);
    if (existingUnlock) {
      console.log(`- 解锁方法: ${existingUnlock.unlock_method}`);
      console.log(`- 解锁时间: ${existingUnlock.unlock_time}`);
    }
    
    // 2. 检查用户订阅状态
    console.log('\n2. 检查用户订阅状态:');
    const user = await new Promise((resolve, reject) => {
      db.query(`
        SELECT id, points, karma_count, subscription_status, subscription_end_date
        FROM user WHERE id = ?
      `, [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    });
    
    const isGlobalSubscribed = user.subscription_status !== 'none' && 
                              user.subscription_end_date && 
                              new Date(user.subscription_end_date) > new Date();
    console.log(`- 全局订阅状态: ${user.subscription_status}`);
    console.log(`- 订阅结束时间: ${user.subscription_end_date}`);
    console.log(`- 是否有有效全局订阅: ${isGlobalSubscribed}`);
    
    // 3. 检查Champion订阅
    console.log('\n3. 检查Champion订阅:');
    const championSubscription = await new Promise((resolve, reject) => {
      db.query(`
        SELECT * FROM user_champion_subscription 
        WHERE user_id = ? AND novel_id = ? AND is_active = 1 AND end_date > NOW()
      `, [userId, 10], (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    });
    
    console.log(`- 用户${userId}是否有小说10的Champion订阅:`, !!championSubscription);
    if (championSubscription) {
      console.log(`- Champion订阅结束时间: ${championSubscription.end_date}`);
    }
    
    const isSubscribed = isGlobalSubscribed || championSubscription;
    console.log(`- 是否有任何订阅权限: ${isSubscribed}`);
    
    // 4. 最终解锁状态
    console.log('\n4. 最终解锁状态:');
    const isUnlocked = !!existingUnlock || isSubscribed;
    console.log(`- 用户是否有访问权限: ${isUnlocked}`);
    
    if (isUnlocked) {
      if (existingUnlock) {
        console.log('- 解锁原因: 用户已拥有该章节');
      } else if (isSubscribed) {
        console.log('- 解锁原因: 用户有订阅权限');
      }
    } else {
      console.log('- 解锁原因: 用户无权限');
    }
    
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    db.end();
  }
}

testUnlockLogic();
