const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld'
};

async function testInsert() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    console.log('🧪 测试INSERT语句...');
    
    const now = new Date();
    const unlockAt = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const userId = 1;
    const chapterId = 1362;
    const nextChapterId = 1363;
    
    // 测试第一个INSERT
    console.log('📝 测试当前章节INSERT...');
    await db.execute(`
      INSERT INTO chapter_unlocks (user_id, chapter_id, unlock_method, status, created_at, first_clicked_at, unlock_at, updated_at, next_chapter_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [userId, chapterId, 'time_unlock', 'pending', now, now, unlockAt, now, nextChapterId]);
    
    console.log('✅ 当前章节INSERT成功');
    
    // 测试第二个INSERT
    console.log('📝 测试下一章节INSERT...');
    await db.execute(`
      INSERT INTO chapter_unlocks (user_id, chapter_id, unlock_method, status, created_at, first_clicked_at, unlock_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [userId, nextChapterId, 'time_unlock', 'pending', now, now, unlockAt, now]);
    
    console.log('✅ 下一章节INSERT成功');
    
    // 检查结果
    const [results] = await db.execute(`
      SELECT id, user_id, chapter_id, unlock_method, status, next_chapter_id
      FROM chapter_unlocks 
      WHERE user_id = ? AND chapter_id IN (?, ?) AND unlock_method = 'time_unlock'
      ORDER BY id DESC
    `, [userId, chapterId, nextChapterId]);
    
    console.log('📊 插入结果:');
    results.forEach((record, index) => {
      console.log(`   ${index + 1}. ID: ${record.id}, 章节: ${record.chapter_id}, 状态: ${record.status}, 下一章节: ${record.next_chapter_id || 'N/A'}`);
    });
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  } finally {
    if (db) await db.end();
  }
}

testInsert();
