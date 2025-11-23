const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld'
};

async function checkChapter1374() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    console.log('🔍 检查章节1374信息...');
    
    // 检查章节信息
    const [chapters] = await db.execute(`
      SELECT c.*, n.title as novel_title 
      FROM chapter c
      JOIN novel n ON c.novel_id = n.id 
      WHERE c.id = 1374
    `);
    
    if (chapters.length > 0) {
      const chapter = chapters[0];
      console.log(`📖 章节信息:`);
      console.log(`   ID: ${chapter.id}`);
      console.log(`   小说: ${chapter.novel_title}`);
      console.log(`   章节号: ${chapter.chapter_number}`);
      console.log(`   是否付费: ${chapter.is_premium ? '是' : '否'}`);
      console.log(`   Key消耗: ${chapter.key_cost}`);
      console.log(`   Karma消耗: ${chapter.unlock_price}`);
      console.log(`   标题: ${chapter.title}`);
    } else {
      console.log('❌ 章节1374不存在');
    }
    
    // 检查用户信息
    const [users] = await db.execute('SELECT id, username, golden_karma FROM user WHERE id = 1');
    if (users.length > 0) {
      const user = users[0];
      console.log(`\n👤 用户信息:`);
      console.log(`   ID: ${user.id}`);
      console.log(`   用户名: ${user.username}`);
      console.log(`   Golden Karma: ${user.golden_karma}`);
    }
    
    // 检查解锁记录
    const [unlocks] = await db.execute(`
      SELECT * FROM chapter_unlocks 
      WHERE user_id = 1 AND chapter_id = 1374 
      ORDER BY created_at DESC
    `);
    
    console.log(`\n📊 解锁记录 (${unlocks.length} 条):`);
    unlocks.forEach((record, index) => {
      console.log(`   ${index + 1}. ID: ${record.id}, 方法: ${record.unlock_method}, 状态: ${record.status}, 消耗: ${record.cost}`);
    });
    
  } catch (error) {
    console.error('❌ 检查失败:', error.message);
  } finally {
    if (db) await db.end();
  }
}

checkChapter1374();
