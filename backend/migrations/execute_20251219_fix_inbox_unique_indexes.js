// 执行站内信表唯一索引修复迁移
// node backend/migrations/execute_20251219_fix_inbox_unique_indexes.js

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4',
  multipleStatements: true
};

async function run() {
  let conn;
  try {
    conn = await mysql.createConnection(dbConfig);
    const sqlPath = path.join(__dirname, '20251219_fix_inbox_unique_indexes.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('🛠️  执行 inbox 唯一索引修复迁移...');
    await conn.query(sql);
    console.log('✅ inbox 唯一索引修复迁移完成');
  } catch (e) {
    console.error('❌ inbox 唯一索引修复迁移失败:', e.message);
    console.error(e);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();


