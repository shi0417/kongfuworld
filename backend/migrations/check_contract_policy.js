// 检查签约政策数据
const mysql = require('mysql2/promise');

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
    const [rows] = await db.query(
      "SELECT id, doc_key, language, title, status, is_current FROM site_legal_documents WHERE doc_key = 'writer_contract_policy'"
    );
    console.log('签约政策记录:');
    if (rows.length === 0) {
      console.log('  没有找到任何记录');
    } else {
      rows.forEach(r => {
        console.log(`  ID: ${r.id}, Lang: ${r.language}, Title: ${r.title}, Status: ${r.status}, is_current: ${r.is_current}`);
      });
    }
    await db.end();
  } catch (error) {
    console.error('查询失败:', error);
    process.exit(1);
  }
})();

