/**
 * 执行迁移脚本：010_add_requires_chief_edit.sql
 * Phase 3: 小说主编终审开关 + 章节审核流程
 * 
 * 使用方法：
 * node backend/migrations/execute_010_migration.js
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
    const sqlPath = path.join(__dirname, '010_add_requires_chief_edit.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📝 开始执行迁移脚本：010_add_requires_chief_edit.sql\n');
    console.log('将执行以下操作：');
    console.log('  1. 添加 requires_chief_edit 字段（是否需要主编终审）');
    console.log('  2. 创建索引以提高查询性能\n');
    
    // 检查字段和索引是否已存在
    console.log('🔍 检查当前状态...');
    
    // 检查 requires_chief_edit 字段
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'novel' 
       AND COLUMN_NAME = 'requires_chief_edit'`,
      [dbConfig.database]
    );
    
    if (columns.length > 0) {
      console.log('⚠️  requires_chief_edit 字段已存在');
    } else {
      console.log('✓ requires_chief_edit 字段不存在，将添加');
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
        // 检查是否是添加字段的语句
        if (statement.includes('ADD COLUMN') && statement.includes('requires_chief_edit')) {
          if (columns.length > 0) {
            console.log(`⏭️  [${i + 1}/${statements.length}] 跳过：requires_chief_edit 字段已存在`);
            continue;
          }
        }
        
        // 检查是否是创建索引的语句
        if (statement.includes('CREATE INDEX')) {
          const indexMatch = statement.match(/CREATE INDEX\s+`?(\w+)`?/i);
          if (indexMatch) {
            const indexName = indexMatch[1];
            const [indexes] = await connection.execute(
              `SELECT INDEX_NAME 
               FROM INFORMATION_SCHEMA.STATISTICS 
               WHERE TABLE_SCHEMA = ? 
               AND TABLE_NAME = 'novel' 
               AND INDEX_NAME = ?`,
              [dbConfig.database, indexName]
            );
            if (indexes.length > 0) {
              console.log(`⏭️  [${i + 1}/${statements.length}] 跳过已存在的索引: ${indexName}`);
              continue;
            }
          }
        }
        
        await connection.query(statement + ';');
        const preview = statement.replace(/\s+/g, ' ').substring(0, 70);
        console.log(`✓ [${i + 1}/${statements.length}] 执行成功: ${preview}...`);
      } catch (error) {
        // 如果是"字段已存在"或"索引已存在"的错误，忽略
        if (error.code === 'ER_DUP_FIELDNAME' || 
            error.code === 'ER_DUP_KEYNAME' ||
            error.code === 'ER_DUP_KEY' ||
            error.message.includes('Duplicate column name') ||
            error.message.includes('Duplicate key name') ||
            error.message.includes('already exists')) {
          console.log(`⚠️  [${i + 1}/${statements.length}] 跳过（已存在）: ${error.message.substring(0, 60)}...`);
          continue;
        }
        console.error(`❌ SQL语句执行失败:`);
        console.error(`   ${statement.substring(0, 100)}...`);
        throw error;
      }
    }
    
    console.log('\n✅ 迁移脚本执行成功！');
    console.log('📊 验证迁移结果...\n');
    
    // 验证 requires_chief_edit 字段
    const [newColumns] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'novel' 
       AND COLUMN_NAME = 'requires_chief_edit'`,
      [dbConfig.database]
    );
    
    if (newColumns.length > 0) {
      console.log('✅ requires_chief_edit 字段:');
      newColumns.forEach(col => {
        console.log(`   - ${col.COLUMN_NAME} (${col.COLUMN_TYPE}, ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'})`);
        console.log(`     默认值: ${col.COLUMN_DEFAULT}`);
        if (col.COLUMN_COMMENT) {
          console.log(`     注释: ${col.COLUMN_COMMENT}`);
        }
      });
    }
    
    // 验证索引
    const [indexes] = await connection.execute(
      `SELECT INDEX_NAME 
       FROM INFORMATION_SCHEMA.STATISTICS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'novel' 
       AND INDEX_NAME = 'idx_requires_chief_edit'`,
      [dbConfig.database]
    );
    
    if (indexes.length > 0) {
      console.log('\n✅ 索引:');
      indexes.forEach(idx => {
        console.log(`   - ${idx.INDEX_NAME}`);
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

