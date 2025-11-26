/**
 * 执行迁移脚本：018_drop_display_name_and_supervisor.sql
 * 删除 admin 表中的 display_name 和 supervisor_admin_id 字段
 * 
 * 使用方法：
 * node backend/migrations/execute_018_migration.js
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
    const sqlPath = path.join(__dirname, '018_drop_display_name_and_supervisor.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📝 开始执行迁移脚本：018_drop_display_name_and_supervisor.sql\n');
    console.log('将执行以下操作：');
    console.log('  1. 删除外键约束 fk_admin_supervisor');
    console.log('  2. 删除索引 idx_supervisor_admin_id');
    console.log('  3. 删除字段 display_name');
    console.log('  4. 删除字段 supervisor_admin_id\n');
    
    // 检查字段是否存在
    console.log('🔍 检查当前状态...');
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'admin' 
       AND COLUMN_NAME IN ('display_name', 'supervisor_admin_id')`,
      [dbConfig.database]
    );
    
    const existingColumns = columns.map(c => c.COLUMN_NAME);
    if (existingColumns.includes('display_name')) {
      console.log('✓ display_name 字段存在，将删除');
    } else {
      console.log('⚠️  display_name 字段不存在');
    }
    
    if (existingColumns.includes('supervisor_admin_id')) {
      console.log('✓ supervisor_admin_id 字段存在，将删除');
    } else {
      console.log('⚠️  supervisor_admin_id 字段不存在');
    }
    
    if (existingColumns.length === 0) {
      console.log('\n✅ 迁移已完成（无需操作）');
      return;
    }
    
    console.log('\n⚙️  执行SQL语句...\n');
    
    // 1: 删除外键约束（先检查是否存在）
    try {
      const [constraints] = await connection.execute(
        `SELECT CONSTRAINT_NAME 
         FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
         WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = 'admin' 
         AND CONSTRAINT_NAME = 'fk_admin_supervisor'`,
        [dbConfig.database]
      );
      
      if (constraints.length > 0) {
        await connection.query('ALTER TABLE `admin` DROP FOREIGN KEY `fk_admin_supervisor`');
        console.log('✓ 删除外键约束: fk_admin_supervisor');
      } else {
        console.log('⚠️  外键约束 fk_admin_supervisor 不存在，跳过');
      }
    } catch (error) {
      console.log(`⚠️  删除外键约束失败: ${error.message.substring(0, 60)}...`);
    }
    
    // 移除: 删除索引（先检查是否存在）
    try {
      const [indexes] = await connection.execute(
        `SELECT INDEX_NAME 
         FROM INFORMATION_SCHEMA.STATISTICS 
         WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = 'admin' 
         AND INDEX_NAME = 'idx_supervisor_admin_id'`,
        [dbConfig.database]
      );
      
      if (indexes.length > 0) {
        await connection.query('DROP INDEX `idx_supervisor_admin_id` ON `admin`');
        console.log('✓ 删除索引: idx_supervisor_admin_id');
      } else {
        console.log('⚠️  索引 idx_supervisor_admin_id 不存在，跳过');
      }
    } catch (error) {
      console.log(`⚠️  删除索引失败: ${error.message.substring(0, 60)}...`);
    }
    
    // 删除字段
    if (existingColumns.includes('display_name')) {
      try {
        await connection.query('ALTER TABLE `admin` DROP COLUMN `display_name`');
        console.log('✓ 删除字段: display_name');
      } catch (error) {
        console.error(`❌ 删除字段 display_name 失败: ${error.message}`);
        throw error;
      }
    }
    
    if (existingColumns.includes('supervisor_admin_id')) {
      try {
        await connection.query('ALTER TABLE `admin` DROP COLUMN `supervisor_admin_id`');
        console.log('✓ 删除字段: supervisor_admin_id');
      } catch (error) {
        console.error(`❌ 删除字段 supervisor_admin_id 失败: ${error.message}`);
        throw error;
      }
    }
    
    console.log('\n✅ 迁移脚本执行成功！');
    console.log('📊 验证迁移结果...\n');
    
    // 验证字段是否已删除
    const [newColumns] = await connection.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'admin' 
       AND COLUMN_NAME IN ('display_name', 'supervisor_admin_id')`,
      [dbConfig.database]
    );
    
    if (newColumns.length === 0) {
      console.log('✅ display_name 和 supervisor_admin_id 字段已成功删除');
    } else {
      console.log('⚠️  以下字段仍然存在:');
      newColumns.forEach(col => {
        console.log(`   - ${col.COLUMN_NAME}`);
      });
    }
    
    console.log('\n🎉 迁移完成！');
    
  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message);
    if (error.code) {
      console.error('   错误代码:', error.code);
    }
    if (error.sql) {
      console.error('   SQL:', error.sql.substring(0, 200));
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 数据库连接已关闭。');
    }
  }
}

// 执行迁移
executeMigration();

