const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld'
};

async function checkChapterPrice() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    const [chapters] = await db.execute('SELECT id, chapter_number, unlock_price, is_premium FROM chapter WHERE id = 1307');
    console.log('章节1307信息:');
    if (chapters.length > 0) {
      const chapter = chapters[0];
      console.log(`章节ID: ${chapter.id}`);
      console.log(`章节号: ${chapter.chapter_number}`);
      console.log(`解锁价格: ${chapter.unlock_price}`);
      console.log(`是否付费: ${chapter.is_premium}`);
    } else {
      console.log('章节不存在');
    }
  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    if (db) await db.end();
  }
}

checkChapterPrice();
