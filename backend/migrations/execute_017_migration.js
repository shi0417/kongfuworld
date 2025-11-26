/**
 * 执行迁移脚本：017_drop_editor_chapter_share_snapshot.sql
 * 删除 editor_chapter_share_snapshot 表
 * 
 * 使用方法：
 * node backend/migrations/execute_017_migration.js
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
    const sqlPath = path.join(__dirname, '017_drop_editor_chapter_share_snapshot.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📝 开始执行迁移脚本：017_drop_editor_chapter_share_snapshot.sql\n');
    console.log('将执行以下操作：');
    console.log('  1. 删除 editor_chapter_share_snapshot 表\n');
    
    // 检查表是否存在
    console.log('🔍 检查当前状态...');
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME 
       FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'editor_chapter_share_snapshot'`,
      [dbConfig.database]
    );
    
    if (tables.length > 0) {
      console.log('✓ editor_chapter_share_snapshot 表存在，将删除');
    } else {
      console.log('⚠️  editor_chapter_share_snapshot 表不存在，无需删除');
      console.log('\n✅ 迁移已完成（无需操作）');
      return;
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
        await connection.query(statement + ';');
        const preview = statement.replace(/\s+/g, ' ').substring(0, 70);
        console.log(`✓ [${i + 1}/${statements.length}] 执行成功: ${preview}...`);
      } catch (error) {
        // 如果是表不存在的错误，忽略
        if (error.code === 'ER_BAD_TABLE_ERROR' || error.message.includes("doesn't exist")) {
          console.log(`⚠️  [${i + 1}/${statements.length}] 表不存在，跳过`);
          continue;
        }
        console.error(`❌ SQL语句执行失败:`);
        console.error(`   ${statement.substring(0, 100)}...`);
        throw error;
      }
    }
    
    console.log('\n✅ 迁移脚本执行成功！');
    console.log('📊 验证迁移结果...\n');
    
    // 验证表是否已删除
    const [newTables] = await connection.execute(
      `SELECT TABLE_NAME 
       FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'editor_chapter_share_snapshot'`,
      [dbConfig.database]
    );
    
    if (newTables.length === 0) {
      console.log('✅ editor_chapter_share_snapshot 表已成功删除');
    } else {
      console.log('⚠️  editor_chapter_share_snapshot 表仍然存在');
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

