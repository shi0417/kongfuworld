/**
 * 执行迁移017：为 novel_import_chapter 表添加预检查字段
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
  multipleStatements: true,
};

async function executeMigration() {
  let connection;
  try {
    console.log('[Migration 017] 开始执行迁移...');
    
    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    console.log('[Migration 017] 数据库连接成功');

    // 直接执行 ALTER TABLE 语句
    const statements = [
      `ALTER TABLE \`novel_import_chapter\`
        ADD COLUMN \`has_issue\` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否有疑似问题（标题/正文广告/异常）',
        ADD COLUMN \`issue_tags\` VARCHAR(255) DEFAULT NULL COMMENT '问题标签，逗号分隔，例如 title_suspect,ad_line',
        ADD COLUMN \`issue_summary\` VARCHAR(255) DEFAULT NULL COMMENT '简要说明，如"标题含网址; 正文含广告语"'`,
      `ALTER TABLE \`novel_import_chapter\`
        ADD INDEX \`idx_has_issue\` (\`has_issue\`)`
    ];

    // 执行每个 SQL 语句
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (!statement) {
        continue;
      }

      try {
        console.log(`[Migration 017] 执行语句 ${i + 1}/${statements.length}...`);
        await connection.query(statement);
        console.log(`[Migration 017] 语句 ${i + 1} 执行成功`);
      } catch (error) {
        // 如果字段或索引已存在，忽略错误
        if (
          error.code === 'ER_DUP_FIELDNAME' ||
          error.code === 'ER_DUP_KEYNAME' ||
          error.message.includes('Duplicate column name') ||
          error.message.includes('Duplicate key name')
        ) {
          console.log(`[Migration 017] 字段或索引已存在，跳过: ${error.message}`);
        } else {
          console.error(`[Migration 017] 语句 ${i + 1} 执行错误:`, error.message);
          console.error(`[Migration 017] SQL:`, statement);
          throw error;
        }
      }
    }

    // 验证字段是否添加成功
    console.log('[Migration 017] 验证字段...');
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'novel_import_chapter'
      AND COLUMN_NAME IN ('has_issue', 'issue_tags', 'issue_summary')
      ORDER BY COLUMN_NAME
    `, [dbConfig.database]);

    if (columns.length === 3) {
      console.log('[Migration 017] ✅ 所有字段已成功添加：');
      columns.forEach(col => {
        console.log(`  - ${col.COLUMN_NAME}: ${col.COLUMN_TYPE} (${col.COLUMN_COMMENT || '无注释'})`);
      });
    } else {
      console.warn(`[Migration 017] ⚠️  预期添加 3 个字段，实际找到 ${columns.length} 个字段`);
      columns.forEach(col => {
        console.log(`  - ${col.COLUMN_NAME}: ${col.COLUMN_TYPE}`);
      });
    }

    // 验证索引
    const [indexes] = await connection.query(`
      SELECT INDEX_NAME, COLUMN_NAME
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'novel_import_chapter'
      AND INDEX_NAME = 'idx_has_issue'
    `, [dbConfig.database]);

    if (indexes.length > 0) {
      console.log('[Migration 017] ✅ 索引 idx_has_issue 已成功添加');
    } else {
      console.warn('[Migration 017] ⚠️  索引 idx_has_issue 未找到');
    }

    console.log('[Migration 017] 迁移执行完成！');

  } catch (error) {
    console.error('[Migration 017] 迁移执行失败:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 执行迁移
executeMigration();

