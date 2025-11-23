const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld'
};

async function testKarmaUnlockFinal() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    console.log('🔮 测试Karma解锁功能（最终版本）...');
    
    // 1. 检查用户Golden Karma余额
    const [users] = await db.execute('SELECT * FROM user WHERE id = 1');
    if (users.length > 0) {
      console.log(`📊 用户Golden Karma余额: ${users[0].golden_karma}`);
    }
    
    // 2. 检查章节信息
    const [chapters] = await db.execute(`
      SELECT c.*, n.title as novel_title 
      FROM chapter c
      JOIN novel n ON c.novel_id = n.id 
      WHERE c.id = 1364
    `);
    
    if (chapters.length > 0) {
      const chapter = chapters[0];
      console.log(`📖 章节信息: ${chapter.novel_title} 第${chapter.chapter_number}章`);
      console.log(`   是否付费: ${chapter.is_premium ? '是' : '否'}`);
      console.log(`   Karma消耗: ${chapter.unlock_price}`);
    }
    
    // 3. 检查现有解锁记录
    const [unlocks] = await db.execute(`
      SELECT * FROM chapter_unlocks 
      WHERE user_id = 1 AND chapter_id = 1364 
      ORDER BY created_at DESC
    `);
    
    console.log(`\n📊 现有解锁记录 (${unlocks.length} 条):`);
    unlocks.forEach((record, index) => {
      console.log(`   ${index + 1}. ID: ${record.id}, 方法: ${record.unlock_method}, 状态: ${record.status}, 消耗: ${record.cost}`);
    });
    
    // 4. 测试API调用
    console.log('\n🌐 测试Karma解锁API...');
    try {
      const response = await fetch('http://localhost:5000/api/chapter-unlock/unlock-with-karma/1364/1', {
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
    
    // 5. 检查解锁记录变化
    console.log('\n📊 检查解锁记录变化...');
    const [newUnlocks] = await db.execute(`
      SELECT * FROM chapter_unlocks 
      WHERE user_id = 1 AND chapter_id = 1364 
      ORDER BY created_at DESC
    `);
    
    console.log(`找到 ${newUnlocks.length} 条解锁记录:`);
    newUnlocks.forEach((record, index) => {
      console.log(`   ${index + 1}. ID: ${record.id}, 方法: ${record.unlock_method}, 状态: ${record.status}, 消耗: ${record.cost}`);
    });
    
    // 6. 检查Karma交易记录
    console.log('\n📊 检查Karma交易记录...');
    const [transactions] = await db.execute(`
      SELECT * FROM user_karma_transactions 
      WHERE user_id = 1 
      ORDER BY created_at DESC 
      LIMIT 5
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

testKarmaUnlockFinal();
