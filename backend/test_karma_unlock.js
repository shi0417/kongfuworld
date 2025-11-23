const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld'
};

async function testKarmaUnlock() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    console.log('🔮 测试Karma解锁功能...');
    
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
    
    // 3. 测试API调用
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
      }
      
    } catch (error) {
      console.log('❌ API调用失败:', error.message);
    }
    
    // 4. 检查解锁记录
    console.log('\n📊 检查解锁记录...');
    const [unlocks] = await db.execute(`
      SELECT * FROM chapter_unlocks 
      WHERE user_id = 1 AND chapter_id = 1364 
      ORDER BY created_at DESC
    `);
    
    console.log(`找到 ${unlocks.length} 条解锁记录:`);
    unlocks.forEach((record, index) => {
      console.log(`   ${index + 1}. ID: ${record.id}, 方法: ${record.unlock_method}, 状态: ${record.status}, 消耗: ${record.cost}`);
    });
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  } finally {
    if (db) await db.end();
  }
}

testKarmaUnlock();
