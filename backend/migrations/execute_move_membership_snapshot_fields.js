/**
 * 执行迁移：将会员快照字段移动到 subscription_duration_days 字段后面
 * 
 * 使用方法：
 * node backend/migrations/execute_move_membership_snapshot_fields.js
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
      `SELECT COLUMN_NAME, ORDINAL_POSITION
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = 'user_champion_subscription_record' 
         AND COLUMN_NAME IN ('subscription_duration_days', 'before_membership_snapshot', 'after_membership_snapshot')
       ORDER BY ORDINAL_POSITION`,
      [dbConfig.database]
    );
    
    const columnMap = {};
    columns.forEach(col => {
      columnMap[col.COLUMN_NAME] = col.ORDINAL_POSITION;
    });
    
    if (!columnMap['subscription_duration_days']) {
      console.log('⚠️  subscription_duration_days 字段不存在，无法执行迁移');
      return;
    }
    
    if (!columnMap['before_membership_snapshot'] || !columnMap['after_membership_snapshot']) {
      console.log('⚠️  会员快照字段不存在，请先执行添加字段的迁移');
      return;
    }
    
    // 检查字段是否已经在正确位置
    const subscriptionDurationDaysPos = columnMap['subscription_duration_days'];
    const beforeSnapshotPos = columnMap['before_membership_snapshot'];
    const afterSnapshotPos = columnMap['after_membership_snapshot'];
    
    if (beforeSnapshotPos === subscriptionDurationDaysPos + 1 && 
        afterSnapshotPos === subscriptionDurationDaysPos + 2) {
      console.log('✅ 字段已经在正确位置，无需迁移');
      return;
    }
    
    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, '20251129_move_membership_snapshot_fields.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📝 执行 SQL 迁移...');
    console.log('SQL:', sql);
    
    await db.execute(sql);
    
    console.log('✅ 迁移成功：会员快照字段已移动到 subscription_duration_days 字段后面');
    
    // 验证
    const [verifyColumns] = await db.execute(
      `SELECT COLUMN_NAME, ORDINAL_POSITION
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = 'user_champion_subscription_record' 
         AND COLUMN_NAME IN ('subscription_duration_days', 'before_membership_snapshot', 'after_membership_snapshot')
       ORDER BY ORDINAL_POSITION`,
      [dbConfig.database]
    );
    
    if (verifyColumns.length > 0) {
      console.log('\n📊 字段顺序:');
      verifyColumns.forEach(col => {
        console.log(`  ${col.ORDINAL_POSITION}. ${col.COLUMN_NAME}`);
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

