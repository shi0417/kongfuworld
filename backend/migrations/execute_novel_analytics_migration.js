// 执行数据库迁移脚本：创建作品数据评价系统的统计表
// 执行方式: node backend/migrations/execute_novel_analytics_migration.js

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
    console.log('🔍 开始执行作品数据评价系统数据库迁移...');
    console.log('1. 创建 novel_advanced_stats_daily 表（每日高级统计表）');
    console.log('2. 创建 novel_overall_scores 表（综合评分表）');
    
    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    
    // 读取SQL文件
    const sqlPath = path.join(__dirname, 'create_novel_analytics_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // 执行SQL
    console.log('📝 执行SQL迁移...');
    await connection.query(sql);
    
    console.log('✅ 迁移脚本执行成功！');
    console.log('📊 验证迁移结果...');
    
    // 验证表是否创建成功
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME IN ('novel_advanced_stats_daily', 'novel_overall_scores')
    `, [dbConfig.database]);
    
    const tableNames = tables.map(t => t.TABLE_NAME);
    
    if (tableNames.includes('novel_advanced_stats_daily')) {
      console.log('✓ novel_advanced_stats_daily 表已创建');
    } else {
      console.log('✗ novel_advanced_stats_daily 表创建失败');
    }
    
    if (tableNames.includes('novel_overall_scores')) {
      console.log('✓ novel_overall_scores 表已创建');
    } else {
      console.log('✗ novel_overall_scores 表创建失败');
    }
    
    // 检查字段
    const [columns] = await connection.query(`
      SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME IN ('novel_advanced_stats_daily', 'novel_overall_scores')
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `, [dbConfig.database]);
    
    console.log('\n📋 表结构验证：');
    let currentTable = '';
    columns.forEach(col => {
      if (col.TABLE_NAME !== currentTable) {
        currentTable = col.TABLE_NAME;
        console.log(`\n表: ${currentTable}`);
      }
      console.log(`  - ${col.COLUMN_NAME} (${col.COLUMN_TYPE}): ${col.COLUMN_COMMENT || ''}`);
    });
    
    console.log('\n✅ 迁移完成！');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    
    // 如果是表已存在的错误，忽略
    if (error.message.includes('already exists') || 
        error.message.includes('Duplicate table')) {
      console.log('⚠️  表已存在，跳过创建...');
    } else {
      throw error;
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 数据库连接已关闭');
    }
  }
}

// 执行迁移
executeMigration().catch(console.error);

