// 执行数据库迁移脚本：删除银行卡绑定相关表
// 执行方式: node backend/migrations/execute_20251219_drop_bank_card_tables.js

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// 数据库配置
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
    console.log('🔍 开始执行删除银行卡绑定相关表迁移...');
    console.log('1. 删除 user_bank_card_change_logs 表');
    console.log('2. 删除 user_bank_card_bindings 表\n');
    
    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    
    // 检查表是否存在
    console.log('\n📊 检查表状态...');
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME IN ('user_bank_card_bindings', 'user_bank_card_change_logs')
    `, [dbConfig.database]);
    
    if (tables.length === 0) {
      console.log('⚠️  未找到银行卡相关表，可能已经删除');
    } else {
      console.log(`✓ 找到 ${tables.length} 个表：`);
      tables.forEach(table => {
        console.log(`  - ${table.TABLE_NAME}`);
      });
    }
    
    // 读取SQL文件
    const sqlPath = path.join(__dirname, '20251219_drop_bank_card_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // 执行SQL
    console.log('\n📝 执行SQL迁移...');
    await connection.query(sql);
    
    console.log('✅ 迁移脚本执行成功！');
    console.log('📊 验证迁移结果...');
    
    // 验证表是否已删除
    const [remainingTables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME IN ('user_bank_card_bindings', 'user_bank_card_change_logs')
    `, [dbConfig.database]);
    
    if (remainingTables.length === 0) {
      console.log('✓ 所有银行卡相关表已成功删除');
    } else {
      console.log(`⚠️  仍有 ${remainingTables.length} 个表未删除：`);
      remainingTables.forEach(table => {
        console.log(`  - ${table.TABLE_NAME}`);
      });
    }
    
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

// 执行迁移
executeMigration();

