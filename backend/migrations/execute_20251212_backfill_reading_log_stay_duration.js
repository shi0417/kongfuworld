/**
 * 数据迁移：回填 reading_log.stay_duration（秒）
 *
 * 默认：仅更新 stay_duration IS NULL 且 page_enter_time/page_exit_time 都不为空的记录（幂等）。
 * 可选：加 --force 参数，将对所有可计算记录重算（会覆盖已有 stay_duration）。
 *
 * 使用方法（推荐在项目根目录执行）：
 *   node backend/migrations/execute_20251212_backfill_reading_log_stay_duration.js
 *   node backend/migrations/execute_20251212_backfill_reading_log_stay_duration.js --force
 *
 * 可选参数：
 *   --batch=50000   每批按 id 范围更新的大小（默认 50000）
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// 尝试加载环境变量（不强依赖）
function tryLoadEnv() {
  try {
    // eslint-disable-next-line global-require
    const dotenv = require('dotenv');

    const candidates = [
      // 新的 env 加载机制
      path.join(process.cwd(), 'backend', '.env.production'),
      path.join(process.cwd(), '.env.production'),
      path.join(__dirname, '..', '.env.production'),
      // 本地开发环境
      path.join(process.cwd(), 'backend', '.env.local'),
      path.join(process.cwd(), '.env.local'),
      path.join(__dirname, '..', '.env.local'),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        dotenv.config({ path: p });
        console.log(`✅ 已加载环境变量: ${p}`);
        return;
      }
    }
    console.log('ℹ️ 未找到 env 文件，将使用进程环境变量或默认值');
  } catch {
    console.log('ℹ️ dotenv 不可用，将使用进程环境变量或默认值');
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');

  let batchSize = 50000;
  const batchArg = args.find(a => a.startsWith('--batch='));
  if (batchArg) {
    const raw = batchArg.split('=')[1];
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) batchSize = Math.floor(n);
  }

  return { force, batchSize };
}

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4',
};

function calcStayDurationExprSql() {
  // 与 backend/routes/reading_timing.js 的规则一致
  return `
    CASE
      WHEN page_enter_time IS NULL OR page_exit_time IS NULL THEN NULL
      WHEN TIMESTAMPDIFF(SECOND, page_enter_time, page_exit_time) < 0 THEN 0
      ELSE TIMESTAMPDIFF(SECOND, page_enter_time, page_exit_time)
    END
  `;
}

async function fetchStats(connection) {
  const [rows] = await connection.execute(
    `
    SELECT
      COUNT(*) AS total,
      SUM(stay_duration IS NULL) AS stay_duration_null,
      SUM(page_enter_time IS NOT NULL AND page_exit_time IS NOT NULL) AS has_enter_and_exit,
      SUM(
        page_enter_time IS NOT NULL AND page_exit_time IS NOT NULL
        AND (stay_duration IS NULL)
      ) AS can_calc_and_missing
    FROM reading_log
    `
  );
  return rows[0];
}

async function sampleVerify(connection) {
  const [rows] = await connection.execute(
    `
    SELECT
      id,
      page_enter_time,
      page_exit_time,
      stay_duration,
      TIMESTAMPDIFF(SECOND, page_enter_time, page_exit_time) AS calculated_raw
    FROM reading_log
    WHERE page_enter_time IS NOT NULL AND page_exit_time IS NOT NULL
    ORDER BY id DESC
    LIMIT 10
    `
  );
  return rows;
}

async function executeMigration() {
  tryLoadEnv();
  const { force, batchSize } = parseArgs();

  let connection;
  try {
    console.log('\n🔌 正在连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    console.log(`   DB: ${dbConfig.database} @ ${dbConfig.host} (user: ${dbConfig.user})`);

    console.log('\n📊 迁移前统计:');
    const before = await fetchStats(connection);
    console.table(before);

    // 找到需要更新的 id 范围（用于分批更新，减少单次锁表压力）
    const whereNeedUpdate = force
      ? 'page_enter_time IS NOT NULL AND page_exit_time IS NOT NULL'
      : 'page_enter_time IS NOT NULL AND page_exit_time IS NOT NULL AND stay_duration IS NULL';

    const [rangeRows] = await connection.execute(
      `SELECT MIN(id) AS min_id, MAX(id) AS max_id, COUNT(*) AS cnt FROM reading_log WHERE ${whereNeedUpdate}`
    );
    const range = rangeRows[0];

    if (!range.cnt || range.cnt === 0 || range.min_id == null || range.max_id == null) {
      console.log('\n✅ 无需迁移：没有符合条件的记录需要更新。');
      const afterNoop = await fetchStats(connection);
      console.table(afterNoop);
      return;
    }

    console.log(
      `\n🧩 开始回填 stay_duration：${force ? 'force=ON(覆盖重算)' : 'force=OFF(仅补空)'}，` +
      `待处理记录数≈${range.cnt}，id范围=[${range.min_id}, ${range.max_id}]，batch=${batchSize}`
    );

    let affectedTotal = 0;
    const expr = calcStayDurationExprSql();

    for (let startId = range.min_id; startId <= range.max_id; startId += batchSize) {
      const endId = Math.min(range.max_id, startId + batchSize - 1);

      const [result] = await connection.execute(
        `
        UPDATE reading_log
        SET stay_duration = ${expr}
        WHERE id BETWEEN ? AND ?
          AND page_enter_time IS NOT NULL
          AND page_exit_time IS NOT NULL
          ${force ? '' : 'AND stay_duration IS NULL'}
        `,
        [startId, endId]
      );

      affectedTotal += result.affectedRows || 0;

      // 低噪音进度输出：每 10 批打印一次
      const batchIndex = Math.floor((startId - range.min_id) / batchSize) + 1;
      if (batchIndex === 1 || batchIndex % 10 === 0 || endId === range.max_id) {
        console.log(`  - 批次 ${batchIndex}: id[${startId}, ${endId}] affected=${result.affectedRows}`);
      }
    }

    console.log(`\n✅ 更新完成：累计 affectedRows=${affectedTotal}`);

    console.log('\n📊 迁移后统计:');
    const after = await fetchStats(connection);
    console.table(after);

    console.log('\n🔎 抽样校验(最近10条可计算记录):');
    const samples = await sampleVerify(connection);
    console.table(
      samples.map(r => ({
        id: r.id,
        page_enter_time: r.page_enter_time,
        page_exit_time: r.page_exit_time,
        stay_duration: r.stay_duration,
        calculated_raw: r.calculated_raw,
      }))
    );

    console.log('\n🎉 迁移完成！');
  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message);
    if (error.code) console.error('   错误代码:', error.code);
    if (error.sql) console.error('   SQL(截断):', String(error.sql).slice(0, 300));
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

executeMigration();


