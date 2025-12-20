// 执行站内信系统数据库迁移
// 执行方式: node backend/migrations/execute_20251219_inbox_migration.js

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

async function executeMigration() {
  let connection;
  try {
    console.log('🔍 开始执行站内信系统数据库迁移...');
    console.log('1. 创建 conversations 表');
    console.log('2. 创建 conversation_participants 表');
    console.log('3. 创建 messages 表');
    console.log('4. 创建 message_attachments 表');
    console.log('5. 创建 conversation_reads 表');
    console.log('6. 创建 conversation_links 表\n');
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    
    const sqlPath = path.join(__dirname, '20251219_create_inbox_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('\n📝 执行SQL迁移...');
    await connection.query(sql);
    
    console.log('✅ 迁移脚本执行成功！');
    console.log('\n✅ 数据库迁移完成！');
    
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

