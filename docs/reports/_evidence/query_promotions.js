/**
 * TEMP evidence script (non-business-code):
 * - Purpose: read-only query to verify which pricing_promotion rows are currently "displayable" on homepage.
 * - Notes: does NOT write DB; safe to run multiple times.
 *
 * Run:
 *   node docs/reports/_evidence/query_promotions.js
 */
const path = require('path');

function requireMysqlPromise() {
  try {
    return require('mysql2/promise');
  } catch (_) {
    // When executing from repo root, this file is under docs/..., so Node won't look in backend/node_modules.
    // Fallback: resolve from current working directory (run this script from backend/).
    try {
      return require(path.join(process.cwd(), 'node_modules', 'mysql2', 'promise'));
    } catch (e2) {
      throw e2;
    }
  }
}

const mysql = requireMysqlPromise();

async function main() {
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123456',
    database: process.env.DB_NAME || 'kongfuworld',
    charset: 'utf8mb4',
  };

  const conn = await mysql.createConnection(dbConfig);
  const sql = `
    SELECT
      pp.id,
      pp.novel_id,
      n.title AS novel_title,
      pp.promotion_type,
      pp.discount_value,
      pp.stripe_coupon_id,
      pp.start_at,
      pp.end_at,
      pp.status
    FROM pricing_promotion pp
    JOIN novel n ON n.id = pp.novel_id
    WHERE pp.status = 'active'
      AND pp.start_at <= NOW()
      AND (pp.end_at IS NULL OR pp.end_at >= NOW())
      AND pp.promotion_type IN ('discount', 'free')
      AND n.review_status = 'published'
    ORDER BY pp.start_at DESC, pp.id DESC
    LIMIT 50
  `;

  const [rows] = await conn.execute(sql);
  console.log('rows =', rows.length);
  console.log('sample =', JSON.stringify(rows.slice(0, 2), null, 2));
  await conn.end();
}

main().catch((e) => {
  console.error('query_promotions failed:', e);
  process.exit(1);
});


