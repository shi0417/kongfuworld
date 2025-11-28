/**
 * 执行迁移脚本：025_remove_novel_requires_chief_edit.sql
 * 删除 novel 表中的 requires_chief_edit 字段
 * 
 * 使用方法：
 * node backend/migrations/execute_025_migration.js
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
    const sqlPath = path.join(__dirname, '025_remove_novel_requires_chief_edit.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📝 开始执行迁移脚本：025_remove_novel_requires_chief_edit.sql\n');
    console.log('将执行以下操作：');
    console.log('  1. 删除 requires_chief_edit 字段的索引（如果存在）');
    console.log('  2. 删除 requires_chief_edit 字段\n');
    
    // 检查字段是否存在
    console.log('🔍 检查当前状态...');
    const [columnInfo] = await connection.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'novel' 
       AND COLUMN_NAME = 'requires_chief_edit'`,
      [dbConfig.database]
    );
    
    if (columnInfo.length === 0) {
      console.log('⚠️  requires_chief_edit 字段不存在，无需删除');
    } else {
      console.log('✓ requires_chief_edit 字段存在，将删除');
    }
    
    console.log('\n⚙️  执行SQL语句...\n');
    
    // 移除注释行，然后按分号分割SQL语句
    const cleanSql = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--') || line.trim() === '')
      .join('\n');
    
    // 分割SQL语句（按分号分割）
    const statements = cleanSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        // 对于 DROP 语句，如果对象不存在会报错，需要特殊处理
        if (statement.includes('DROP INDEX') || statement.includes('DROP COLUMN')) {
          try {
            await connection.query(statement + ';');
            const preview = statement.replace(/\s+/g, ' ').substring(0, 100);
            console.log(`✓ [${i + 1}/${statements.length}] 执行成功: ${preview}...`);
          } catch (error) {
            // 如果对象不存在，忽略错误
            if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY' || 
                error.code === 'ER_DROP_INDEX_FK' ||
                error.message.includes('does not exist') ||
                error.message.includes('Unknown key')) {
              console.log(`⏭️  [${i + 1}/${statements.length}] 跳过：对象不存在 (${error.code || error.message})`);
            } else {
              throw error;
            }
          }
        } else {
          await connection.query(statement + ';');
          const preview = statement.replace(/\s+/g, ' ').substring(0, 100);
          console.log(`✓ [${i + 1}/${statements.length}] 执行成功: ${preview}...`);
        }
      } catch (error) {
        console.error(`❌ SQL语句执行失败:`);
        console.error(`   ${statement.substring(0, 150)}...`);
        console.error(`   错误: ${error.message}`);
        throw error;
      }
    }
    
    console.log('\n✅ 迁移脚本执行成功！');
    console.log('📊 验证迁移结果...\n');
    
    // 验证字段是否已删除
    const [newColumnInfo] = await connection.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'novel' 
       AND COLUMN_NAME = 'requires_chief_edit'`,
      [dbConfig.database]
    );
    
    if (newColumnInfo.length === 0) {
      console.log('✅ requires_chief_edit 字段已成功删除');
    } else {
      console.log('⚠️  requires_chief_edit 字段仍然存在');
    }
    
  } catch (error) {
    console.error('\n❌ 迁移失败:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

executeMigration();

