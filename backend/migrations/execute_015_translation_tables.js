/**
 * 执行 015_create_translation_tables.sql 迁移
 */

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
    console.log('开始执行迁移：015_create_translation_tables.sql');
    
    connection = await mysql.createConnection(dbConfig);
    
    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, '015_create_translation_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // 执行 SQL
    await connection.query(sql);
    
    console.log('✅ 迁移执行成功！');
    console.log('已创建表：');
    console.log('  - translation_task (翻译任务表)');
    console.log('  - chapter_translation (章节翻译表)');
    
  } catch (error) {
    console.error('❌ 迁移执行失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

executeMigration();

