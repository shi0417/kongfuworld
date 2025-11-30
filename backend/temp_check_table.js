const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

(async () => {
  const db = await mysql.createConnection(dbConfig);
  try {
    const [rows] = await db.execute('SHOW CREATE TABLE editor_income_monthly');
    console.log('========== EDITOR_INCOME_MONTHLY 表结构 ==========');
    console.log(rows[0]['Create Table']);
    const [indexes] = await db.execute('SHOW INDEX FROM editor_income_monthly');
    console.log('\n========== 索引信息 ==========');
    indexes.forEach(idx => {
      console.log(`索引名: ${idx.Key_name}, 列名: ${idx.Column_name}, 非唯一: ${idx.Non_unique === 1 ? '是' : '否'}`);
    });
  } catch (e) {
    console.log('查询失败:', e.message);
  }
  await db.end();
})();

