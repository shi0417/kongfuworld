const express = require('express');
const mysql = require('mysql2/promise');
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4',
  supportBigNumbers: true,
  bigNumberStrings: true
};

const ALLOWED_SOURCE = new Set(['karma', 'champion']);
const ALLOWED_STATUS = new Set(['pending', 'completed', 'failed', 'cancelled', 'refunded']);
const ALLOWED_TYPE = new Set([
  'karma_purchase',
  'karma_consumption',
  'karma_reward',
  'karma_refund',
  'champion_new',
  'champion_renew',
  'champion_upgrade',
  'champion_refund'
]);

const clampInt = (n, min, max, fallback) => {
  const x = parseInt(String(n ?? ''), 10);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, x));
};

const parseCsvList = (raw) => {
  const s = String(raw || '').trim();
  if (!s) return [];
  return s.split(',').map(v => v.trim()).filter(Boolean);
};

const pickAuthedUserId = (req) => Number(req.user?.userId ?? req.user?.id ?? req.user?.uid);

const safeJsonParse = (raw) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const formatTierSnapshot = (snap) => {
  if (!snap) return null;
  const tierLevel = snap.tier_level ?? snap.tierLevel ?? null;
  const endDateRaw = snap.end_date ?? snap.endDate ?? null;
  const end = endDateRaw ? String(endDateRaw).slice(0, 10) : null;
  if (tierLevel && end) return `Tier${tierLevel} until ${end}`;
  if (tierLevel) return `Tier${tierLevel}`;
  return null;
};

