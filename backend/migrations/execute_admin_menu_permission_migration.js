/**
 * 执行迁移脚本：022_create_admin_menu_permission_table.sql
 * 创建 admin_menu_permission 表
 * 
 * 使用方法：
 * node backend/migrations/execute_admin_menu_permission_migration.js
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
       AND TABLE_NAME = 'admin_menu_permission'`,
      [dbConfig.database]
    );
    
    if (tables.length > 0) {
      console.log('⚠️  表 admin_menu_permission 已存在，跳过迁移');
      return;
    }
    
    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, '022_create_admin_menu_permission_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📝 执行 SQL 迁移...');
    console.log('将创建以下表:');
    console.log('  - admin_menu_permission (后台左侧菜单可见权限配置表)');
    console.log('');
    
    // 执行 SQL
    await db.execute(sql);
    
    console.log('✅ 迁移成功：admin_menu_permission 表已创建');
    
    // 验证表结构
    const [columns] = await db.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, COLUMN_COMMENT
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'admin_menu_permission'
       ORDER BY ORDINAL_POSITION`,
      [dbConfig.database]
    );
    
    if (columns.length > 0) {
      console.log('\n📊 表结构:');
      columns.forEach(col => {
        console.log(`  - ${col.COLUMN_NAME} (${col.COLUMN_TYPE}) ${col.COLUMN_COMMENT || ''}`);
      });
    }
    
    // 验证索引
    const [indexes] = await db.execute(
      `SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE
       FROM INFORMATION_SCHEMA.STATISTICS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'admin_menu_permission'
       ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
      [dbConfig.database]
    );
    
    if (indexes.length > 0) {
      console.log('\n🔑 索引:');
      const indexMap = {};
      indexes.forEach(idx => {
        if (!indexMap[idx.INDEX_NAME]) {
          indexMap[idx.INDEX_NAME] = [];
        }
        indexMap[idx.INDEX_NAME].push(idx.COLUMN_NAME);
      });
      Object.keys(indexMap).forEach(indexName => {
        const isUnique = indexes.find(idx => idx.INDEX_NAME === indexName && idx.NON_UNIQUE === 0);
        console.log(`  - ${indexName} (${isUnique ? 'UNIQUE' : 'INDEX'}): ${indexMap[indexName].join(', ')}`);
      });
    }
    
    console.log('\n✨ 迁移完成！');
    
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
executeMigration();

