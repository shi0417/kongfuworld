/**
 * 执行迁移脚本：014_create_chapter_review_log.sql
 * Phase 3: 创建章节审核日志表
 * 
 * 使用方法：
 * node backend/migrations/execute_014_migration.js
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
    const sqlPath = path.join(__dirname, '014_create_chapter_review_log.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📝 开始执行迁移脚本：014_create_chapter_review_log.sql\n');
    console.log('将执行以下操作：');
    console.log('  1. 创建 chapter_review_log 表\n');
    
    // 检查表是否已存在
    console.log('🔍 检查当前状态...');
    
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME 
       FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'chapter_review_log'`,
      [dbConfig.database]
    );
    
    if (tables.length > 0) {
      console.log('⚠️  chapter_review_log 表已存在');
    } else {
      console.log('✓ chapter_review_log 表不存在，将创建');
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
       AND TABLE_NAME = 'chapter_review_log'`,
      [dbConfig.database]
    );
    
    if (newTables.length > 0) {
      console.log('✅ chapter_review_log 表已创建');
      
      // 获取表结构
      const [columns] = await connection.execute(
        `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = 'chapter_review_log'
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

