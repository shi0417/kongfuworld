/**
 * 执行迁移：创建 newscomment / newscomment_like（若不存在）
 * - 使用 Node + mysql2/promise，避免依赖本机 mysql CLI
 * - 读取并执行：backend/migrations/20251215_create_news_comments.sql
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

const migrationFile = path.join(__dirname, '20251215_create_news_comments.sql');

async function tableSet(conn) {
  const [rows] = await conn.execute(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME IN ('newscomment', 'newscomment_like')`,
    [dbConfig.database]
  );
  return new Set((rows || []).map((r) => r.TABLE_NAME));
}

async function executeMigration() {
  let conn;
  try {
    console.log('🔌 Connecting DB...', { host: dbConfig.host, database: dbConfig.database, user: dbConfig.user });
    conn = await mysql.createConnection(dbConfig);

    const before = await tableSet(conn);
    console.log('tables(before)=', Array.from(before));

    if (!before.has('newscomment') || !before.has('newscomment_like')) {
      console.log('📄 Running migration file:', migrationFile);
      const sql = fs.readFileSync(migrationFile, 'utf8');
      await conn.query(sql);
    } else {
      console.log('✅ Tables already exist, skip create.');
    }

    const after = await tableSet(conn);
    console.log('tables(after)=', Array.from(after));

    if (!after.has('newscomment') || !after.has('newscomment_like')) {
      throw new Error('Migration not applied: missing tables');
    }

    console.log('✅ newscomment/newscomment_like ready');
  } finally {
    if (conn) {
      await conn.end();
      console.log('🔌 DB connection closed');
    }
  }
}

if (require.main === module) {
  executeMigration()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error('❌ Migration failed:', e?.message || e);
      process.exit(1);
    });
}

module.exports = { executeMigration };


