/**
 * 执行 editor_income_monthly 表扩展迁移
 * 
 * 使用方法：
 * node backend/migrations/execute_extend_editor_income_monthly.js
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
    
    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, '20251129_extend_editor_income_monthly.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📝 执行 SQL 迁移...');
    console.log('SQL 内容:');
    console.log(sql);
    console.log('');
    
    // 由于 MySQL 不支持 IF NOT EXISTS，我们需要先检查字段是否存在
    const [columns] = await db.execute('SHOW COLUMNS FROM editor_income_monthly');
    const existingColumns = columns.map(c => c.Field);
    
    console.log('📊 当前表字段:', existingColumns.join(', '));
    console.log('');
    
    const fieldsToAdd = [
      { name: 'source_type', sql: "ADD COLUMN `source_type` enum('chapter_unlock','subscription','mixed') NOT NULL DEFAULT 'mixed' COMMENT '收入来源类型：章节解锁/订阅/混合' AFTER `month`" },
      { name: 'chapter_count_total', sql: "ADD COLUMN `chapter_count_total` int NOT NULL DEFAULT 0 COMMENT '该小说当期用于分配的总章节数（订阅分配时用）' AFTER `source_type`" },
      { name: 'chapter_count_editor', sql: "ADD COLUMN `chapter_count_editor` int NOT NULL DEFAULT 0 COMMENT '该编辑审核的章节数（订阅分配时用）' AFTER `chapter_count_total`" },
      { name: 'contract_share_percent', sql: "ADD COLUMN `contract_share_percent` decimal(8,4) DEFAULT NULL COMMENT '从 novel_editor_contract 取到的基础分成比例' AFTER `editor_share_percent`" },
      { name: 'role', sql: "ADD COLUMN `role` enum('chief_editor','editor','proofreader') DEFAULT NULL COMMENT '本条记录中该管理员的角色' AFTER `editor_admin_id`" }
    ];
    
    const fieldsToAddSql = [];
    for (const field of fieldsToAdd) {
      if (!existingColumns.includes(field.name)) {
        fieldsToAddSql.push(field.sql);
        console.log(`✅ 将添加字段: ${field.name}`);
      } else {
        console.log(`⚠️  字段已存在，跳过: ${field.name}`);
      }
    }
    
    if (fieldsToAddSql.length === 0) {
      console.log('\n✅ 所有字段都已存在，无需执行迁移');
      return;
    }
    
    const alterSql = `ALTER TABLE editor_income_monthly\n  ${fieldsToAddSql.join(',\n  ')}`;
    
    console.log('\n执行 ALTER TABLE 语句...');
    await db.execute(alterSql);
    
    console.log('✅ 迁移执行成功！');
    
    // 验证字段
    const [newColumns] = await db.execute('SHOW COLUMNS FROM editor_income_monthly');
    console.log('\n📊 更新后的表字段:');
    newColumns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });
    
  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message);
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.error('字段已存在，请检查表结构');
    }
    process.exit(1);
  } finally {
    if (db) {
      await db.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

executeMigration();

