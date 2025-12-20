// 执行 Inbox v2 Stage 3A 数据库迁移：创建 message_read_states
// 执行方式: node backend/migrations/execute_20251220_create_message_read_states.js

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

async function executeMigration() {
  let connection;
  try {
    console.log('🔍 开始执行 Inbox v2 Stage 3A 迁移（message_read_states）...');

    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');

    const sqlPath = path.join(__dirname, '20251220_create_message_read_states.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('\n📝 执行SQL迁移...');
    await connection.query(sql);

    console.log('✅ 迁移脚本执行成功！');
  } catch (error) {
    console.error('❌ 迁移执行失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

executeMigration();


