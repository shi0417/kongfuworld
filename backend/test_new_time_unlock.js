const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld'
};

async function testNewTimeUnlock() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    console.log('🧪 测试新的时间解锁逻辑...');
    
    // 1. 检查1362章节的前置章节
    console.log('\n📖 1. 检查1362章节的前置章节:');
    const [chapter1362] = await db.execute(`
      SELECT * FROM chapter WHERE id = 1362
    `);
    
    if (chapter1362.length > 0) {
      const chapter = chapter1362[0];
      console.log(`   当前章节: ${chapter.chapter_number} (${chapter.id})`);
      console.log(`   小说ID: ${chapter.novel_id}`);
      
      // 检查前置章节
      const [prevChapter] = await db.execute(`
        SELECT c.*, cu.status as unlock_status
        FROM chapter c
        LEFT JOIN chapter_unlocks cu ON cu.chapter_id = c.id AND cu.user_id = 1 AND cu.status = 'unlocked'
        WHERE c.novel_id = ? AND c.chapter_number = ?
      `, [chapter.novel_id, chapter.chapter_number - 1]);
      
      if (prevChapter.length > 0) {
        const prev = prevChapter[0];
        console.log(`   前置章节: ${prev.chapter_number} (${prev.id})`);
        console.log(`   是否免费: ${!prev.is_premium}`);
        console.log(`   是否已解锁: ${prev.unlock_status === 'unlocked'}`);
        console.log(`   满足条件: ${!prev.is_premium || prev.unlock_status === 'unlocked'}`);
      } else {
        console.log('   ❌ 前置章节不存在');
      }
      
      // 检查下一章节
      const [nextChapter] = await db.execute(`
        SELECT id, chapter_number FROM chapter 
        WHERE novel_id = ? AND chapter_number = ?
        ORDER BY chapter_number ASC
        LIMIT 1
      `, [chapter.novel_id, chapter.chapter_number + 1]);
      
      if (nextChapter.length > 0) {
        const next = nextChapter[0];
        console.log(`   下一章节: ${next.chapter_number} (${next.id})`);
      } else {
        console.log('   ❌ 下一章节不存在');
      }
    }
    
    // 2. 测试API调用
    console.log('\n🌐 2. 测试时间解锁API:');
    try {
      const response = await fetch('http://localhost:5000/api/chapter-unlock/start-time-unlock/1362/1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      console.log('   API响应:', JSON.stringify(data, null, 2));
    } catch (error) {
      console.log('   ❌ API调用失败:', error.message);
    }
    
    // 3. 检查数据库记录
    console.log('\n📊 3. 检查数据库记录:');
    const [records] = await db.execute(`
      SELECT id, user_id, chapter_id, unlock_method, status, 
             created_at, first_clicked_at, unlock_at, unlocked_at, next_chapter_id
      FROM chapter_unlocks 
      WHERE user_id = 1 AND chapter_id IN (1362, 1363) AND unlock_method = 'time_unlock'
      ORDER BY created_at DESC
    `);
    
    console.log(`   找到 ${records.length} 条记录:`);
    records.forEach((record, index) => {
      console.log(`   ${index + 1}. ID: ${record.id}, 章节: ${record.chapter_id}, 状态: ${record.status}`);
      console.log(`      解锁时间: ${record.unlock_at}`);
      console.log(`      下一章节ID: ${record.next_chapter_id || 'N/A'}`);
    });
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  } finally {
    if (db) await db.end();
  }
}

testNewTimeUnlock();
