const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld'
};

async function addKarmaToUser() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    const userId = 1000;
    const karmaToAdd = 100; // 添加100个Golden Karma
    
    console.log(`🔄 给用户${userId}添加${karmaToAdd}个Golden Karma...`);
    
    // 获取当前余额
    const [users] = await db.execute('SELECT golden_karma FROM user WHERE id = ?', [userId]);
    if (users.length === 0) {
      console.log('❌ 用户不存在');
      return;
    }
    
    const currentKarma = users[0].golden_karma || 0;
    const newKarma = currentKarma + karmaToAdd;
    
    // 更新用户Karma余额
    await db.execute('UPDATE user SET golden_karma = ? WHERE id = ?', [newKarma, userId]);
    
    console.log(`✅ 成功添加Karma:`);
    console.log(`   用户ID: ${userId}`);
    console.log(`   原余额: ${currentKarma}`);
    console.log(`   新增: ${karmaToAdd}`);
    console.log(`   新余额: ${newKarma}`);
    
    // 记录交易
    await db.execute(`
      INSERT INTO user_karma_transactions (
        user_id, transaction_type, karma_amount, karma_type, 
        balance_before, balance_after, description, status
      ) VALUES (?, 'reward', ?, 'golden_karma', ?, ?, ?, 'completed')
    `, [userId, karmaToAdd, currentKarma, newKarma, 'Admin added karma for testing']);
    
    console.log(`✅ 交易记录已创建`);
    
  } catch (error) {
    console.error('❌ 添加Karma失败:', error);
  } finally {
    if (db) await db.end();
  }
}

addKarmaToUser();
