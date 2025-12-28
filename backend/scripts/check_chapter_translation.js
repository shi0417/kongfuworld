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
    
    // 检查 chapter_translation 表
    const [tables] = await db.execute("SHOW TABLES LIKE 'chapter_translation'");
    if (tables.length > 0) {
      const [columns] = await db.execute("DESCRIBE chapter_translation");
      console.log('chapter_translation 表结构:');
      columns.forEach(col => {
        console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(可为空)' : '(不可为空)'}`);
      });
      
      const [count] = await db.execute("SELECT COUNT(*) as count FROM chapter_translation");
      console.log(`\n记录数: ${count[0].count}`);
    }
    
    // 检查所有表，看是否有包含 content_china 和 content_eng 字段的表
    const [allTables] = await db.execute("SHOW TABLES");
    console.log('\n检查所有表是否有 content_china 和 content_eng 字段...');
    
    for (const table of allTables) {
      const tableName = Object.values(table)[0];
      const [columns] = await db.execute(`DESCRIBE ${tableName}`);
      const columnNames = columns.map(c => c.Field);
      
      if (columnNames.includes('content_china') || columnNames.includes('content_eng')) {
        console.log(`\n表: ${tableName}`);
        console.log('  字段:', columnNames.join(', '));
        
        if (columnNames.includes('content_china') && columnNames.includes('content_eng')) {
          const [count] = await db.execute(`SELECT COUNT(*) as count FROM ${tableName} WHERE content_china IS NOT NULL AND content_china != ''`);
          const [engCount] = await db.execute(`SELECT COUNT(*) as count FROM ${tableName} WHERE content_eng IS NOT NULL AND content_eng != ''`);
          const [needTranslate] = await db.execute(`SELECT COUNT(*) as count FROM ${tableName} WHERE content_china IS NOT NULL AND content_china != '' AND (content_eng IS NULL OR content_eng = '')`);
          
          console.log(`  有 content_china: ${count[0].count}`);
          console.log(`  有 content_eng: ${engCount[0].count}`);
          console.log(`  需要翻译: ${needTranslate[0].count}`);
        }
      }
    }
    
    await db.end();
  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
})();

