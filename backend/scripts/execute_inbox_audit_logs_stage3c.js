// 手动执行 Inbox v2 Stage 3C 审计表创建（inbox_audit_logs）
// 注意：SQL 位于 docs/db/，避免被自动迁移系统误执行
//
// 执行方式:
//   node backend/scripts/execute_inbox_audit_logs_stage3c.js

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4',
  multipleStatements: true,
};

async function main() {
  let connection;
  try {
    console.log('🔍 开始执行 Inbox v2 Stage 3C 审计表 SQL（inbox_audit_logs）...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');

    const sqlPath = path.join(__dirname, '../../docs/db/inbox-audit-logs.stage3c.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📝 执行 SQL...');
    await connection.query(sql);

    console.log('✅ 执行成功');
  } catch (err) {
    console.error('❌ 执行失败:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 数据库连接已关闭');
    }
  }
}

main();


