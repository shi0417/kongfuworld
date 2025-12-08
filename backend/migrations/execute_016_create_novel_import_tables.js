/**
 * 执行迁移016：创建小说导入批次和章节草稿表
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4',
  multipleStatements: true, // 允许执行多条 SQL
};

async function executeMigration() {
  let connection;
  try {
    console.log('[Migration 016] 开始执行迁移...');
    
    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    console.log('[Migration 016] 数据库连接成功');

    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, '016_create_novel_import_tables.sql');
    const sqlContent = await fs.readFile(sqlPath, 'utf8');

    // 执行 SQL（使用 multipleStatements 直接执行整个文件）
    // 先移除单行注释，然后执行
    const cleanedSql = sqlContent
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('--');
      })
      .join('\n');

    try {
      // 执行整个 SQL 文件
      await connection.query(cleanedSql);
      console.log('[Migration 016] SQL 执行成功');
    } catch (error) {
      // 如果表已存在，忽略错误
      if (error.code === 'ER_TABLE_EXISTS_ERROR' || error.message.includes('already exists')) {
        console.log('[Migration 016] 表已存在，跳过创建');
      } else {
        console.error('[Migration 016] SQL 执行错误:', error.message);
        throw error;
      }
    }

    console.log('[Migration 016] 迁移执行完成！');
    console.log('[Migration 016] 已创建表：novel_import_batch, novel_import_chapter');

  } catch (error) {
    console.error('[Migration 016] 迁移执行失败:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 执行迁移
executeMigration();

