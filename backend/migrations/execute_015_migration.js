/**
 * 执行迁移脚本：015_add_chief_editor_admin_id.sql
 * 为 novel 表添加 chief_editor_admin_id 字段
 * 
 * 使用方法：
 * node backend/migrations/execute_015_migration.js
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
    const sqlPath = path.join(__dirname, '015_add_chief_editor_admin_id.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📝 开始执行迁移脚本：015_add_chief_editor_admin_id.sql\n');
    console.log('将执行以下操作：');
    console.log('  1. 添加 chief_editor_admin_id 字段（如果不存在）');
    console.log('  2. 添加外键约束');
    console.log('  3. 创建索引\n');
    
    // 检查字段和约束是否已存在
    console.log('🔍 检查当前状态...');
    
    // 检查 chief_editor_admin_id 字段
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'novel' 
       AND COLUMN_NAME = 'chief_editor_admin_id'`,
      [dbConfig.database]
    );
    
    if (columns.length > 0) {
      console.log('⚠️  chief_editor_admin_id 字段已存在');
    } else {
      console.log('✓ chief_editor_admin_id 字段不存在，将添加');
    }
    
    // 检查 current_editor_admin_id 字段
    const [currentEditorColumns] = await connection.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'novel' 
       AND COLUMN_NAME = 'current_editor_admin_id'`,
      [dbConfig.database]
    );
    
    if (currentEditorColumns.length > 0) {
      console.log('✓ current_editor_admin_id 字段已存在');
    } else {
      console.log('⚠️  current_editor_admin_id 字段不存在，将添加');
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
        if (statement.includes('ADD COLUMN') && statement.includes('chief_editor_admin_id')) {
          if (columns.length > 0) {
            console.log(`⏭️  [${i + 1}/${statements.length}] 跳过：chief_editor_admin_id 字段已存在`);
            continue;
          }
        }
        
        // 检查是否是添加约束的语句
        if (statement.includes('ADD CONSTRAINT')) {
          const constraintMatch = statement.match(/ADD CONSTRAINT\s+`?(\w+)`?/i);
          if (constraintMatch) {
            const constraintName = constraintMatch[1];
            const [constraints] = await connection.execute(
              `SELECT CONSTRAINT_NAME 
               FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
               WHERE TABLE_SCHEMA = ? 
               AND TABLE_NAME = 'novel' 
               AND CONSTRAINT_NAME = ?`,
              [dbConfig.database, constraintName]
            );
            if (constraints.length > 0) {
              console.log(`⏭️  [${i + 1}/${statements.length}] 跳过已存在的约束: ${constraintName}`);
              continue;
            }
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
        const preview = statement.replace(/\s+/g, ' ').substring(0, 80);
        console.log(`✓ [${i + 1}/${statements.length}] 执行成功: ${preview}...`);
      } catch (error) {
        // 如果是"字段已存在"或"约束已存在"的错误，忽略
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
        console.error(`   ${statement.substring(0, 150)}...`);
        console.error(`   错误: ${error.message}`);
        throw error;
      }
    }
    
    console.log('\n✅ 迁移脚本执行成功！');
    console.log('📊 验证迁移结果...\n');
    
    // 验证字段
    const [newColumns] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'novel' 
       AND COLUMN_NAME IN ('current_editor_admin_id', 'chief_editor_admin_id')
       ORDER BY ORDINAL_POSITION`,
      [dbConfig.database]
    );
    
    if (newColumns.length > 0) {
      console.log('✅ 字段验证:');
      newColumns.forEach(col => {
        console.log(`   - ${col.COLUMN_NAME} (${col.COLUMN_TYPE}, ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'})`);
        if (col.COLUMN_DEFAULT !== null) {
          console.log(`     默认值: ${col.COLUMN_DEFAULT}`);
        }
        if (col.COLUMN_COMMENT) {
          console.log(`     注释: ${col.COLUMN_COMMENT}`);
        }
      });
    }
    
    // 验证外键约束
    const [constraints] = await connection.execute(
      `SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'novel'
       AND COLUMN_NAME IN ('current_editor_admin_id', 'chief_editor_admin_id')
       AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [dbConfig.database]
    );
    
    if (constraints.length > 0) {
      console.log('\n✅ 外键约束:');
      constraints.forEach(constraint => {
        console.log(`   - ${constraint.CONSTRAINT_NAME}: ${constraint.COLUMN_NAME} → ${constraint.REFERENCED_TABLE_NAME}.${constraint.REFERENCED_COLUMN_NAME}`);
      });
    }
    
    // 验证索引
    const [indexes] = await connection.execute(
      `SELECT INDEX_NAME, COLUMN_NAME
       FROM INFORMATION_SCHEMA.STATISTICS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'novel' 
       AND COLUMN_NAME IN ('current_editor_admin_id', 'chief_editor_admin_id')`,
      [dbConfig.database]
    );
    
    if (indexes.length > 0) {
      console.log('\n✅ 索引:');
      indexes.forEach(idx => {
        console.log(`   - ${idx.INDEX_NAME}: ${idx.COLUMN_NAME}`);
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

