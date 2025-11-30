/**
 * 执行迁移：添加 days 字段到 reader_spending 表
 * 
 * 使用方法：
 * node backend/migrations/execute_add_days_to_reader_spending.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function executeMigration() {
  let db;
  
  try {
    console.log('🔌 正在连接数据库...');
    db = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    // 检查字段是否已存在
    const [columns] = await db.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = 'reader_spending' 
         AND COLUMN_NAME = 'days'`,
      [dbConfig.database]
    );
    
    if (columns.length > 0) {
      console.log('⚠️  days 字段已存在，跳过迁移');
      return;
    }
    
    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, '20251129_add_days_to_reader_spending.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📝 执行 SQL 迁移...');
    console.log('SQL:', sql);
    
    await db.execute(sql);
    
    console.log('✅ 迁移成功：days 字段已添加到 reader_spending 表');
    
    // 验证
    const [verifyColumns] = await db.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, COLUMN_COMMENT
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = 'reader_spending' 
         AND COLUMN_NAME = 'days'`,
      [dbConfig.database]
    );
    
    if (verifyColumns.length > 0) {
      console.log('\n📊 字段信息:');
      console.log(JSON.stringify(verifyColumns[0], null, 2));
    }
    
  } catch (error) {
    console.error('\n❌ 迁移失败:', error);
    process.exit(1);
  } finally {
    if (db) {
      await db.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

executeMigration();

