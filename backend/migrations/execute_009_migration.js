/**
 * 执行迁移脚本：009_add_chapter_review_fields.sql
 * 为 chapter 表添加审核相关字段
 * 
 * 使用方法：
 * node backend/migrations/execute_009_migration.js
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
    const sqlPath = path.join(__dirname, '009_add_chapter_review_fields.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📝 开始执行迁移脚本：009_add_chapter_review_fields.sql\n');
    console.log('将添加以下字段到 chapter 表：');
    console.log('  - editor_admin_id (负责审核该章节的编辑)');
    console.log('  - review_admin_id (最终审核人ID)');
    console.log('  - reviewed_at (审核时间)\n');
    
    // 检查字段是否已存在
    console.log('🔍 检查字段是否已存在...');
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'chapter' 
       AND COLUMN_NAME IN ('editor_admin_id', 'review_admin_id', 'reviewed_at')`,
      [dbConfig.database]
    );
    
    const existingColumns = columns.map(col => col.COLUMN_NAME);
    if (existingColumns.length > 0) {
      console.log(`⚠️  以下字段已存在: ${existingColumns.join(', ')}`);
      console.log('   将跳过已存在的字段...\n');
    } else {
      console.log('✓ 所有字段都不存在，可以安全添加\n');
    }
    
    // 执行SQL（使用query而不是execute，因为SQL文件可能包含多条语句）
    console.log('⚙️  执行SQL语句...');
    
    // 移除注释行，然后按分号分割SQL语句
    const cleanSql = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--') || line.trim() === '')
      .join('\n');
    
    // 分割SQL语句（按分号分割，但保留ALTER TABLE的完整性）
    const statements = cleanSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        // 跳过已存在的字段
        if (statement.includes('ADD COLUMN')) {
          const columnMatch = statement.match(/ADD COLUMN\s+`?(\w+)`?/i);
          if (columnMatch) {
            const columnName = columnMatch[1];
            if (existingColumns.includes(columnName)) {
              console.log(`⏭️  跳过已存在的字段: ${columnName}`);
              continue;
            }
          }
        }
        
        // 跳过已存在的约束
        if (statement.includes('ADD CONSTRAINT')) {
          const constraintMatch = statement.match(/ADD CONSTRAINT\s+`?(\w+)`?/i);
          if (constraintMatch) {
            const constraintName = constraintMatch[1];
            const [constraints] = await connection.execute(
              `SELECT CONSTRAINT_NAME 
               FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
               WHERE TABLE_SCHEMA = ? 
               AND TABLE_NAME = 'chapter' 
               AND CONSTRAINT_NAME = ?`,
              [dbConfig.database, constraintName]
            );
            if (constraints.length > 0) {
              console.log(`⏭️  跳过已存在的约束: ${constraintName}`);
              continue;
            }
          }
        }
        
        // 跳过已存在的索引
        if (statement.includes('CREATE INDEX')) {
          const indexMatch = statement.match(/CREATE INDEX\s+`?(\w+)`?/i);
          if (indexMatch) {
            const indexName = indexMatch[1];
            const [indexes] = await connection.execute(
              `SELECT INDEX_NAME 
               FROM INFORMATION_SCHEMA.STATISTICS 
               WHERE TABLE_SCHEMA = ? 
               AND TABLE_NAME = 'chapter' 
               AND INDEX_NAME = ?`,
              [dbConfig.database, indexName]
            );
            if (indexes.length > 0) {
              console.log(`⏭️  跳过已存在的索引: ${indexName}`);
              continue;
            }
          }
        }
        
        await connection.query(statement + ';');
        const preview = statement.replace(/\s+/g, ' ').substring(0, 60);
        console.log(`✓ [${i + 1}/${statements.length}] 执行成功: ${preview}...`);
      } catch (error) {
        // 如果是"字段已存在"或"约束已存在"的错误，忽略
        if (error.code === 'ER_DUP_FIELDNAME' || 
            error.code === 'ER_DUP_KEYNAME' ||
            error.code === 'ER_DUP_KEY' ||
            error.message.includes('Duplicate column name') ||
            error.message.includes('Duplicate key name') ||
            error.message.includes('already exists')) {
          console.log(`⚠️  跳过（已存在）: ${error.message.substring(0, 60)}...`);
          continue;
        }
        console.error(`❌ SQL语句执行失败:`);
        console.error(`   ${statement.substring(0, 100)}...`);
        throw error;
      }
    }
    
    console.log('\n✅ 迁移脚本执行成功！');
    console.log('📊 验证迁移结果...\n');
    
    // 验证字段是否已添加
    const [newColumns] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_COMMENT
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'chapter' 
       AND COLUMN_NAME IN ('editor_admin_id', 'review_admin_id', 'reviewed_at')
       ORDER BY ORDINAL_POSITION`,
      [dbConfig.database]
    );
    
    if (newColumns.length > 0) {
      console.log('✅ 成功添加的字段：');
      newColumns.forEach(col => {
        console.log(`   - ${col.COLUMN_NAME} (${col.COLUMN_TYPE}, ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'})`);
        if (col.COLUMN_COMMENT) {
          console.log(`     注释: ${col.COLUMN_COMMENT}`);
        }
      });
    } else {
      console.log('⚠️  未找到新添加的字段（可能已存在）');
    }
    
    // 验证索引
    const [indexes] = await connection.execute(
      `SELECT INDEX_NAME 
       FROM INFORMATION_SCHEMA.STATISTICS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'chapter' 
       AND INDEX_NAME IN ('idx_chapter_editor_admin_id', 'idx_chapter_review_admin_id', 'idx_chapter_reviewed_at')`,
      [dbConfig.database]
    );
    
    if (indexes.length > 0) {
      console.log('\n✅ 成功创建的索引：');
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