router.get('/transactions', authenticateToken, async (req, res) => {
  let db;
  try {
    const userId = pickAuthedUserId(req);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // 禁止外部覆盖 userId（即使传了也忽略；仅记录校验用）
    const providedUserId = req.query.userId ?? req.headers['user-id'];
    if (providedUserId != null && String(providedUserId).trim() !== '' && Number(providedUserId) !== userId) {
      // 明确越权意图：直接 403
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const page = clampInt(req.query.page, 1, 999999, 1);
    const pageSizeRaw = (req.query.page_size ?? req.query.limit);
    const pageSize = clampInt(pageSizeRaw, 1, 100, 20);
    const offset = (page - 1) * pageSize;

    const typeFilter = parseCsvList(req.query.type).filter(t => ALLOWED_TYPE.has(t));
    const statusFilter = parseCsvList(req.query.status).filter(s => ALLOWED_STATUS.has(s));
    const q = String(req.query.q || '').trim();

    // 时间范围：仅当显式传入才过滤；默认全量
    const startRaw = String(req.query.start || req.query.time_min || '').trim();
    const endRaw = String(req.query.end || req.query.time_max || '').trim();
    const start = startRaw || null;
    const end = endRaw || null;

    db = await mysql.createConnection(dbConfig);

    // 兼容不同环境字段：按实际存在的列构造表达式，避免 SQL 直接报错
    const [championColsRows] = await db.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'user_champion_subscription_record'
         AND COLUMN_NAME IN (
           'stripe_payment_intent_id','paypal_order_id','stripe_subscription_id','transaction_id',
           'before_membership_snapshot','after_membership_snapshot','currency'
         )`
    );
    const championCols = new Set((championColsRows || []).map(r => r.COLUMN_NAME));

    const champProviderRefCandidates = [
      championCols.has('stripe_payment_intent_id') ? 'ucsr.stripe_payment_intent_id' : null,
      championCols.has('paypal_order_id') ? 'ucsr.paypal_order_id' : null,
      championCols.has('stripe_subscription_id') ? 'ucsr.stripe_subscription_id' : null,
      championCols.has('transaction_id') ? 'ucsr.transaction_id' : null
    ].filter(Boolean);
    const champProviderRefExpr = champProviderRefCandidates.length
      ? `COALESCE(${champProviderRefCandidates.join(', ')})`
      : 'NULL';

    const champBeforeSnapExpr = championCols.has('before_membership_snapshot') ? 'ucsr.before_membership_snapshot' : 'NULL';
    const champAfterSnapExpr = championCols.has('after_membership_snapshot') ? 'ucsr.after_membership_snapshot' : 'NULL';
    const champCurrencyExpr = championCols.has('currency') ? `COALESCE(ucsr.currency, 'USD')` : `'USD'`;

    // Karma 表列也做兼容，防止环境缺列导致查询失败
    const [karmaColsRows] = await db.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'user_karma_transactions'
         AND COLUMN_NAME IN (
           'stripe_payment_intent_id','paypal_order_id','transaction_id','currency',
           'amount_paid','balance_before','balance_after','karma_amount',
           'description','reason','payment_method','novel_id','chapter_id','transaction_type','status','created_at'
         )`
    );
    const karmaCols = new Set((karmaColsRows || []).map(r => r.COLUMN_NAME));

    const karmaProviderRefCandidates = [
      karmaCols.has('stripe_payment_intent_id') ? 'ukt.stripe_payment_intent_id' : null,
      karmaCols.has('paypal_order_id') ? 'ukt.paypal_order_id' : null,
      karmaCols.has('transaction_id') ? 'ukt.transaction_id' : null
    ].filter(Boolean);
    const karmaProviderRefExpr = karmaProviderRefCandidates.length
      ? `COALESCE(${karmaProviderRefCandidates.join(', ')})`
      : 'NULL';

    const karmaCurrencyExpr = karmaCols.has('currency') ? `COALESCE(ukt.currency, 'USD')` : `'USD'`;
    const karmaAmountPaidExpr = karmaCols.has('amount_paid') ? 'ukt.amount_paid' : 'NULL';
    const karmaBalanceBeforeExpr = karmaCols.has('balance_before') ? 'ukt.balance_before' : 'NULL';
    const karmaBalanceAfterExpr = karmaCols.has('balance_after') ? 'ukt.balance_after' : 'NULL';
    const karmaKarmaAmountExpr = karmaCols.has('karma_amount') ? 'ukt.karma_amount' : '0';
    const karmaDescriptionExpr = karmaCols.has('description') ? 'ukt.description' : 'NULL';
    const karmaReasonExpr = karmaCols.has('reason') ? 'ukt.reason' : 'NULL';
    const karmaPaymentMethodExpr = karmaCols.has('payment_method') ? 'ukt.payment_method' : 'NULL';
    const karmaNovelIdExpr = karmaCols.has('novel_id') ? 'ukt.novel_id' : 'NULL';
    const karmaChapterIdExpr = karmaCols.has('chapter_id') ? 'ukt.chapter_id' : 'NULL';
    const karmaTransactionTypeExpr = karmaCols.has('transaction_type') ? 'ukt.transaction_type' : 'NULL';
    const karmaStatusExpr = karmaCols.has('status') ? 'ukt.status' : 'NULL';

    const unionSql = `
      SELECT
        CONCAT('CHAMP:', ucsr.id) AS row_id,
        'champion' AS source,
        ucsr.created_at AS occurred_at,
        CASE
          WHEN (CASE
            WHEN ucsr.payment_status = 'pending' THEN 'pending'
            WHEN ucsr.payment_status = 'completed' THEN 'completed'
            WHEN ucsr.payment_status = 'failed' THEN 'failed'
            WHEN ucsr.payment_status = 'refunded' THEN 'refunded'
            ELSE 'failed'
          END) = 'refunded' THEN 'champion_refund'
          WHEN ucsr.subscription_type = 'new' THEN 'champion_new'
          WHEN ucsr.subscription_type IN ('renew','extend') THEN 'champion_renew'
          WHEN ucsr.subscription_type = 'upgrade' THEN 'champion_upgrade'
          ELSE 'champion_new'
        END AS type,
        CASE
          WHEN ucsr.payment_status = 'pending' THEN 'pending'
          WHEN ucsr.payment_status = 'completed' THEN 'completed'
          WHEN ucsr.payment_status = 'failed' THEN 'failed'
          WHEN ucsr.payment_status = 'refunded' THEN 'refunded'
          ELSE 'failed'
        END AS status,
        CONCAT('[Champion] ', COALESCE(ucsr.tier_name,'Tier'), ' - ', COALESCE(n.title, CONCAT('#', ucsr.novel_id))) AS description,
        ${champCurrencyExpr} AS currency,
        ucsr.payment_amount AS amount_paid,
        NULL AS delta_label,
        NULL AS before_label,
        NULL AS after_label,
        ucsr.payment_method AS provider,
        ${champProviderRefExpr} AS provider_ref,
        ucsr.novel_id AS novel_id,
        n.title AS novel_title,
        NULL AS chapter_id,
        ${champBeforeSnapExpr} AS _before_snapshot,
        ${champAfterSnapExpr} AS _after_snapshot,
        ucsr.payment_status AS status_raw
      FROM user_champion_subscription_record ucsr
      LEFT JOIN novel n ON n.id = ucsr.novel_id
      WHERE ucsr.user_id = ?

      UNION ALL

      SELECT
        CONCAT('KARMA:', ukt.id) AS row_id,
        'karma' AS source,
        ukt.created_at AS occurred_at,
        CASE
          WHEN ${karmaTransactionTypeExpr} = 'purchase' THEN 'karma_purchase'
          WHEN ${karmaTransactionTypeExpr} = 'consumption' THEN 'karma_consumption'
          WHEN ${karmaTransactionTypeExpr} = 'reward' THEN 'karma_reward'
          WHEN ${karmaTransactionTypeExpr} = 'refund' THEN 'karma_refund'
          ELSE 'karma_reward'
        END AS type,
        CASE
          WHEN ${karmaStatusExpr} IN ('pending','completed','failed','cancelled') THEN ${karmaStatusExpr}
          ELSE 'failed'
        END AS status,
        COALESCE(
          ${karmaDescriptionExpr},
          ${karmaReasonExpr},
          CONCAT('Karma ', COALESCE(${karmaTransactionTypeExpr}, 'transaction'), COALESCE(CONCAT(' - ', n.title), ''))
        ) AS description,
        ${karmaCurrencyExpr} AS currency,
        ${karmaAmountPaidExpr} AS amount_paid,
        CONCAT(
          CASE WHEN ${karmaKarmaAmountExpr} >= 0 THEN '+' ELSE '-' END,
          ABS(${karmaKarmaAmountExpr}),
          ' Karma'
        ) AS delta_label,
        CASE WHEN ${karmaBalanceBeforeExpr} IS NULL THEN NULL ELSE CONCAT('Karma ', ${karmaBalanceBeforeExpr}) END AS before_label,
        CASE WHEN ${karmaBalanceAfterExpr} IS NULL THEN NULL ELSE CONCAT('Karma ', ${karmaBalanceAfterExpr}) END AS after_label,
        ${karmaPaymentMethodExpr} AS provider,
        ${karmaProviderRefExpr} AS provider_ref,
        ${karmaNovelIdExpr} AS novel_id,
        n.title AS novel_title,
        ${karmaChapterIdExpr} AS chapter_id,
        NULL AS _before_snapshot,
        NULL AS _after_snapshot,
        NULL AS status_raw
      FROM user_karma_transactions ukt
      LEFT JOIN novel n ON n.id = ${karmaNovelIdExpr}
      WHERE ukt.user_id = ?
    `;

    const where = [];
    const params = [userId, userId];

    if (typeFilter.length) {
      where.push(`t.type IN (${typeFilter.map(() => '?').join(',')})`);
      params.push(...typeFilter);
    }
    if (statusFilter.length) {
      where.push(`t.status IN (${statusFilter.map(() => '?').join(',')})`);
      params.push(...statusFilter);
    }
    if (q) {
      where.push(`(
        COALESCE(t.description,'') LIKE ?
        OR COALESCE(t.provider_ref,'') LIKE ?
        OR COALESCE(t.novel_title,'') LIKE ?
      )`);
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    if (start) {
      where.push(`t.occurred_at >= ?`);
      params.push(start);
    }
    if (end) {
      where.push(`t.occurred_at <= ?`);
      params.push(end);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) AS total FROM (${unionSql}) t ${whereSql}`;
    const [countRows] = await db.query(countSql, params);
    const total = Number(countRows?.[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const dataSql = `
      SELECT
        t.row_id,
        t.source,
        t.occurred_at,
        t.type,
        t.status,
        t.description,
        t.currency,
        t.amount_paid,
        t.delta_label,
        t.before_label,
        t.after_label,
        t.provider,
        t.provider_ref,
        t.novel_id,
        t.novel_title,
        t.chapter_id,
        t._before_snapshot,
        t._after_snapshot
      FROM (${unionSql}) t
      ${whereSql}
      ORDER BY t.occurred_at DESC
      LIMIT ? OFFSET ?
    `;
    const paramsData = [...params, pageSize, offset];
    const [rows] = await db.query(dataSql, paramsData);

    const outRows = (rows || []).map((r) => {
      if (!ALLOWED_SOURCE.has(r.source)) return r;
      if (r.source !== 'champion') {
        const { _before_snapshot, _after_snapshot, ...rest } = r;
        return rest;
      }

      const beforeSnap = safeJsonParse(r._before_snapshot);
      const afterSnap = safeJsonParse(r._after_snapshot);
      const beforeLabel = formatTierSnapshot(beforeSnap);
      const afterLabel = formatTierSnapshot(afterSnap);

      let delta = null;
      const bt = beforeSnap?.tier_level ?? beforeSnap?.tierLevel ?? null;
      const at = afterSnap?.tier_level ?? afterSnap?.tierLevel ?? null;
      if (bt && at && bt !== at) delta = `Tier${bt} → Tier${at}`;
      else if (beforeLabel || afterLabel) delta = 'Subscription';

      const { _before_snapshot, _after_snapshot, ...rest } = r;
      return {
        ...rest,
        before_label: beforeLabel,
        after_label: afterLabel,
        delta_label: r.delta_label || delta
      };
    });

    return res.json({
      success: true,
      data: {
        rows: outRows,
        pagination: {
          page,
          page_size: pageSize,
          total,
          total_pages: totalPages
        }
      }
    });
  } catch (error) {
    console.error('billing transactions error:', error);
    return res.status(500).json({ success: false, message: '获取交易流水失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

module.exports = router;


