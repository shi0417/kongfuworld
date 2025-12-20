require('dotenv').config();

/**
 * checkDailyInputsForMinus30.js
 *
 * 用途：对 engagement_score = -30 的所有 novel_id，执行“最近7天 daily 输入异常体检 SQL”，并 console.table 输出异常行。
 *
 * 体检 SQL（与你给的一致）：
 *   SELECT stat_date,effective_reads,avg_stay_duration_sec,finish_rate,avg_read_chapters_per_user
 *   FROM novel_advanced_stats_daily
 *   WHERE novel_id = ?
 *     AND stat_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
 *     AND (effective_reads<0 OR avg_stay_duration_sec<0 OR finish_rate<0 OR finish_rate>1 OR avg_read_chapters_per_user<0)
 *   ORDER BY stat_date DESC;
 *
 * 用法：
 *   node checkDailyInputsForMinus30.js
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

    const [minus30Rows] = await connection.execute(
      `
        SELECT
          nos.novel_id,
          nos.engagement_score,
          nos.updated_at,
          nos.last_calculated_at
        FROM novel_overall_scores nos
        WHERE nos.engagement_score = -30
        ORDER BY nos.updated_at DESC
      `
    );

    if (!minus30Rows || minus30Rows.length === 0) {
      console.log('未找到 engagement_score = -30 的记录，因此无需体检 daily 输入。');
      return;
    }

    for (const r of minus30Rows) {
      const novelId = r.novel_id;
      console.log(`\n[daily-check][novel=${novelId}] 开始体检（最近7天异常行）...`);

      const [rows] = await connection.execute(
        `
          SELECT
            stat_date,
            effective_reads,
            avg_stay_duration_sec,
            finish_rate,
            avg_read_chapters_per_user
          FROM novel_advanced_stats_daily
          WHERE novel_id = ?
            AND stat_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            AND (
              effective_reads < 0
              OR avg_stay_duration_sec < 0
              OR finish_rate < 0
              OR finish_rate > 1
              OR avg_read_chapters_per_user < 0
            )
          ORDER BY stat_date DESC
        `,
        [novelId]
      );

      if (!rows || rows.length === 0) {
        console.log(`[daily-check][novel=${novelId}] 无异常行（0 rows）。`);
      } else {
        console.table(
          rows.map((x) => ({
            stat_date: x.stat_date,
            effective_reads: x.effective_reads,
            avg_stay_duration_sec: x.avg_stay_duration_sec,
            finish_rate: x.finish_rate,
            avg_read_chapters_per_user: x.avg_read_chapters_per_user
          }))
        );
      }
    }
  } finally {
    if (connection) await connection.end();
  }
}

main().catch((err) => {
  console.error('checkDailyInputsForMinus30 运行失败:', err && err.stack ? err.stack : err);
  process.exit(1);
});


