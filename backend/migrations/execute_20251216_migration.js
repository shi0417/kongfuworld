// 执行数据库迁移脚本：创建站点政策文档表
// 执行方式: node backend/migrations/execute_20251216_migration.js

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
    console.log('🔍 开始执行站点政策文档表数据库迁移...');
    console.log('1. 创建 site_legal_documents 表');
    console.log('2. 插入三条默认 draft 记录（Terms/Privacy/Cookie）\n');
    
    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    
    // 读取SQL文件
    const sqlPath = path.join(__dirname, '20251216_create_site_legal_documents.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // 执行SQL
    console.log('📝 执行SQL迁移...');
    await connection.query(sql);
    
    console.log('✅ 迁移脚本执行成功！');
    console.log('📊 验证迁移结果...');
    
    // 验证表是否创建成功
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'site_legal_documents'
    `, [dbConfig.database]);
    
    if (tables.length > 0) {
      console.log('✓ site_legal_documents 表已创建');
    } else {
      console.log('✗ site_legal_documents 表创建失败');
      throw new Error('表创建失败');
    }
    
    // 验证默认数据是否插入成功
    const [rows] = await connection.query(`
      SELECT COUNT(*) as count 
      FROM site_legal_documents
    `);
    
    const count = rows[0].count;
    console.log(`✓ 表中现有 ${count} 条记录`);
    
    if (count >= 3) {
      console.log('✓ 默认数据插入成功');
    } else {
      console.log('⚠️  默认数据可能未完全插入');
    }
    
    // 显示插入的记录
    const [docs] = await connection.query(`
      SELECT doc_key, language, title, version, status 
      FROM site_legal_documents 
      ORDER BY doc_key
    `);
    
    console.log('\n📋 当前文档列表：');
    docs.forEach(doc => {
      console.log(`  - ${doc.doc_key} (${doc.language}): ${doc.title} v${doc.version} [${doc.status}]`);
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

