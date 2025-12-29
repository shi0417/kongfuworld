const express = require('express');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const router = express.Router();

const dbConfig = { host: process.env.DB_HOST || 'localhost', user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '123456', database: process.env.DB_NAME || 'kongfuworld', charset: 'utf8mb4' };
const REQUIRED_ENVS = ['WECHAT_APPID', 'WECHAT_OAUTH_APPSECRET', 'WECHAT_OAUTH_REDIRECT_URI', 'WECHAT_OAUTH_STATE_SECRET', 'SITE_BASE_URL'];
const DEFAULT_RETURN_TO = '/writers-zone?nav=incomeManagement';

const missingEnv = () => REQUIRED_ENVS.filter((k) => !process.env[k] || !String(process.env[k]).trim());
const safeReturnTo = (v) => (typeof v === 'string' && v.startsWith('/') && !v.startsWith('//')) ? v : DEFAULT_RETURN_TO;
const b64uJson = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64url');
const parseB64uJson = (b) => JSON.parse(Buffer.from(String(b), 'base64url').toString('utf8'));
const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('base64url');
const safeEq = (a, b) => (typeof a === 'string' && typeof b === 'string' && a.length === b.length) ? crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)) : false;
const parseAccountData = (v) => {
  if (!v) return {};
  if (typeof v === 'object') return v;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch (_) { return {}; } }
  return {};
};

// Minimal authenticateAuthor copied from writer.js (must not change jwt secret / field mapping)
const authenticateAuthor = async (req, res, next) => {
  let db;
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: '请先登录' });
    const decoded = jwt.verify(token, 'your-secret-key');
    const userId = decoded.userId || decoded.id;
    if (!userId) return res.status(401).json({ success: false, message: '请先登录' });
    db = await mysql.createConnection(dbConfig);
    const [users] = await db.execute('SELECT is_author FROM user WHERE id = ?', [userId]);
    if (users.length === 0 || !users[0].is_author) return res.status(403).json({ success: false, message: '您不是作者，无权访问' });
    req.authorId = userId;
    req.userId = userId;
    return next();
  } catch (_) {
    // Security: do not log token/secret/code/openid
    return res.status(500).json({ success: false, message: '验证失败' });
  } finally {
    if (db) await db.end();
  }
};

router.get('/wechat/authorize', authenticateAuthor, async (req, res) => {
  const missing = missingEnv();
  if (missing.length) return res.status(500).json({ success: false, message: `missing env: ${missing.join(', ')}` });
  const appid = String(process.env.WECHAT_APPID).trim();
  const redirectUri = String(process.env.WECHAT_OAUTH_REDIRECT_URI).trim();
  const stateSecret = String(process.env.WECHAT_OAUTH_STATE_SECRET).trim();
  const returnTo = safeReturnTo(req.query.return_to);
  const now = Math.floor(Date.now() / 1000);
  const payload = { uid: req.authorId, exp: now + 300, nonce: crypto.randomBytes(16).toString('hex'), return_to: returnTo };
  const b64 = b64uJson(payload);
  const state = `${b64}.${hmac(stateSecret, b64)}`;
  const qs = new URLSearchParams({ appid, redirect_uri: redirectUri, response_type: 'code', scope: 'snsapi_base', state });
  return res.json({ success: true, authorize_url: `https://open.weixin.qq.com/connect/oauth2/authorize?${qs.toString()}#wechat_redirect` });
});

router.get('/wechat/callback', async (req, res) => {
  const missing = missingEnv();
  if (missing.length) return res.status(500).json({ success: false, message: `missing env: ${missing.join(', ')}` });
  const appid = String(process.env.WECHAT_APPID).trim();
  const appsecret = String(process.env.WECHAT_OAUTH_APPSECRET).trim();
  const stateSecret = String(process.env.WECHAT_OAUTH_STATE_SECRET).trim();
  const siteBaseUrl = String(process.env.SITE_BASE_URL).trim();
  const code = req.query.code ? String(req.query.code) : '';
  const state = req.query.state ? String(req.query.state) : '';
  if (!code || !state) return res.status(400).json({ success: false, message: 'missing query: code/state' });
  const [b64, sig] = state.split('.');
  if (!b64 || !sig) return res.status(400).json({ success: false, message: 'invalid state' });
  if (!safeEq(sig, hmac(stateSecret, b64))) return res.status(400).json({ success: false, message: 'invalid state signature' });
  let payload;
  try { payload = parseB64uJson(b64); } catch (_) { return res.status(400).json({ success: false, message: 'invalid state payload' }); }
  const now = Math.floor(Date.now() / 1000);
  if (!payload || typeof payload !== 'object' || payload.exp < now) return res.status(400).json({ success: false, message: 'state expired' });
  const uid = payload.uid;
  const returnTo = safeReturnTo(payload.return_to);
  if (!uid) return res.status(400).json({ success: false, message: 'invalid state uid' });

  let openid;
  try {
    const qs = new URLSearchParams({ appid, secret: appsecret, code, grant_type: 'authorization_code' });
    const r = await fetch(`https://api.weixin.qq.com/sns/oauth2/access_token?${qs.toString()}`, { method: 'GET' });
    const data = await r.json();
    if (!data || data.errcode || !data.openid) return res.status(502).json({ success: false, message: 'wechat oauth exchange failed' });
    openid = String(data.openid);
  } catch (_) {
    return res.status(502).json({ success: false, message: 'wechat oauth exchange failed' });
  }

  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    const [rows] = await db.execute("SELECT id, account_data FROM user_payout_account WHERE user_id = ? AND method = 'wechat' ORDER BY created_at DESC LIMIT 1", [uid]);
    if (rows.length) {
      const row = rows[0];
      const existing = parseAccountData(row.account_data);
      const merged = { ...existing, provider: 'wechat', openid };
      if (!merged.real_name && merged.name) merged.real_name = merged.name;
      if (!merged.real_name) merged.real_name = '';
      await db.execute('UPDATE user_payout_account SET account_data = ?, updated_at = NOW() WHERE id = ?', [JSON.stringify(merged), row.id]);
    } else {
      const accountData = { provider: 'wechat', openid, real_name: '' };
      await db.execute("INSERT INTO user_payout_account (user_id, method, account_label, account_data, is_default, created_at, updated_at) VALUES (?, 'wechat', 'WeChat', ?, 0, NOW(), NOW())", [uid, JSON.stringify(accountData)]);
    }
  } catch (_) {
    return res.status(500).json({ success: false, message: 'bind wechat failed' });
  } finally {
    if (db) await db.end();
  }

  try {
    const u = new URL(returnTo, siteBaseUrl);
    u.searchParams.set('bind_status', 'ok');
    return res.redirect(302, u.toString());
  } catch (_) {
    return res.redirect(302, siteBaseUrl);
  }
});

module.exports = router;


