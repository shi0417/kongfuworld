const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld'
};

async function testKarma1374() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    console.log('🔮 测试章节1374的Karma解锁...');
    
    // 1. 检查服务器状态
    console.log('🌐 测试Karma解锁API...');
    try {
      const response = await fetch('http://localhost:5000/api/chapter-unlock/unlock-with-karma/1374/1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      console.log('📊 API响应:', JSON.stringify(data, null, 2));
      
      if (data.success) {
        console.log('✅ Karma解锁成功！');
      } else {
        console.log('❌ Karma解锁失败:', data.message);
        if (data.redirectUrl) {
          console.log(`🔗 跳转链接: ${data.redirectUrl}`);
        }
        if (data.errorCode) {
          console.log(`🏷️ 错误代码: ${data.errorCode}`);
        }
      }
      
    } catch (error) {
      console.log('❌ API调用失败:', error.message);
    }
    
    // 2. 检查解锁记录变化
    console.log('\n📊 检查解锁记录变化...');
    const [unlocks] = await db.execute(`
      SELECT * FROM chapter_unlocks 
      WHERE user_id = 1 AND chapter_id = 1374 
      ORDER BY created_at DESC
    `);
    
    console.log(`找到 ${unlocks.length} 条解锁记录:`);
    unlocks.forEach((record, index) => {
      console.log(`   ${index + 1}. ID: ${record.id}, 方法: ${record.unlock_method}, 状态: ${record.status}, 消耗: ${record.cost}`);
    });
    
    // 3. 检查用户Golden Karma变化
    const [users] = await db.execute('SELECT golden_karma FROM user WHERE id = 1');
    if (users.length > 0) {
      console.log(`\n💰 用户Golden Karma余额: ${users[0].golden_karma}`);
    }
    
    // 4. 检查Karma交易记录
    console.log('\n📊 检查Karma交易记录...');
    const [transactions] = await db.execute(`
      SELECT * FROM user_karma_transactions 
      WHERE user_id = 1 
      ORDER BY created_at DESC 
      LIMIT 3
    `);
    
    console.log(`找到 ${transactions.length} 条Karma交易记录:`);
    transactions.forEach((record, index) => {
      console.log(`   ${index + 1}. 类型: ${record.transaction_type}, 金额: ${record.amount}, 余额: ${record.balance_before}->${record.balance_after}`);
    });
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  } finally {
    if (db) await db.end();
  }
}

testKarma1374();
