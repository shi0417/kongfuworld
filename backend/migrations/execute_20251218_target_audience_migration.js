// 执行数据库迁移脚本：为 homepage_announcements 添加 target_audience 字段
// 执行方式: node backend/migrations/execute_20251218_target_audience_migration.js

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
    console.log('🔍 开始执行 homepage_announcements target_audience 字段迁移...');
    console.log('1. 添加 target_audience 字段（ENUM reader/writer）');
    console.log('2. 添加索引优化查询');
    console.log('3. 更新现有数据默认值\n');
    
    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    
    // 检查字段是否已存在
    console.log('\n📊 检查字段状态...');
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'homepage_announcements'
        AND COLUMN_NAME = 'target_audience'
    `, [dbConfig.database]);
    
    if (columns.length > 0) {
      console.log('⚠️  target_audience 字段已存在，跳过添加');
    } else {
      console.log('✓ target_audience 字段不存在，将添加');
    }
    
    // 读取SQL文件
    const sqlPath = path.join(__dirname, '20251218_add_target_audience_to_homepage_announcements.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // 执行SQL
    console.log('\n📝 执行SQL迁移...');
    await connection.query(sql);
    
    console.log('✅ 迁移脚本执行成功！');
    console.log('📊 验证迁移结果...');
    
    // 验证字段是否添加成功
    const [newColumns] = await connection.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'homepage_announcements'
        AND COLUMN_NAME = 'target_audience'
    `, [dbConfig.database]);
    
    if (newColumns.length > 0) {
      const col = newColumns[0];
      console.log(`✓ target_audience 字段已添加：类型=${col.COLUMN_TYPE}, 默认值=${col.COLUMN_DEFAULT}`);
    } else {
      console.log('✗ target_audience 字段添加失败');
      throw new Error('字段添加失败');
    }
    
    // 检查索引
    const [indexes] = await connection.query(`
      SELECT INDEX_NAME 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'homepage_announcements'
        AND INDEX_NAME = 'idx_target_audience_active'
    `, [dbConfig.database]);
    
    if (indexes.length > 0) {
      console.log('✓ 索引 idx_target_audience_active 已创建');
    } else {
      console.log('⚠️  索引可能未创建（请检查 SQL）');
    }
    
    // 显示现有数据统计
    const [stats] = await connection.query(`
      SELECT target_audience, COUNT(*) as count 
      FROM homepage_announcements 
      GROUP BY target_audience
    `);
    
    console.log('\n📋 现有数据统计：');
    stats.forEach(stat => {
      console.log(`  - ${stat.target_audience}: ${stat.count} 条`);
    });
    
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

