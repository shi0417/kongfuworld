const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

// 加载环境变量
const envPaths = [
  path.join(__dirname, '../../.env'),
  path.join(__dirname, '../kongfuworld.env'),
  path.join(__dirname, '../../backend/kongfuworld.env')
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    break;
  }
}

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

(async () => {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    const [tables] = await db.execute("SHOW TABLES LIKE '%chapter%'");
    console.log('包含 chapter 的表:');
    tables.forEach(t => {
      console.log('  -', Object.values(t)[0]);
    });
    
    // 检查是否有 chapter_copy 表
    const [chapterCopy] = await db.execute("SHOW TABLES LIKE 'chapter_copy'");
    if (chapterCopy.length > 0) {
      const [columns] = await db.execute("DESCRIBE chapter_copy");
      console.log('\nchapter_copy 表结构:');
      columns.forEach(col => {
        console.log(`  - ${col.Field}: ${col.Type}`);
      });
      
      const [count] = await db.execute("SELECT COUNT(*) as count FROM chapter_copy");
      console.log(`\n记录数: ${count[0].count}`);
      
      const [withContent] = await db.execute("SELECT COUNT(*) as count FROM chapter_copy WHERE content_china IS NOT NULL AND content_china != ''");
      console.log(`有 content_china 的记录数: ${withContent[0].count}`);
      
      const [withEng] = await db.execute("SELECT COUNT(*) as count FROM chapter_copy WHERE content_eng IS NOT NULL AND content_eng != ''");
      console.log(`有 content_eng 的记录数: ${withEng[0].count}`);
      
      const [needTranslate] = await db.execute("SELECT COUNT(*) as count FROM chapter_copy WHERE content_china IS NOT NULL AND content_china != '' AND (content_eng IS NULL OR content_eng = '')");
      console.log(`需要翻译的记录数: ${needTranslate[0].count}`);
    } else {
      console.log('\n未找到 chapter_copy 表');
    }
    
    await db.end();
  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
})();

