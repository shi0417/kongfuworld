/**
 * 执行迁移：删除 subscription_duration_months 字段
 * 
 * 使用方法：
 * node backend/migrations/execute_drop_subscription_duration_months.js
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
    
    // 检查字段是否存在
    const [columns] = await db.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = 'user_champion_subscription_record' 
         AND COLUMN_NAME = 'subscription_duration_months'`,
      [dbConfig.database]
    );
    
    if (columns.length === 0) {
      console.log('⚠️  subscription_duration_months 字段不存在，无需删除');
      return;
    }
    
    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, '20251129_drop_subscription_duration_months.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📝 执行 SQL 迁移...');
    console.log('SQL:', sql);
    
    await db.execute(sql);
    
    console.log('✅ 迁移成功：subscription_duration_months 字段已删除');
    
    // 验证
    const [verifyColumns] = await db.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = 'user_champion_subscription_record' 
         AND COLUMN_NAME = 'subscription_duration_months'`,
      [dbConfig.database]
    );
    
    if (verifyColumns.length === 0) {
      console.log('✅ 验证通过：字段已成功删除');
    } else {
      console.log('⚠️  警告：字段仍然存在');
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

