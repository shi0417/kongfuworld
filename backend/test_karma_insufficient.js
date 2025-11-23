const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld'
};

async function testKarmaInsufficient() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    console.log('🔮 测试Karma余额不足的情况...');
    
    // 1. 临时设置用户Golden Karma余额为0
    console.log('💰 设置用户Golden Karma余额为0...');
    await db.execute('UPDATE user SET golden_karma = 0 WHERE id = 1');
    console.log('✅ 用户Golden Karma余额已设置为0');
    
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
      console.log(`   Karma消耗: ${chapter.unlock_price}`);
    }
    
    // 3. 测试API调用
    console.log('\n🌐 测试Karma解锁API（余额不足）...');
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
    
    // 4. 恢复用户Golden Karma余额
    console.log('\n💰 恢复用户Golden Karma余额...');
    await db.execute('UPDATE user SET golden_karma = 139784 WHERE id = 1');
    console.log('✅ 用户Golden Karma余额已恢复');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  } finally {
    if (db) await db.end();
  }
}

testKarmaInsufficient();
