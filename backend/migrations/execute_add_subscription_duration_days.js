/**
 * 执行迁移脚本：add_subscription_duration_days.sql
 * 添加 subscription_duration_days 字段到 user_champion_subscription_record 表
 * 
 * 使用方法：
 * node backend/migrations/execute_add_subscription_duration_days.js
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
    console.log('🔌 正在连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    // 读取迁移SQL文件
    const sqlPath = path.join(__dirname, 'add_subscription_duration_days.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📝 开始执行迁移脚本：add_subscription_duration_days.sql\n');
    console.log('将执行以下操作：');
    console.log('  1. 添加 subscription_duration_days 字段到 user_champion_subscription_record 表\n');
    
    // 检查字段是否已存在
    console.log('🔍 检查当前状态...');
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, COLUMN_COMMENT
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'user_champion_subscription_record'
       AND COLUMN_NAME = 'subscription_duration_days'`,
      [dbConfig.database]
    );
    
    if (columns.length > 0) {
      console.log('⚠️  subscription_duration_days 字段已存在');
      console.log(`   类型: ${columns[0].COLUMN_TYPE}`);
      console.log(`   默认值: ${columns[0].COLUMN_DEFAULT}`);
      console.log('\n✅ 迁移已完成（字段已存在）');
      return;
    } else {
      console.log('✓ subscription_duration_days 字段不存在，将添加');
    }
    
    console.log('\n⚙️  执行SQL语句...\n');
    
    // 执行SQL
    await connection.query(sql);
    
    console.log('✅ 迁移脚本执行成功！');
    console.log('📊 验证迁移结果...\n');
    
    // 验证字段是否已添加
    const [verifyColumns] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, COLUMN_COMMENT
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'user_champion_subscription_record'
       AND COLUMN_NAME = 'subscription_duration_days'`,
      [dbConfig.database]
    );
    
    if (verifyColumns.length > 0) {
      console.log('✅ subscription_duration_days 字段已成功添加');
      console.log(`   类型: ${verifyColumns[0].COLUMN_TYPE}`);
      console.log(`   默认值: ${verifyColumns[0].COLUMN_DEFAULT}`);
      console.log(`   注释: ${verifyColumns[0].COLUMN_COMMENT}`);
      
      // 检查现有记录的数量
      const [count] = await connection.execute(
        `SELECT COUNT(*) as total FROM user_champion_subscription_record`
      );
      console.log(`\n📊 当前 user_champion_subscription_record 表共有 ${count[0].total} 条记录`);
      
      // 检查有多少记录的 subscription_duration_days 为 NULL（旧数据）
      const [nullCount] = await connection.execute(
        `SELECT COUNT(*) as null_count FROM user_champion_subscription_record WHERE subscription_duration_days IS NULL`
      );
      console.log(`   其中 ${nullCount[0].null_count} 条记录的 subscription_duration_days 为 NULL（旧数据，将使用默认值30）`);
      
      console.log('\n✅ 迁移完成！');
    } else {
      throw new Error('subscription_duration_days 字段未找到，迁移可能失败');
    }
    
  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message);
    
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.error('   错误：字段已存在');
    } else if (error.code === 'ER_BAD_FIELD_ERROR') {
      console.error('   错误：表或字段不存在');
    } else {
      console.error('   错误详情:', error);
    }
    
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

