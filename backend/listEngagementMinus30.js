require('dotenv').config();

/**
 * listEngagementMinus30.js
 *
 * 用途：列出 novel_overall_scores 中 engagement_score = -30 的记录，
 * 并 JOIN novel 输出 review_status，方便判断是否可能是“未覆盖/旧值残留”。
 *
 * 用法：
 *   node listEngagementMinus30.js
 */

const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function main() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      `
        SELECT
          nos.novel_id,
          nos.engagement_score,
          nos.updated_at,
          nos.last_calculated_at,
          n.review_status,
          n.title
        FROM novel_overall_scores nos
        LEFT JOIN novel n ON n.id = nos.novel_id
        WHERE nos.engagement_score = -30
        ORDER BY nos.updated_at DESC
      `
    );

    if (!rows || rows.length === 0) {
      console.log('未找到 engagement_score = -30 的记录。');
      return;
    }

    console.table(
      rows.map((r) => ({
        novel_id: r.novel_id,
        engagement_score: r.engagement_score,
        review_status: r.review_status,
        updated_at: r.updated_at,
        last_calculated_at: r.last_calculated_at,
        title: r.title
      }))
    );
  } finally {
    if (connection) await connection.end();
  }
}

main().catch((err) => {
  console.error('listEngagementMinus30 运行失败:', err && err.stack ? err.stack : err);
  process.exit(1);
});


