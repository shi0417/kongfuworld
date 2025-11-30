/**
 * 执行迁移：添加会员快照字段到 user_champion_subscription_record 表
 * 
 * 使用方法：
 * node backend/migrations/execute_add_membership_snapshot.js
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
         AND TABLE_NAME = 'user_champion_subscription_record' 
         AND COLUMN_NAME IN ('before_membership_snapshot', 'after_membership_snapshot')`,
      [dbConfig.database]
    );
    
    const existingColumns = columns.map(c => c.COLUMN_NAME);
    if (existingColumns.includes('before_membership_snapshot') && existingColumns.includes('after_membership_snapshot')) {
      console.log('⚠️  字段已存在，跳过迁移');
      return;
    }
    
    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, '20251129_add_membership_snapshot_to_subscription_record.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📝 执行 SQL 迁移...');
    console.log('SQL:', sql);
    
    await db.execute(sql);
    
    console.log('✅ 迁移成功：会员快照字段已添加到 user_champion_subscription_record 表');
    
    // 验证
    const [verifyColumns] = await db.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_COMMENT
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = 'user_champion_subscription_record' 
         AND COLUMN_NAME IN ('before_membership_snapshot', 'after_membership_snapshot')`,
      [dbConfig.database]
    );
    
    if (verifyColumns.length > 0) {
      console.log('\n📊 字段信息:');
      verifyColumns.forEach(col => {
        console.log(JSON.stringify(col, null, 2));
      });
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

