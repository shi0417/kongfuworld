/**
 * 执行迁移脚本：012_create_editor_chapter_share_snapshot.sql
 * Phase 4: 章节归属快照表
 * 
 * 使用方法：
 * node backend/migrations/execute_012_migration.js
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
    const sqlPath = path.join(__dirname, '012_create_editor_chapter_share_snapshot.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📝 开始执行迁移脚本：012_create_editor_chapter_share_snapshot.sql\n');
    console.log('将执行以下操作：');
    console.log('  1. 创建 editor_chapter_share_snapshot 表');
    console.log('  2. 创建索引和外键约束\n');
    
    // 检查表是否已存在
    console.log('🔍 检查当前状态...');
    
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME 
       FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'editor_chapter_share_snapshot'`,
      [dbConfig.database]
    );
    
    if (tables.length > 0) {
      console.log('⚠️  editor_chapter_share_snapshot 表已存在');
    } else {
      console.log('✓ editor_chapter_share_snapshot 表不存在，将创建');
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
        // 检查是否是创建表的语句
        if (statement.includes('CREATE TABLE')) {
          if (tables.length > 0) {
            console.log(`⏭️  [${i + 1}/${statements.length}] 跳过：表已存在`);
            continue;
          }
        }
        
        await connection.query(statement + ';');
        const preview = statement.replace(/\s+/g, ' ').substring(0, 80);
        console.log(`✓ [${i + 1}/${statements.length}] 执行成功: ${preview}...`);
      } catch (error) {
        // 如果是"表已存在"的错误，忽略
        if (error.code === 'ER_TABLE_EXISTS_ERROR' || 
            error.message.includes('already exists')) {
          console.log(`⚠️  [${i + 1}/${statements.length}] 跳过（表已存在）: ${error.message.substring(0, 60)}...`);
          continue;
        }
        // 如果是"约束已存在"的错误，忽略
        if (error.code === 'ER_DUP_KEYNAME' ||
            error.code === 'ER_DUP_KEY' ||
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
    
    // 验证表结构
    const [newTables] = await connection.execute(
      `SELECT TABLE_NAME 
       FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'editor_chapter_share_snapshot'`,
      [dbConfig.database]
    );
    
    if (newTables.length > 0) {
      console.log('✅ editor_chapter_share_snapshot 表已创建');
      
      // 获取表结构
      const [columns] = await connection.execute(
        `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = 'editor_chapter_share_snapshot'
         ORDER BY ORDINAL_POSITION`,
        [dbConfig.database]
      );
      
      console.log('\n✅ 表结构:');
      columns.forEach(col => {
        console.log(`   - ${col.COLUMN_NAME} (${col.COLUMN_TYPE}, ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'})`);
        if (col.COLUMN_DEFAULT !== null) {
          console.log(`     默认值: ${col.COLUMN_DEFAULT}`);
        }
        if (col.COLUMN_COMMENT) {
          console.log(`     注释: ${col.COLUMN_COMMENT}`);
        }
      });
      
      // 获取索引
      const [indexes] = await connection.execute(
        `SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE
         FROM INFORMATION_SCHEMA.STATISTICS 
         WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = 'editor_chapter_share_snapshot'
         ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
        [dbConfig.database]
      );
      
      if (indexes.length > 0) {
        console.log('\n✅ 索引:');
        const indexMap = {};
        indexes.forEach(idx => {
          if (!indexMap[idx.INDEX_NAME]) {
            indexMap[idx.INDEX_NAME] = [];
          }
          indexMap[idx.INDEX_NAME].push(idx.COLUMN_NAME);
        });
        Object.keys(indexMap).forEach(indexName => {
          const isUnique = indexes.find(idx => idx.INDEX_NAME === indexName)?.NON_UNIQUE === 0;
          console.log(`   - ${indexName} (${isUnique ? 'UNIQUE' : 'INDEX'}): ${indexMap[indexName].join(', ')}`);
        });
      }
      
      // 获取外键约束
      const [constraints] = await connection.execute(
        `SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
         FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
         WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = 'editor_chapter_share_snapshot'
         AND REFERENCED_TABLE_NAME IS NOT NULL`,
        [dbConfig.database]
      );
      
      if (constraints.length > 0) {
        console.log('\n✅ 外键约束:');
        constraints.forEach(constraint => {
          console.log(`   - ${constraint.CONSTRAINT_NAME}: ${constraint.COLUMN_NAME} → ${constraint.REFERENCED_TABLE_NAME}.${constraint.REFERENCED_COLUMN_NAME}`);
        });
      }
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

