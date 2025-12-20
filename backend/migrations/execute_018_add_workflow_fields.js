/**
 * 执行迁移 018：为 translation_task 和 chapter_translation 表添加 Workflow 相关字段
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
    connection = await mysql.createConnection(dbConfig);
    console.log('[Migration 018] 数据库连接成功');

    const sqlFile = path.join(__dirname, '018_add_workflow_fields.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // 移除注释行（以 -- 开头的行）
    const sqlWithoutComments = sql
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 0 && !trimmed.startsWith('--');
      })
      .join('\n');

    // 分割 SQL 语句（按分号）
    const statements = sqlWithoutComments
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`[Migration 018] 找到 ${statements.length} 条 SQL 语句`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement) continue;

      try {
        await connection.execute(statement);
        console.log(`[Migration 018] ✅ 执行语句 ${i + 1}/${statements.length} 成功`);
      } catch (err) {
        // 如果字段已存在，忽略错误
        if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_DUP_KEYNAME') {
          console.log(`[Migration 018] ⚠️ 语句 ${i + 1} 跳过（字段/索引已存在）: ${err.message}`);
        } else {
          throw err;
        }
      }
    }

    // 验证字段是否添加成功
    const [translationTaskFields] = await connection.execute(
      "SHOW COLUMNS FROM translation_task WHERE Field IN ('current_step', 'checkpoint')"
    );
    const [chapterTranslationFields] = await connection.execute(
      "SHOW COLUMNS FROM chapter_translation WHERE Field IN ('last_step', 'qa_status')"
    );

    console.log(`[Migration 018] ✅ translation_task 新增字段数: ${translationTaskFields.length}/2`);
    console.log(`[Migration 018] ✅ chapter_translation 新增字段数: ${chapterTranslationFields.length}/2`);

    console.log('[Migration 018] ✅ 迁移完成');
  } catch (error) {
    console.error('[Migration 018] ❌ 迁移失败:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

executeMigration()
  .then(() => {
    console.log('[Migration 018] 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Migration 018] 脚本执行失败:', error);
    process.exit(1);
  });

