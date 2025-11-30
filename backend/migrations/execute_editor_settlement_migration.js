/**
 * 执行迁移脚本：20251201_add_editor_settlement_monthly_and_payout.sql
 * 创建 editor_settlement_monthly 和 editor_payout 表
 * 
 * 使用方法：
 * node backend/migrations/execute_editor_settlement_migration.js
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
  multipleStatements: true // 允许执行多条 SQL
};

async function executeMigration() {
  let db;
  
  try {
    console.log('🔌 正在连接数据库...');
    db = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    // 检查表是否已存在
    console.log('🔍 检查表是否已存在...');
    const [tables] = await db.execute(
      `SELECT TABLE_NAME 
       FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME IN ('editor_settlement_monthly', 'editor_payout')`,
      [dbConfig.database]
    );
    
    const existingTables = tables.map(t => t.TABLE_NAME);
    if (existingTables.includes('editor_settlement_monthly') && existingTables.includes('editor_payout')) {
      console.log('⚠️  表已存在，跳过迁移');
      console.log('   已存在的表:', existingTables.join(', '));
      return;
    }
    
    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, '20251201_add_editor_settlement_monthly_and_payout.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📝 执行 SQL 迁移...');
    console.log('将创建以下表:');
    if (!existingTables.includes('editor_settlement_monthly')) {
      console.log('  - editor_settlement_monthly (编辑月度结算汇总表)');
    }
    if (!existingTables.includes('editor_payout')) {
      console.log('  - editor_payout (编辑支付单表)');
    }
    console.log('');
    
    // 执行 SQL（使用 multipleStatements: true）
    await db.query(sql);
    
    console.log('✅ 迁移成功：表已创建');
    
    // 验证表是否创建成功
    console.log('\n📊 验证表结构...');
    const [verifyTables] = await db.execute(
      `SELECT TABLE_NAME, TABLE_COMMENT
       FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME IN ('editor_settlement_monthly', 'editor_payout')`,
      [dbConfig.database]
    );
    
    if (verifyTables.length > 0) {
      console.log('\n✅ 表创建成功:');
      verifyTables.forEach(table => {
        console.log(`   - ${table.TABLE_NAME}: ${table.TABLE_COMMENT || '无注释'}`);
      });
    }
    
    // 显示表结构
    console.log('\n📋 表结构详情:');
    for (const table of verifyTables) {
      const [columns] = await db.execute(
        `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION`,
        [dbConfig.database, table.TABLE_NAME]
      );
      
      console.log(`\n${table.TABLE_NAME}:`);
      columns.forEach(col => {
        console.log(`  - ${col.COLUMN_NAME}: ${col.COLUMN_TYPE} ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'} ${col.COLUMN_DEFAULT ? `DEFAULT ${col.COLUMN_DEFAULT}` : ''} ${col.COLUMN_COMMENT ? `(${col.COLUMN_COMMENT})` : ''}`);
      });
    }
    
  } catch (error) {
    console.error('\n❌ 迁移失败:', error);
    console.error('错误详情:', error.message);
    if (error.sql) {
      console.error('SQL:', error.sql);
    }
    process.exit(1);
  } finally {
    if (db) {
      await db.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

// 执行迁移
executeMigration()
  .then(() => {
    console.log('\n✅ 迁移完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 迁移执行失败:', error);
    process.exit(1);
  });

