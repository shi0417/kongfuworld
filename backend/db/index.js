const mysql = require('mysql2/promise');

const TRANSIENT_ERROR_CODES = new Set([
  'PROTOCOL_CONNECTION_LOST',
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
]);

let pool;

function isSelectSql(sql) {
  return typeof sql === 'string' && /^\s*select\b/i.test(sql);
}

function getPool() {
  if (pool) return pool;

  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123456',
    database: process.env.DB_NAME || 'kongfuworld',
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 0,
    enableKeepAlive: true,
    charset: 'utf8mb4',
  });

  // Compatibility: some existing code expects `pool.promise()`
  // For mysql2/promise pool, `execute/query` are already promise-based.
  pool.promise = () => pool;

  // Prevent process crash: surface connection errors without leaking sensitive info.
  pool.on('connection', (conn) => {
    conn.on('error', (err) => {
      console.error('[DB] connection error:', {
        code: err && err.code,
        fatal: !!(err && err.fatal),
      });
    });
  });

  return pool;
}

/**
 * Execute a SQL statement with params.
 * - No SQL/params logging.
 * - One retry for transient disconnects ONLY when idempotent (SELECT by default).
 */
async function query(sql, params = [], opts = {}) {
  const tag = typeof opts.tag === 'string' ? opts.tag : 'db.query';
  const idempotent = opts.idempotent === true || isSelectSql(sql);

  const p = getPool();

  try {
    return await p.execute(sql, params);
  } catch (err) {
    const code = err && err.code;
    const fatal = !!(err && err.fatal);

    if (idempotent && TRANSIENT_ERROR_CODES.has(code)) {
      console.error('[DB] retryable query error:', { tag, code, fatal });
      return await p.execute(sql, params);
    }

    console.error('[DB] query error:', { tag, code, fatal });
    throw err;
  }
}

module.exports = {
  getPool,
  query,
  TRANSIENT_ERROR_CODES,
};


