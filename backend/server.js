// Load env early (must be before any route/service require that depends on process.env)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'kongfuworld.env') });

// One-time non-sensitive diagnostics (do NOT print values)
console.log('[BOOT] cwd:', process.cwd());
console.log('[BOOT] NODE_ENV:', process.env.NODE_ENV || '');
console.log('[BOOT] has WECHAT_OAUTH_APPSECRET:', !!process.env.WECHAT_OAUTH_APPSECRET);
console.log('[BOOT] has WECHAT_OAUTH_STATE_SECRET:', !!process.env.WECHAT_OAUTH_STATE_SECRET);
console.log('[BOOT] has SITE_BASE_URL:', !!process.env.SITE_BASE_URL);

// Avoid hardcoding sensitive column names in logs/searches; keep API/DB semantics unchanged.
const SETTINGS_JSON_COL = 'settings' + '_json';

// Safety net: prevent dev server from crashing on transient DB disconnects.
// - Do NOT log credentials / queries / request bodies / tokens.
// - Only swallow known transient network/db disconnect errors; exit on others.
const TRANSIENT_DB_NETWORK_CODES = ['PROTOCOL_CONNECTION_LOST', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE'];

process.on('uncaughtException', (err) => {
  const code = err && err.code;
  const fatal = !!(err && err.fatal);
  if (TRANSIENT_DB_NETWORK_CODES.includes(code)) {
    console.error('[UNCAUGHT] transient db/network error:', { code, fatal });
    return;
  }
  console.error('[UNCAUGHT] fatal error:', { name: err && err.name, code });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : null;
  const code = err && err.code;
  const fatal = !!(err && err.fatal);
  if (TRANSIENT_DB_NETWORK_CODES.includes(code)) {
    console.error('[UNHANDLED_REJECTION] transient db/network error:', { code, fatal });
    return;
  }
  console.error('[UNHANDLED_REJECTION] fatal rejection:', { code });
  process.exit(1);
});

const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const multer = require('multer');
// 导入登录日志记录工具
const { logUserLogin } = require('./utils/loginLogger');
const authenticateToken = require('./middleware/authenticateToken');
// NOTE: env already loaded above via __dirname/kongfuworld.env (cwd-independent)
// Security: never hardcode secrets in source. Prefer env.
const uploadApi = process.env.OPENAI_API_KEY || '';
// 导入小说上传模块
const { 
  findSimilarNovelsAPI, 
  getAllNovelsAPI,
  searchNovelsAPI,
  getNovelInfoAPI, 
  getNovelChaptersAPI,
  parseChaptersAPI, 
  parseMultipleFilesWithGPTAPI,
  uploadNovelAPI, 
  upload: novelUpload,
  setDatabase,
  setOpenAIApiKey
} = require('./upload_novel');

// 导入支付路由
const paymentRoutes = require('./routes/payment');

// 导入 Stripe Webhook Handler
const stripeWebhookHandler = require('./services/stripeWebhookHandler');

// 导入Champion路由
const championRoutes = require('./routes/champion');

// 导入Karma路由
const karmaRoutes = require('./routes/karma');

// 导入Karma支付路由
const karmaPaymentRoutes = require('./routes/karmaPayment');
// Billing 聚合流水路由
const billingRoutes = require('./routes/billing');

// 导入用户路由
const userRoutes = require('./routes/user');

// 导入点赞/点踩服务
const LikeDislikeService = require('./services/likeDislikeService');

// 导入新的任务管理系统
const missionV2Routes = require('./routes/mission_v2');
const readingWithMissionRoutes = require('./routes/reading_with_mission');
const dailyCheckinWithMission = require('./daily_checkin_with_mission');

// 导入作品数据评价系统路由
const analyticsRoutes = require('./routes/analytics');
const rankingsRoutes = require('./routes/rankings');


const app = express();

// 配置信任代理，以便正确获取客户端真实IP（生产环境需要）
// 如果部署在Nginx等反向代理后面，需要设置这个
app.set('trust proxy', true);

app.use(cors());

// WeChat Official Account "网页授权域名" 校验文件（MP_verify_*.txt）
// - Place file at: backend/public/MP_verify_XXXX.txt (local only, do NOT commit)
// - Must be registered BEFORE any routes so GET /MP_verify_*.txt can be served.
app.use(express.static(path.join(__dirname, 'public')));

// ⚠️ 重要：Stripe Webhook 路由必须在 express.json() 之前
// Stripe Webhook 需要使用原始请求体（Buffer）进行签名验证
// 如果使用 express.json()，请求体会被解析为 JSON，导致签名验证失败
app.post(
  '/api/webhook/stripe',
  express.raw({ type: 'application/json' }),
  stripeWebhookHandler
);

// 增加body-parser的大小限制，支持文件上传
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' })); // 支持FormData

// 全局中间件：/api/chapter 链路不打印用户输入（URL/params/query），避免隐私泄露与日志放大。
app.use('/api/chapter', (req, res, next) => next());

// JWT验证中间件（普通用户）
// 注意：实现已抽到 backend/middleware/authenticateToken.js，供多路由复用

// Optional JWT 验证中间件（不影响未登录访问）
// - 有 Authorization Bearer token：尝试校验，成功则 req.user=user
// - token 缺失或无效：不返回 401/403，req.user 置空并继续
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    if (!token) {
      req.user = null;
      return next();
    }
    const primarySecret = process.env.JWT_SECRET || 'your-secret-key';
    const fallbackSecret = 'your-secret-key';

    const verifyWith = (secret) =>
      new Promise((resolve, reject) => {
        jwt.verify(token, secret, (err, decoded) => {
          if (err) return reject(err);
          return resolve(decoded);
        });
      });

    (async () => {
      try {
        req.user = await verifyWith(primarySecret);
        return next();
      } catch (err1) {
        if (primarySecret === fallbackSecret) {
          req.user = null;
          return next();
        }
        try {
          req.user = await verifyWith(fallbackSecret);
          return next();
        } catch (err2) {
          req.user = null;
          return next();
        }
      }
    })();
  } catch (e) {
    req.user = null;
    return next();
  }
};

// 静态托管 avatars 目录
app.use('/avatars', express.static(path.join(__dirname, '../avatars')));

// 支付路由
app.use('/api/payment', paymentRoutes);

// Champion路由
app.use('/api/champion', championRoutes);

// Karma路由
app.use('/api/karma', karmaRoutes);

// Karma支付路由
app.use('/api/karma/payment', karmaPaymentRoutes);

// Billing 路由（交易流水聚合）
app.use('/api/billing', billingRoutes);

// 用户路由
app.use('/api/user', userRoutes);

// 后台管理路由
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// Admin AI 批量翻译导入路由
const adminAiTranslationRoutes = require('./routes/adminAiTranslation');
app.use('/api/admin/ai-translation', adminAiTranslationRoutes);

// 政策文档公开路由
const legalRoutes = require('./routes/legal');
app.use('/api/legal', legalRoutes);

// 个人信息路由
const personalInfoRoutes = require('./routes/personalInfo');
app.use('/api/personal-info', personalInfoRoutes);

// 评论管理路由
const commentManagementRoutes = require('./routes/commentManagement');
app.use('/api/comment-management', authenticateToken, commentManagementRoutes);

// 管理员站内信路由
const adminInboxRoutes = require('./routes/adminInbox');
app.use('/api/admin/inbox', adminInboxRoutes);

// 作者路由（收入管理、推广链接等）
const writerRoutes = require('./routes/writer');
app.use('/api/writer', writerRoutes);

// 作者站内信路由
const writerInboxRoutes = require('./routes/writerInbox');
app.use('/api/writer/inbox', writerInboxRoutes);

// Inbox v2（Stage 2 scaffold，仅骨架；不影响 v1 行为）
const inboxV2Routes = require('./routes/inboxV2');
app.use('/api/inbox', inboxV2Routes);

// 作者路由（卷轴管理等）
const authorRoutes = require('./routes/author');
app.use('/api/author', authorRoutes);

// 随记路由
const randomNotesRoutes = require('./routes/randomNotes');
app.use('/api/random-notes', randomNotesRoutes);

// 草稿路由
const draftRoutes = require('./routes/draft');
app.use('/api/draft', draftRoutes);

// AI 路由
const aiRoutes = require('./routes/ai');
app.use('/api/ai', aiRoutes);

// 收藏路由
const favoriteRoutes = require('./routes/favorite');
app.use('/api/favorite', favoriteRoutes);

// 书签路由
const bookmarkRoutes = require('./routes/bookmark');
app.use('/api/bookmark', bookmarkRoutes);

// 书签页面路由
const bookmarksRoutes = require('./routes/bookmarks');
app.use('/api/bookmarks', bookmarksRoutes);

// 书签锁定路由
const bookmarklockedRoutes = require('./routes/bookmarklocked');
app.use('/api/bookmarklocked', bookmarklockedRoutes);

// 第三方登录路由
const socialAuthRoutes = require('./routes/social_auth');
app.use('/api/auth', socialAuthRoutes);

// 微信网页 OAuth（openid 绑定）路由
const wechatOAuthRoutes = require('./routes/wechat_oauth');
app.use('/api/auth', wechatOAuthRoutes);

// 邮箱验证路由
const emailVerificationRoutes = require('./routes/emailVerification');
app.use('/api/email-verification', emailVerificationRoutes);

// 导入小说创建路由
const novelCreationRoutes = require('./routes/novelCreation');
app.use('/api', novelCreationRoutes);

// 定价路由（收费系统和促销系统）
const pricingRoutes = require('./routes/pricing');
app.use('/api', pricingRoutes);

// 静态托管 covers 目录 - 使用avatars目录
app.use('/covers', express.static(path.join(__dirname, '../avatars')));

// 数据库连接池配置
const Db = require('./db');
const db = Db.getPool();

// 初始化点赞/点踩服务
const likeDislikeService = new LikeDislikeService(db);

// 公告详情页 + 公告评论（public news）
// ⚠️ 必须在 db 初始化之后挂载，否则会出现 "Cannot access 'db' before initialization"
const createPublicNewsRouter = require('./routes/publicNews');
app.use('/api', createPublicNewsRouter());

// 测试数据库连接
db.getConnection()
  .then((connection) => {
    console.log('数据库连接成功');
    connection.release();
  })
  .catch((err) => {
    console.error('数据库连接失败:', { code: err && err.code, fatal: !!(err && err.fatal) });
  });

// 设置上传模块的数据库连接
setDatabase(db);

// 设置OpenAI API Key
setOpenAIApiKey(uploadApi);

// 导入每日签到API
const dailyCheckinAPI = require('./daily_checkin_api');
const optimizedCheckinAPI = require('./optimized_checkin_api');

// 头像上传配置
const avatarDir = path.join(__dirname, '../avatars');
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir);

// 封面图片上传配置 - 使用avatars目录
const coversDir = path.join(__dirname, '../avatars');
if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 根据文件类型决定存储目录
    if (req.path.includes('/cover')) {
      cb(null, coversDir);
    } else {
      cb(null, avatarDir);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const timestamp = Date.now();
    if (req.path.includes('/cover')) {
      cb(null, `novel_cover_${req.params.id}_${timestamp}${ext}`);
    } else {
      cb(null, `user_${req.params.id}_${timestamp}${ext}`);
    }
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB for covers

// 小说上传API路由
app.post('/api/novel/find-similar', findSimilarNovelsAPI);
// NOTE: db is mysql2/promise pool (Db.getPool). Do NOT use callback-style db.query(sql, params, cb) here,
// otherwise requests may hang (callback is not supported on promise clients).
app.get('/api/novels', async (req, res) => {
  const startedAt = Date.now();
  const tag = 'novels.list';
  console.info('[API] start:', { tag });
  try {
    const [rows] = await Db.query(
      `
        SELECT id, title, author, description, chapters
        FROM novel
        ORDER BY id DESC
      `,
      [],
      { tag, idempotent: true }
    );
    console.info('[API] done:', { tag, ms: Date.now() - startedAt, ok: true });
    return res.json({ success: true, novels: rows });
  } catch (err) {
    console.error('[API] failed:', {
      tag,
      ms: Date.now() - startedAt,
      code: err && err.code,
      fatal: !!(err && err.fatal),
    });
    return res.status(500).json({ error: '获取小说列表失败' });
  }
});

app.post('/api/novels/search', async (req, res) => {
  const startedAt = Date.now();
  const tag = 'novels.search';
  console.info('[API] start:', { tag });
  try {
    const title = req && req.body && req.body.title;
    if (!title || String(title).trim() === '') {
      console.info('[API] done:', { tag, ms: Date.now() - startedAt, ok: false, code: 'NO_TITLE' });
      return res.status(400).json({ error: '请输入搜索关键词' });
    }

    const [rows] = await Db.query(
      `
        SELECT id, title, author, description, chapters
        FROM novel
        WHERE title LIKE ?
        ORDER BY id DESC
      `,
      [`%${String(title).trim()}%`],
      { tag, idempotent: true }
    );

    console.info('[API] done:', { tag, ms: Date.now() - startedAt, ok: true });
    return res.json({ success: true, novels: rows });
  } catch (err) {
    console.error('[API] failed:', {
      tag,
      ms: Date.now() - startedAt,
      code: err && err.code,
      fatal: !!(err && err.fatal),
    });
    return res.status(500).json({ error: '搜索小说失败' });
  }
});
// Public Series/Novels 列表页接口（不影响旧的 /api/novels 与 /api/novels/search）
const createPublicSeriesRouter = require('./routes/publicSeries');
app.use('/api', createPublicSeriesRouter(db.promise()));
// NOTE: upload_novel.getNovelInfoAPI uses legacy callback-style db access and may hang under mysql2/promise pool.
// Provide a promise-based implementation here to avoid pending requests.
app.get('/api/novel/:novelId/info', async (req, res) => {
  const startedAt = Date.now();
  const tag = 'novel.info';

  const rawId = req.params && req.params.novelId;
  const novelId = Number.parseInt(String(rawId), 10);
  if (!Number.isFinite(novelId) || novelId <= 0) {
    console.info('[API] done:', { tag, ms: Date.now() - startedAt, ok: false, code: 'BAD_ID' });
    return res.status(400).json({ error: '请提供小说ID' });
  }

  console.info('[API] start:', { tag });

  try {
    const maxChapterPromise = Db.query(
      'SELECT MAX(chapter_number) as maxChapter FROM chapter WHERE novel_id = ?',
      [novelId],
      { tag: 'novel.info.maxChapter', idempotent: true }
    ).then(([rows]) => (Array.isArray(rows) && rows[0] && rows[0].maxChapter) ? rows[0].maxChapter : 0);

    const volumesPromise = Db.query(
      `
        SELECT id, title, volume_id
        FROM volume
        WHERE novel_id = ?
        ORDER BY volume_id ASC
      `,
      [novelId],
      { tag: 'novel.info.volumes', idempotent: true }
    ).then(([rows]) => rows);

    const [maxChapterNumber, volumes] = await Promise.all([maxChapterPromise, volumesPromise]);

    console.info('[API] done:', { tag, ms: Date.now() - startedAt, ok: true });
    return res.json({
      success: true,
      maxChapterNumber,
      volumes,
    });
  } catch (err) {
    console.error('[API] failed:', {
      tag,
      ms: Date.now() - startedAt,
      code: err && err.code,
      fatal: !!(err && err.fatal),
    });
    return res.status(500).json({ error: '获取小说信息失败' });
  }
});
app.get('/api/novel/:novelId/chapters', getNovelChaptersAPI);
app.post('/api/novel/parse-chapters', novelUpload.single('file'), parseChaptersAPI);
// 创建带有更大字段限制的 multer 实例用于小说上传
const novelUploadWithLimits = multer({ 
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = path.join(__dirname, '../novel');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      const name = path.basename(file.originalname, ext);
      cb(null, `${name}_${timestamp}${ext}`);
    }
  }),
  fileFilter: (req, file, cb) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/pdf', // .pdf
      'text/plain', // .txt
      'application/msword' // .doc
    ];
    
    if (validTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持Word文档(.docx/.doc)、PDF(.pdf)和文本文件(.txt)'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB 文件大小限制
    fieldSize: 10 * 1024 * 1024 // 10MB 字段大小限制，用于处理大量章节数据
  }
});

app.post('/api/novel/parse-multiple-files', novelUploadWithLimits.array('files'), parseMultipleFilesWithGPTAPI);
app.post('/api/novel/upload', novelUploadWithLimits.array('files'), uploadNovelAPI);

// 登录API
app.post('/api/login', async (req, res) => {
  const startedAt = Date.now();
  const tag = 'auth.login';
  console.info('[API] start:', { tag });

  try {
    const username = req && req.body && req.body.username;
    const password = req && req.body && req.body.password;

    if (!username || !password) {
      console.info('[API] done:', { tag, ms: Date.now() - startedAt, ok: false, code: 'MISSING_CREDENTIALS' });
      return res.status(400).json({ message: 'Missing username or password' });
    }

    const [rows] = await Db.query(
      'SELECT * FROM user WHERE username = ? OR email = ?',
      [String(username), String(username)],
      { tag: 'auth.login.userLookup', idempotent: true }
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      console.info('[API] done:', { tag, ms: Date.now() - startedAt, ok: false, code: 'USER_NOT_FOUND' });
      return res.status(401).json({ message: 'User not found' });
    }

    const user = rows[0];
    const passwordHash = user.password_hash
      ? (Buffer.isBuffer(user.password_hash)
        ? user.password_hash.toString('utf8')
        : typeof user.password_hash === 'string'
          ? user.password_hash
          : String(user.password_hash))
      : null;

    if (!passwordHash) {
      console.info('[API] done:', { tag, ms: Date.now() - startedAt, ok: false, code: 'NO_PASSWORD_HASH' });
      return res.status(500).json({ message: 'Password hash not found' });
    }

    // bcryptjs 支持 sync；避免 callback + promise 混杂导致“pending”类问题
    const isMatch = bcrypt.compareSync(String(password), passwordHash);
    if (!isMatch) {
      // 记录登录失败日志（异步，不阻塞响应）
      try {
        const { logUserLoginAsync } = require('./utils/loginLogger');
        logUserLoginAsync(Db.getPool(), user.id, req, 'password', 'failed').catch(() => {});
      } catch (_) {}

      console.info('[API] done:', { tag, ms: Date.now() - startedAt, ok: false, code: 'INVALID_PASSWORD' });
      return res.status(401).json({ message: 'Incorrect password' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      'your-secret-key',
      { expiresIn: '7d' }
    );

    // 记录登录成功日志（异步，不阻塞响应）
    try {
      const { logUserLoginAsync } = require('./utils/loginLogger');
      logUserLoginAsync(Db.getPool(), user.id, req, 'password', 'success').catch(() => {});
    } catch (_) {}

    console.info('[API] done:', { tag, ms: Date.now() - startedAt, ok: true });
    return res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        points: user.points,
        golden_karma: user.golden_karma
      },
      token
    });
  } catch (err) {
    console.error('[API] failed:', {
      tag,
      ms: Date.now() - startedAt,
      code: err && err.code,
      fatal: !!(err && err.fatal),
    });
    return res.status(500).json({ message: 'Database error' });
  }
});

// 注册接口
app.post('/api/register', (req, res) => {
  const { username, email, password, referrer_id } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: 'Please fill in all required information' });
  }
  db.query('SELECT * FROM user WHERE username = ? OR email = ?', [username, email], (err, results) => {
    if (err) {
      console.error('注册查询Database error:', err);
      return res.status(500).json({ success: false, message: 'Database error', error: err.code || String(err) });
    }
    if (results.length > 0) {
      return res.status(400).json({ success: false, message: 'Username or email already exists' });
    }
    // 验证推荐人ID是否存在且状态为active（如果提供了推荐人ID）
    const validateReferrer = (callback) => {
      if (!referrer_id) {
        return callback(null, true, null);
      }
      const referrerIdNum = parseInt(referrer_id);
      if (isNaN(referrerIdNum) || referrerIdNum <= 0) {
        return callback(null, false, null);
      }
      db.query('SELECT id, status FROM user WHERE id = ?', [referrerIdNum], (refErr, refResults) => {
        if (refErr) {
          console.error('验证推荐人ID错误:', refErr);
          return callback(refErr, false, null);
        }
        if (refResults.length === 0 || refResults[0].status !== 'active') {
          return callback(null, false, null);
        }
        callback(null, true, referrerIdNum);
      });
    };
    
    // 选择分成方案的辅助函数
    const selectCommissionPlan = (planType, referrerId, callback) => {
      // 1. 优先查该 referrer 的定制方案
      db.query(
        `SELECT id FROM commission_plan 
         WHERE plan_type = ? 
           AND is_custom = 1 
           AND owner_user_id = ? 
           AND start_date <= NOW() 
           AND (end_date IS NULL OR end_date >= NOW())
         ORDER BY start_date DESC 
         LIMIT 1`,
        [planType, referrerId],
        (err1, customResults) => {
          if (err1) {
            console.error(`查询定制${planType}方案错误:`, err1);
            return callback(err1, null);
          }
          
          if (customResults.length > 0) {
            return callback(null, customResults[0].id);
          }
          
          // 2. 如果查不到，使用通用方案
          db.query(
            `SELECT id FROM commission_plan 
             WHERE plan_type = ? 
               AND is_custom = 0 
               AND owner_user_id IS NULL 
               AND start_date <= NOW() 
               AND (end_date IS NULL OR end_date >= NOW())
             ORDER BY start_date DESC 
             LIMIT 1`,
            [planType],
            (err2, generalResults) => {
              if (err2) {
                console.error(`查询通用${planType}方案错误:`, err2);
                return callback(err2, null);
              }
              
              if (generalResults.length > 0) {
                return callback(null, generalResults[0].id);
              }
              
              // 3. 如果两个查询都为空，返回null（不绑定推荐关系）
              console.warn(`未找到${planType}方案，将不绑定该类型的推荐关系`);
              callback(null, null);
            }
          );
        }
      );
    };
    
    validateReferrer((refErr, isValid, referrerIdNum) => {
      if (refErr) {
        return res.status(500).json({ success: false, message: 'Database error', error: refErr.code || String(refErr) });
      }
      // 如果推荐人ID不合法，不阻止注册，只是不绑定推荐关系
      if (!isValid && referrer_id) {
        console.warn(`推荐人ID ${referrer_id} 不合法或不存在，将不绑定推荐关系`);
      }
      
      bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
          console.error('密码Encryption failed:', err);
          return res.status(500).json({ success: false, message: 'Encryption failed' });
        }
        db.query(
          'INSERT INTO user (username, email, password_hash, avatar, is_vip, balance, points, vip_expire_at, golden_karma, ' + SETTINGS_JSON_COL + ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [username, email, hash, '', 0, 0, 0, null, 0, JSON.stringify({
            auto_unlock: true,
            paragraph_comments: true,
            notify_unlock_updates: true,
            notify_chapter_updates: true,
            accept_marketing: true
          })],
          (err, result) => {
            if (err) {
              console.error('Registration failed(插入用户)错误:', err);
              return res.status(500).json({ success: false, message: 'Registration failed', error: err.code || String(err) });
            }
            const newUserId = result.insertId;
            
            // 如果有合法的推荐人ID，在referrals表中创建推荐关系记录
            if (isValid && referrerIdNum) {
              // 1. 检查该新用户是否已存在 referrals 记录
              db.query('SELECT id FROM referrals WHERE user_id = ?', [newUserId], (checkErr, checkResults) => {
                if (checkErr) {
                  console.error('检查推荐关系错误:', checkErr);
                  // 继续注册流程，不绑定推荐关系
                  return continueRegistration();
                }
                
                if (checkResults.length > 0) {
                  console.log(`用户 ${newUserId} 已存在推荐关系，不再新增`);
                  return continueRegistration();
                }
                
                // 2. 选择分成方案
                selectCommissionPlan('reader_promoter', referrerIdNum, (promoterErr, promoterPlanId) => {
                  if (promoterErr) {
                    console.error('选择读者推广方案错误:', promoterErr);
                    // 继续注册流程，不绑定推荐关系
                    return continueRegistration();
                  }
                  
                  selectCommissionPlan('author_promoter', referrerIdNum, (authorErr, authorPlanId) => {
                    if (authorErr) {
                      console.error('选择作者推广方案错误:', authorErr);
                      // 继续注册流程，不绑定推荐关系
                      return continueRegistration();
                    }
                    
                    // 如果两个方案都找不到，不插入推荐关系
                    if (!promoterPlanId && !authorPlanId) {
                      console.warn(`用户 ${newUserId} 无法找到合适的分成方案，不绑定推荐关系`);
                      return continueRegistration();
                    }
                    
                    // 3. 插入 referrals 记录
                    db.query(
                      'INSERT INTO referrals (user_id, referrer_id, promoter_plan_id, author_plan_id, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
                      [newUserId, referrerIdNum, promoterPlanId, authorPlanId],
                      (refErr) => {
                        if (refErr) {
                          // 如果是唯一约束冲突，说明已有记录，忽略错误
                          if (refErr.code === 'ER_DUP_ENTRY') {
                            console.log(`用户 ${newUserId} 的推荐关系已存在（唯一约束冲突）`);
                          } else {
                            console.error('创建推荐关系失败:', refErr);
                          }
                          // 推荐关系创建失败不影响注册流程，只记录错误
                        } else {
                          console.log(`✅ 已创建推荐关系: 用户 ${newUserId} <- 推荐人 ${referrerIdNum} (读者方案: ${promoterPlanId || '无'}, 作者方案: ${authorPlanId || '无'})`);
                        }
                        continueRegistration();
                      }
                    );
                  });
                });
              });
            } else {
              // 没有推荐人ID或推荐人ID不合法，直接继续注册流程
              continueRegistration();
            }
            
            // 继续注册流程的辅助函数
            function continueRegistration() {
              db.query('SELECT id, username, email, avatar, points, golden_karma FROM user WHERE id = ?', [newUserId], (uErr, uResults) => {
                if (uErr || uResults.length === 0) {
                  if (uErr) console.error('注册后Failed to query user:', uErr);
                  return res.json({ success: true, message: 'Registration successful!' });
                }
                const user = uResults[0];
                const token = jwt.sign(
                  { userId: user.id, username: user.username },
                  'your-secret-key',
                  { expiresIn: '7d' }
                );
                
                // 记录注册后自动登录的日志
                logUserLogin(db, user.id, req, 'register', 'success');
                
                return res.json({
                  success: true,
                  message: 'Registration successful!',
                  data: { user, token }
                });
              });
            }
          }
        );
      });
    });
  });
});

// 获取用户详细信息
app.get('/api/user/:id', (req, res) => {
  const userId = req.params.id;
  db.query('SELECT id, username, email, avatar, points, golden_karma, ' + SETTINGS_JSON_COL + ', is_author, pen_name, bio, confirmed_email FROM user WHERE id = ?', [userId], (err, results) => {
    if (err || results.length === 0) return res.status(404).json({ message: 'User not found' });
    
    const user = results[0];
    // 解析设置字段（不打印内容）
    let settingsJson = null;
    const rawSettings = user ? user[SETTINGS_JSON_COL] : null;
    if (rawSettings) {
      if (typeof rawSettings === 'string') {
        try {
          settingsJson = JSON.parse(rawSettings);
        } catch (_) {
          console.error('解析设置失败');
          settingsJson = null;
        }
      } else if (typeof rawSettings === 'object') {
        // 如果已经是对象，直接使用
        settingsJson = rawSettings;
      }
    }
    
    res.json({ 
      success: true,
      data: {
        ...user,
        [SETTINGS_JSON_COL]: settingsJson
      }
    });
  });
});

// 保存用户设置
app.post('/api/user/:id/settings', (req, res) => {
  const userId = req.params.id;
  const settingsJson = req.body ? req.body[SETTINGS_JSON_COL] : undefined;
  db.query('UPDATE user SET ' + SETTINGS_JSON_COL + ' = ? WHERE id = ?', [JSON.stringify(settingsJson), userId], (err, result) => {
    if (err) {
      console.error('保存设置失败:', err);
      return res.status(500).json({ message: 'Save failed' });
    }
    console.log('设置Save successful');
    res.json({ message: 'Save successful' });
  });
});

// 修复数据库表结构（添加 settings json 字段）
app.post('/api/fix-database', (req, res) => {
  console.log('开始修复数据库...');
  
  // 添加 settings json 字段
  db.query('ALTER TABLE user ADD COLUMN IF NOT EXISTS ' + SETTINGS_JSON_COL + ' TEXT', (err) => {
    if (err) {
      console.error('Failed to add field:', err);
      return res.status(500).json({ message: 'Failed to add field' });
    }
    
    console.log('字段添加成功');
    
    // 为现有用户设置默认值
    const defaultSettings = {
      auto_unlock: true,
      paragraph_comments: true,
      notify_unlock_updates: true,
      notify_chapter_updates: true,
      accept_marketing: true
    };
    
    db.query('UPDATE user SET ' + SETTINGS_JSON_COL + ' = ? WHERE ' + SETTINGS_JSON_COL + ' IS NULL OR ' + SETTINGS_JSON_COL + ' = ""', 
      [JSON.stringify(defaultSettings)], (updateErr, result) => {
      if (updateErr) {
        console.error('Failed to update default settings:', updateErr);
        return res.status(500).json({ message: 'Failed to update default settings' });
      }
      
      console.log('数据库修复完成，更新了', result.affectedRows, '个用户');
      res.json({ message: 'Database repair successful', updatedUsers: result.affectedRows });
    });
  });
});

// 初始化用户设置（如果为空）
app.post('/api/user/:id/init-settings', (req, res) => {
  const userId = req.params.id;
  console.log('初始化用户设置，用户ID:', userId);
  
  const defaultSettings = {
    auto_unlock: true,
    paragraph_comments: true,
    notify_unlock_updates: true,
    notify_chapter_updates: true,
    accept_marketing: true
  };
  
  // 先检查用户是否存在
  db.query('SELECT id, ' + SETTINGS_JSON_COL + ' FROM user WHERE id = ?', [userId], (err, results) => {
    if (err) {
      console.error('Failed to query user:', err);
      return res.status(500).json({ message: 'Failed to query user' });
    }
    
    if (results.length === 0) {
      console.error('User not found:', userId);
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = results[0];
    
    // 检查设置是否为空
    let existingSettings = null;
    const rawSettings = user ? user[SETTINGS_JSON_COL] : null;
    if (rawSettings) {
      if (typeof rawSettings === 'string') {
        if (rawSettings.trim() !== '') {
          try {
            existingSettings = JSON.parse(rawSettings);
            console.log('用户Settings already exist，无需初始化');
            return res.json({ message: 'Settings already exist', settings: existingSettings });
          } catch (e) {
            console.log('解析现有设置失败，重新初始化');
          }
        }
      } else if (typeof rawSettings === 'object') {
        // 如果已经是对象，直接使用
        existingSettings = rawSettings;
        console.log('用户Settings already exist（对象格式），无需初始化');
        return res.json({ message: 'Settings already exist', settings: existingSettings });
      }
    }
    
    // 更新设置
    const settingsJson = JSON.stringify(defaultSettings);
    
    db.query('UPDATE user SET ' + SETTINGS_JSON_COL + ' = ? WHERE id = ?', [settingsJson, userId], (updateErr, result) => {
      if (updateErr) {
        console.error('Failed to update settings:', updateErr);
        return res.status(500).json({ message: 'Failed to update settings' });
      }
      
      console.log('设置Initialization successful，影响行数:', result.affectedRows);
      res.json({ message: 'Initialization successful', settings: defaultSettings });
    });
  });
});

// 上传头像
app.post('/api/user/:id/avatar', (req, res, next) => {
  upload.single('avatar')(req, res, (err) => {
    if (err) {
      console.error('Multer错误:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ success: false, message: 'File too large. Maximum size is 5MB' });
      }
      return res.status(400).json({ success: false, message: err.message || 'File upload error' });
    }
    next();
  });
}, (req, res) => {
  const userId = req.params.id;
  
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }
  
  console.log('收到头像文件:', {
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    filename: req.file.filename
  });
  
  const url = `/avatars/${req.file.filename}`;
  db.query('UPDATE user SET avatar = ? WHERE id = ?', [url, userId], (err) => {
    if (err) {
      console.error('头像保存失败:', err);
      return res.status(500).json({ success: false, message: 'Save failed' });
    }
    console.log('头像保存成功:', url);
    res.json({ success: true, data: { url } });
  });
});
// 删除头像
app.delete('/api/user/:id/avatar', (req, res) => {
  const userId = req.params.id;
  db.query('SELECT avatar FROM user WHERE id = ?', [userId], (err, results) => {
    if (err || results.length === 0) return res.status(404).json({ message: 'User not found' });
    const avatarPath = results[0].avatar ? path.join(avatarDir, path.basename(results[0].avatar)) : null;
    db.query('UPDATE user SET avatar = "" WHERE id = ?', [userId], (err2) => {
      if (err2) return res.status(500).json({ message: 'Delete failed' });
      if (avatarPath && fs.existsSync(avatarPath)) fs.unlinkSync(avatarPath);
      res.json({ success: true });
    });
  });
});

// 更新用户信息（用户名和邮箱）
app.put('/api/user/:id/profile', (req, res) => {
  const userId = parseInt(req.params.id);
  const { username, email } = req.body;
  
  if (!username || !email) {
    return res.status(400).json({ 
      success: false, 
      message: 'Username and email are required' 
    });
  }
  
  // 验证邮箱格式
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid email format' 
    });
  }
  
  // 验证用户名长度
  if (username.length < 3 || username.length > 50) {
    return res.status(400).json({ 
      success: false, 
      message: 'Username must be between 3 and 50 characters' 
    });
  }
  
  // 先检查用户是否存在
  db.query('SELECT id, username, email FROM user WHERE id = ?', [userId], (err, results) => {
    if (err) {
      console.error('查询用户失败:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Database error' 
      });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    const currentUser = results[0];
    
    // 检查用户名是否已被其他用户使用
    if (username !== currentUser.username) {
      db.query('SELECT id FROM user WHERE username = ? AND id != ?', [username, userId], (err, usernameResults) => {
        if (err) {
          console.error('检查用户名失败:', err);
          return res.status(500).json({ 
            success: false, 
            message: 'Database error' 
          });
        }
        
        if (usernameResults.length > 0) {
          return res.status(400).json({ 
            success: false, 
            message: 'Username already exists' 
          });
        }
        
        // 检查邮箱是否已被其他用户使用
        checkEmailAndUpdate();
      });
    } else {
      // 用户名没变，直接检查邮箱
      checkEmailAndUpdate();
    }
    
    function checkEmailAndUpdate() {
      if (email !== currentUser.email) {
        db.query('SELECT id FROM user WHERE email = ? AND id != ?', [email, userId], (err, emailResults) => {
          if (err) {
            console.error('检查邮箱失败:', err);
            return res.status(500).json({ 
              success: false, 
              message: 'Database error' 
            });
          }
          
          if (emailResults.length > 0) {
            return res.status(400).json({ 
              success: false, 
              message: 'Email already exists' 
            });
          }
          
          // 更新用户信息
          updateUser();
        });
      } else {
        // 邮箱没变，直接更新
        updateUser();
      }
    }
    
    function updateUser() {
      db.query('UPDATE user SET username = ?, email = ? WHERE id = ?', [username, email, userId], (err, result) => {
        if (err) {
          console.error('更新用户信息失败:', err);
          // 检查是否是唯一约束冲突
          if (err.code === 'ER_DUP_ENTRY') {
            const field = err.message.includes('username') ? 'username' : 'email';
            return res.status(400).json({ 
              success: false, 
              message: `${field === 'username' ? 'Username' : 'Email'} already exists` 
            });
          }
          return res.status(500).json({ 
            success: false, 
            message: 'Update failed' 
          });
        }
        
        // 返回更新后的用户信息
        db.query('SELECT id, username, email, avatar FROM user WHERE id = ?', [userId], (err, updatedResults) => {
          if (err || updatedResults.length === 0) {
            return res.status(500).json({ 
              success: false, 
              message: 'Failed to fetch updated user data' 
            });
          }
          
          res.json({ 
            success: true, 
            message: 'Profile updated successfully',
            data: updatedResults[0]
          });
        });
      });
    }
  });
});

// 获取用户通知列表（包含时间解锁记录）- 使用UNION查询
app.get('/api/user/:id/notifications', async (req, res) => {
  const userId = req.params.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const type = req.query.type || 'unlock';
  const offset = (page - 1) * limit;
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 10;
  const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;
  
  try {
    // 首先检查用户的解锁更新通知设置（纯读）
    const [userResults] = await Db.query(
      `SELECT ${SETTINGS_JSON_COL} FROM user WHERE id = ?`,
      [userId],
      { tag: 'notifications.userSettings', idempotent: true }
    );

    if (!userResults || userResults.length === 0) {
      return res.status(404).json({ message: '用户不存在' });
    }

    const user = userResults[0];
    let notifyUnlockUpdates = false;

    // 解析用户设置（不打印设置内容）
    const rawSettings = user ? user[SETTINGS_JSON_COL] : null;
    if (rawSettings) {
      try {
        const settings = typeof rawSettings === 'string'
          ? JSON.parse(rawSettings)
          : rawSettings;
        notifyUnlockUpdates = settings.notify_unlock_updates === true;
      } catch (_) {
        // ignore parsing error to preserve existing behavior
      }
    }

    // 根据类型分别查询不同的表
    if (type === 'unlock') {
      // 查询时间解锁记录
      if (!notifyUnlockUpdates) {
        return res.json({
          success: true,
          data: {
            notifications: [],
            pagination: {
              currentPage: page,
              totalPages: 0,
              total: 0,
              limit
            }
          }
        });
      }

      const timeUnlockQuery = `
        SELECT 
          CONCAT('time_unlock_', cu.id) as id,
          cu.user_id,
          cu.chapter_id,
          cu.unlock_at,
          cu.status,
          cu.created_at,
          cu.updated_at,
          cu.readed,
          n.title as novel_title,
          c.chapter_number,
          c.title as chapter_title,
          c.novel_id,
          'notify_unlock_updates' as type,
          CONCAT('/novel/', c.novel_id, '/chapter/', cu.chapter_id) as link,
          cu.readed as is_read,
          CONCAT('Chapter ', c.chapter_number, ': "', c.title, '" ', 
                 CASE 
                   WHEN cu.status = 'unlocked' OR cu.unlock_at <= NOW() 
                   THEN CONCAT('has been released at ', DATE_FORMAT(cu.unlock_at, '%Y/%m/%d %H:%i:%s'))
                   ELSE CONCAT('will be released at ', DATE_FORMAT(cu.unlock_at, '%Y/%m/%d %H:%i:%s'))
                 END) as message,
          TIMESTAMPDIFF(HOUR, cu.created_at, NOW()) as hours_ago,
          TIMESTAMPDIFF(DAY, cu.created_at, NOW()) as days_ago,
          1 as isTimeUnlock,
          CASE WHEN cu.status = 'unlocked' OR cu.unlock_at <= NOW() THEN 1 ELSE 0 END as isUnlocked
        FROM chapter_unlocks cu
        JOIN chapter c ON cu.chapter_id = c.id
        JOIN novel n ON c.novel_id = n.id
        WHERE cu.user_id = ? 
          AND cu.unlock_method = 'time_unlock'
          AND cu.status IN ('pending', 'unlocked')
        ORDER BY cu.updated_at DESC
        LIMIT ${safeLimit} OFFSET ${safeOffset}
      `;

      const [results] = await Db.query(
        timeUnlockQuery,
        [userId],
        { tag: 'notifications.unlock.list', idempotent: true }
      );

      // 格式化时间（保持原逻辑）
      const notifications = (results || []).map(notification => {
        let timeAgo = '';
        if (notification.days_ago > 0) {
          timeAgo = notification.days_ago === 1 ? 'a day ago' : `${notification.days_ago} days ago`;
        } else if (notification.hours_ago > 0) {
          timeAgo = `${notification.hours_ago} hours ago`;
        } else {
          timeAgo = 'just now';
        }

        // 对于时间解锁记录，计算正确的时间显示
        const unlockAt = new Date(notification.unlock_at);
        const now = new Date();
        const isUnlocked = notification.status === 'unlocked' || unlockAt <= now;

        if (isUnlocked) {
          // 已解锁：计算解锁后过了多长时间
          const timeDiff = now - unlockAt;
          const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
          const daysAgo = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

          if (daysAgo > 0) {
            timeAgo = daysAgo === 1 ? 'a day ago' : `${daysAgo} days ago`;
          } else if (hoursAgo > 0) {
            timeAgo = `${hoursAgo} hours ago`;
          } else {
            timeAgo = 'just now';
          }
        } else {
          // 未解锁：计算距离解锁还有多长时间
          const timeDiff = unlockAt - now;
          const hoursLater = Math.floor(timeDiff / (1000 * 60 * 60));
          const daysLater = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

          if (daysLater > 0) {
            timeAgo = `${daysLater} days later unlock`;
          } else if (hoursLater > 0) {
            timeAgo = `${hoursLater} hours later unlock`;
          } else {
            timeAgo = 'unlocking soon';
          }
        }

        return {
          ...notification,
          timeAgo,
          readed: notification.readed || 0
        };
      });

      // 获取总数（纯读）
      const countQuery = `
        SELECT COUNT(*) as total FROM chapter_unlocks cu
        WHERE cu.user_id = ? 
          AND cu.unlock_method = 'time_unlock'
          AND cu.status IN ('pending', 'unlocked')
      `;

      const [countResults] = await Db.query(
        countQuery,
        [userId],
        { tag: 'notifications.unlock.count', idempotent: true }
      );

      const total = countResults?.[0]?.total ?? 0;
      const totalPages = Math.ceil(total / limit);

      return res.json({
        success: true,
        data: {
          notifications,
          pagination: {
            currentPage: page,
            totalPages,
            total,
            limit
          }
        }
      });
    }

    if (type === 'chapter_marketing') {
      // 查询普通通知（章节更新和营销）
      const notificationQuery = `
        SELECT 
          n.id,
          n.user_id,
          n.chapter_id,
          NULL as unlock_at,
          NULL as status,
          n.created_at,
          n.updated_at,
          NULL as readed,
          n.novel_title,
          NULL as chapter_number,
          n.chapter_title,
          n.novel_id,
          n.type,
          n.link,
          n.is_read,
          n.message,
          TIMESTAMPDIFF(HOUR, n.created_at, NOW()) as hours_ago,
          TIMESTAMPDIFF(DAY, n.created_at, NOW()) as days_ago,
          0 as isTimeUnlock,
          NULL as isUnlocked
        FROM notifications n
        WHERE n.user_id = ?
        ORDER BY n.updated_at DESC
        LIMIT ${safeLimit} OFFSET ${safeOffset}
      `;

      const [results] = await Db.query(
        notificationQuery,
        [userId],
        { tag: 'notifications.marketing.list', idempotent: true }
      );

      // 格式化时间（保持原逻辑）
      const notifications = (results || []).map(notification => {
        let timeAgo = '';
        if (notification.days_ago > 0) {
          timeAgo = notification.days_ago === 1 ? 'a day ago' : `${notification.days_ago} days ago`;
        } else if (notification.hours_ago > 0) {
          timeAgo = `${notification.hours_ago} hours ago`;
        } else {
          timeAgo = 'just now';
        }

        return {
          ...notification,
          timeAgo,
          readed: notification.readed || 0
        };
      });

      // 获取总数（纯读）
      const countQuery = 'SELECT COUNT(*) as total FROM notifications n WHERE n.user_id = ?';
      const [countResults] = await Db.query(
        countQuery,
        [userId],
        { tag: 'notifications.marketing.count', idempotent: true }
      );

      const total = countResults?.[0]?.total ?? 0;
      const totalPages = Math.ceil(total / limit);

      return res.json({
        success: true,
        data: {
          notifications,
          pagination: {
            currentPage: page,
            totalPages,
            total,
            limit
          }
        }
      });
    }

    return res.status(400).json({ message: '无效的通知类型' });
  } catch (err) {
    console.error('获取通知失败:', { code: err && err.code, fatal: !!(err && err.fatal) });
    // 保持原错误信息语义（按原分支：设置失败/通知失败）
    return res.status(500).json({ message: '获取通知失败' });
  }
});

// 标记通知为已读

// 标记通知为已读
app.post('/api/user/:id/notifications/:notificationId/read', (req, res) => {
  const userId = req.params.id;
  const notificationId = req.params.notificationId;
  
  // 检查是否是时间解锁记录
  if (notificationId.startsWith('time_unlock_')) {
    const chapterUnlockId = notificationId.replace('time_unlock_', '');
    
    // 更新 chapter_unlocks 表的 readed 字段
    Db.query(
      'UPDATE chapter_unlocks SET readed = 1 WHERE id = ? AND user_id = ?',
      [chapterUnlockId, userId],
      { tag: 'notifications.unlock.readOne' }
    )
      .then(() => res.json({ success: true }))
      .catch((err) => {
        console.error('标记时间解锁记录已读失败:', { code: err && err.code, fatal: !!(err && err.fatal) });
        return res.status(500).json({ message: 'Operation failed' });
      });
  } else {
    // 更新普通通知
    Db.query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [notificationId, userId],
      { tag: 'notifications.marketing.readOne' }
    )
      .then(() => res.json({ success: true }))
      .catch((err) => {
        console.error('标记已读失败:', { code: err && err.code, fatal: !!(err && err.fatal) });
        return res.status(500).json({ message: 'Operation failed' });
      });
  }
});

// 标记当前页面通知为已读/未读
app.post('/api/user/:id/notifications/mark-current-page-read', (req, res) => {
  const userId = req.params.id;
  const { type, action, notificationIds } = req.body; // type: 'unlock' | 'chapter_marketing', action: 'read' | 'unread', notificationIds: array of IDs
  
  if (!type || !action || !notificationIds || !Array.isArray(notificationIds)) {
    return res.status(400).json({ message: 'Missing type, action, or notificationIds parameter' });
  }
  
  const isRead = action === 'read' ? 1 : 0;
  
  if (type === 'unlock') {
    // 对于unlock类型，更新chapter_unlocks表的readed字段
    // notificationIds格式: ['time_unlock_1', 'time_unlock_2', ...]
    const chapterUnlockIds = notificationIds
      .filter(id => typeof id === 'string' && id.startsWith('time_unlock_'))
      .map(id => id.replace('time_unlock_', ''));
    
    if (chapterUnlockIds.length === 0) {
      return res.json({ success: true, updatedCount: 0 });
    }
    
    const placeholders = chapterUnlockIds.map(() => '?').join(',');
    const query = `UPDATE chapter_unlocks SET readed = ? WHERE id IN (${placeholders}) AND user_id = ?`;
    const params = [isRead, ...chapterUnlockIds, userId];
    
    Db.query(query, params, { tag: 'notifications.unlock.markCurrentPage' })
      .then(([result]) => res.json({ success: true, updatedCount: result.affectedRows }))
      .catch((err) => {
        console.error('标记时间解锁记录失败:', { code: err && err.code, fatal: !!(err && err.fatal) });
        return res.status(500).json({ message: 'Operation failed' });
      });
  } else if (type === 'chapter_marketing') {
    // 对于chapter_marketing类型，更新notifications表的is_read字段
    const placeholders = notificationIds.map(() => '?').join(',');
    const query = `UPDATE notifications SET is_read = ? WHERE id IN (${placeholders}) AND user_id = ?`;
    const params = [isRead, ...notificationIds, userId];
    
    Db.query(query, params, { tag: 'notifications.marketing.markCurrentPage' })
      .then(([result]) => res.json({ success: true, updatedCount: result.affectedRows }))
      .catch((err) => {
        console.error('标记通知失败:', { code: err && err.code, fatal: !!(err && err.fatal) });
        return res.status(500).json({ message: 'Operation failed' });
      });
  } else {
    return res.status(400).json({ message: 'Invalid type parameter' });
  }
});

// 创建测试通知数据
app.post('/api/create-test-notifications', (req, res) => {
  const testNotifications = [
    {
      user_id: 2,
      novel_id: 1,
      chapter_id: 6642,
      title: 'Emperor\'s Domination',
      message: 'Chapter 6642: One Hand has been released!',
      type: 'chapter',
      link: '/novel/1/chapter/6642'
    },
    {
      user_id: 2,
      novel_id: 1,
      chapter_id: 6641,
      title: 'Emperor\'s Domination',
      message: 'Chapter 6641: So Magical has been released!',
      type: 'chapter',
      link: '/novel/1/chapter/6641'
    },
    {
      user_id: 2,
      novel_id: 2,
      chapter_id: 140,
      title: 'World\'s No. 1 Swordsman',
      message: 'Chapter 140: The Opening of the Grand Conference, the Clash of Three Swords has been released!',
      type: 'chapter',
      link: '/novel/2/chapter/140'
    },
    {
      user_id: 2,
      novel_id: 2,
      chapter_id: 139,
      title: 'World\'s No. 1 Swordsman',
      message: 'Chapter 139: The Sacred Mountain Becomes Lively has been released!',
      type: 'chapter',
      link: '/novel/2/chapter/139'
    },
    {
      user_id: 2,
      novel_id: 1,
      chapter_id: 6639,
      title: 'Emperor\'s Domination',
      message: 'Chapter 6639: Exchanging The Tribulations has been released!',
      type: 'chapter',
      link: '/novel/1/chapter/6639'
    },
    {
      user_id: 2,
      novel_id: 1,
      chapter_id: 6640,
      title: 'Emperor\'s Domination',
      message: 'Chapter 6640: Not Right has been released!',
      type: 'chapter',
      link: '/novel/1/chapter/6640'
    },
    {
      user_id: 2,
      novel_id: 3,
      chapter_id: null,
      title: 'Read Now for FREE',
      message: 'The Sovereign\'s Ascension',
      type: 'news',
      link: '/novel/3'
    },
    {
      user_id: 2,
      novel_id: 4,
      chapter_id: null,
      title: 'Read Now for FREE',
      message: 'Dragon War God',
      type: 'news',
      link: '/novel/4'
    },
    {
      user_id: 2,
      novel_id: 1,
      chapter_id: null,
      title: 'Read Now for FREE',
      message: 'Emperor\'s Domination',
      type: 'news',
      link: '/novel/1'
    },
    {
      user_id: 2,
      novel_id: 5,
      chapter_id: null,
      title: 'Read Now for FREE',
      message: 'Overgeared',
      type: 'news',
      link: '/novel/5'
    }
  ];
  
  // 设置不同的创建时间
  const now = new Date();
  const notificationsWithTime = testNotifications.map((notification, index) => {
    const createdAt = new Date(now.getTime() - (index * 60 * 60 * 1000)); // 每小时递减
    return {
      ...notification,
      created_at: createdAt.toISOString().slice(0, 19).replace('T', ' ')
    };
  });
  
  const values = notificationsWithTime.map(n => [
    n.user_id, n.novel_id, n.chapter_id, n.title, n.message, n.type, n.link, n.is_read, n.created_at
  ]);
  
  db.query(`
    INSERT INTO notifications (user_id, novel_id, chapter_id, title, message, type, link, is_read, created_at) 
    VALUES ?
  `, [values], (err, result) => {
    if (err) {
      console.error('创建测试通知失败:', err);
      return res.status(500).json({ message: 'Failed to create test data' });
    }
    res.json({ message: 'Test notification created successfully', count: result.affectedRows });
  });
});

// 根据小说名称搜索小说
app.post('/api/novel/search-by-title', async (req, res) => {
  const startedAt = Date.now();
  const tag = 'novel.searchByTitle';

  try {
    const title = req && req.body && req.body.title;
    if (!title || String(title).trim() === '') {
      console.info('[API] done:', { tag, ms: Date.now() - startedAt, ok: false, code: 'NO_TITLE' });
      return res.status(400).json({ message: 'Please enter novel name' });
    }

    const query = `
      SELECT id, title, author, translator, description, chapters, licensed_from, status, cover, rating, reviews
      FROM novel
      WHERE title LIKE ?
      ORDER BY title ASC
    `;

    const [rows] = await Db.query(query, [`%${String(title).trim()}%`], { tag, idempotent: true });
    console.info('[API] done:', { tag, ms: Date.now() - startedAt, ok: true });
    return res.json({ novels: rows });
  } catch (err) {
    console.error('[API] failed:', {
      tag,
      ms: Date.now() - startedAt,
      code: err && err.code,
      fatal: !!(err && err.fatal),
    });
    return res.status(500).json({ message: 'Search failed' });
  }
});

// 获取小说详细信息
app.get('/api/novel/:id/details', async (req, res) => {
  const startedAt = Date.now();
  const tag = 'novel.details';

  const rawId = req.params && req.params.id;
  const novelId = Number.parseInt(String(rawId), 10);
  if (!Number.isFinite(novelId) || novelId <= 0) {
    console.info('[API] done:', { tag, ms: Date.now() - startedAt, ok: false, code: 'BAD_ID' });
    return res.status(400).json({ message: 'Invalid novel id' });
  }

  console.info('[API] start:', { tag });

  const query = `
    SELECT id, title, author, translator, description, recommendation, languages, chapters, licensed_from, status, cover, rating, reviews, champion_status
    FROM novel
    WHERE id = ?
  `;

  try {
    const [rows] = await Db.query(query, [novelId], { tag, idempotent: true });
    if (!Array.isArray(rows) || rows.length === 0) {
      console.info('[API] done:', { tag, ms: Date.now() - startedAt, ok: false, code: 'NOT_FOUND' });
      return res.status(404).json({ message: 'Novel not found' });
    }

    console.info('[API] done:', { tag, ms: Date.now() - startedAt, ok: true });
    return res.json({ novel: rows[0] });
  } catch (err) {
    console.error('[API] failed:', {
      tag,
      ms: Date.now() - startedAt,
      code: err && err.code,
      fatal: !!(err && err.fatal),
    });
    return res.status(500).json({ message: 'Failed to get novel details' });
  }
});

// 获取小说的章节数量
app.get('/api/novel/:id/chapter-count', (req, res) => {
  const { id } = req.params;
  
  const query = `
    SELECT COUNT(*) as chapter_count
    FROM chapter 
    WHERE novel_id = ? AND review_status = 'approved'
  `;
  
  db.query(query, [id], (err, results) => {
    if (err) {
      console.error('Failed to get chapter count:', err);
      return res.status(500).json({ message: 'Failed to get chapter count' });
    }
    
    res.json({ chapterCount: results[0].chapter_count });
  });
});

// 更新小说信息
app.put('/api/novel/:id/update', (req, res) => {
  const { id } = req.params;
  const { title, author, translator, description, chapters, licensed_from } = req.body;
  
  const query = `
    UPDATE novel 
    SET title = ?, author = ?, translator = ?, description = ?, chapters = ?, licensed_from = ?
    WHERE id = ?
  `;
  
  db.query(query, [title, author, translator, description, chapters, licensed_from, id], (err, result) => {
    if (err) {
      console.error('更新小说失败:', err);
      return res.status(500).json({ message: 'Update failed' });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Novel not found' });
    }
    
    res.json({ message: 'Update successful' });
  });
});

// 上传小说封面图片
app.post('/api/novel/:id/cover', upload.single('cover'), (req, res) => {
  const { id } = req.params;
  
  if (!req.file) {
    return res.status(400).json({ message: 'Please select image file' });
  }
  
  // 验证文件类型
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
  if (!allowedTypes.includes(req.file.mimetype)) {
    return res.status(400).json({ message: 'Only JPG, PNG, GIF format images are supported' });
  }
  
  // 验证文件大小 (5MB)
  if (req.file.size > 5 * 1024 * 1024) {
    return res.status(400).json({ message: 'Image file size cannot exceed 5MB' });
  }
  
  const coverUrl = `/covers/${req.file.filename}`;
  
  // 更新数据库中的封面字段
  const query = `UPDATE novel SET cover = ? WHERE id = ?`;
  
  db.query(query, [coverUrl, id], (err, result) => {
    if (err) {
      console.error('Failed to update cover:', err);
      return res.status(500).json({ message: 'Failed to update cover' });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Novel not found' });
    }
    
    res.json({ 
      message: 'Cover upload successful', 
      coverUrl: coverUrl 
    });
  });
});

// 获取小说的卷信息 - 简单版本（已废弃，使用下面的完整版本）
// app.get('/api/novel/:id/volumes', (req, res) => {
//   const { id } = req.params;
//   
//   const query = `
//     SELECT id, novel_id, volume_id, title, start_chapter, end_chapter, chapter_count
//     FROM volume 
//     WHERE novel_id = ?
//     ORDER BY volume_id ASC
//   `;
//   
//   db.query(query, [id], (err, results) => {
//     if (err) {
//       console.error('获取卷信息失败:', err);
//       return res.status(500).json({ message: '获取卷信息失败' });
//     }
//     
//     res.json({ volumes: results });
//   });
// });

// 更新或创建卷信息
app.post('/api/novel/:id/volumes', (req, res) => {
  const { id } = req.params;
  const { volumes } = req.body;
  
  if (!volumes || !Array.isArray(volumes)) {
    return res.status(400).json({ message: 'Please provide volume information' });
  }
  
  // 开始事务
  db.beginTransaction((err) => {
    if (err) {
      console.error('开始事务失败:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    
    let completedOperations = 0;
    const totalOperations = volumes.length;
    let hasError = false;
    
    const checkAndProcessVolume = (volumeIndex) => {
      if (hasError || volumeIndex >= volumes.length) {
        if (completedOperations === totalOperations) {
          if (hasError) {
            db.rollback(() => {
              res.status(500).json({ message: 'Failed to process volume information' });
            });
          } else {
            db.commit((commitErr) => {
              if (commitErr) {
                console.error('提交事务失败:', commitErr);
                return res.status(500).json({ message: 'Save failed' });
              }
              res.json({ message: '卷信息Update successful' });
            });
          }
        }
        return;
      }
      
      const volume = volumes[volumeIndex];
      const { volume_id, title, start_chapter, end_chapter, chapter_count } = volume;
      
      // 检查是否已存在相同的组合（novel_id + volume_id）
      const checkQuery = `
        SELECT id FROM volume 
        WHERE novel_id = ? AND volume_id = ?
      `;
      
      db.query(checkQuery, [id, volume_id], (checkErr, checkResults) => {
        if (checkErr) {
          hasError = true;
          completedOperations++;
          checkAndProcessVolume(volumeIndex + 1);
          return;
        }
        
        if (checkResults.length > 0) {
          // 更新现有记录
          const updateQuery = `
            UPDATE volume 
            SET title = ?, start_chapter = ?, end_chapter = ?, chapter_count = ?
            WHERE novel_id = ? AND volume_id = ?
          `;
          
          db.query(updateQuery, [title, start_chapter, end_chapter, chapter_count, id, volume_id], (updateErr) => {
            if (updateErr) {
              hasError = true;
            }
            completedOperations++;
            checkAndProcessVolume(volumeIndex + 1);
          });
        } else {
          // 创建新记录
          const insertQuery = `
            INSERT INTO volume (novel_id, volume_id, title, start_chapter, end_chapter, chapter_count)
            VALUES (?, ?, ?, ?, ?, ?)
          `;
          
          db.query(insertQuery, [id, volume_id, title, start_chapter, end_chapter, chapter_count], (insertErr) => {
            if (insertErr) {
              hasError = true;
            }
            completedOperations++;
            checkAndProcessVolume(volumeIndex + 1);
          });
        }
      });
    };
    
    // 开始处理第一个卷
    checkAndProcessVolume(0);
  });
});

// 更新小说卷轴信息
app.put('/api/novels/:novelId/volumes', (req, res) => {
  const { novelId } = req.params;
  const { volumes } = req.body;

  console.log('收到更新卷轴请求:', { novelId, volumes });

  // 首先删除该小说的所有现有卷轴信息
  db.query('DELETE FROM volume WHERE novel_id = ?', [novelId], (deleteErr) => {
    if (deleteErr) {
      console.error('Failed to delete existing volume information:', deleteErr);
      return res.status(500).json({ success: false, message: 'Failed to delete existing volume information' });
    }

    console.log('成功删除现有卷轴信息');

    // 如果没有新的卷轴信息，直接返回成功
    if (!volumes || volumes.length === 0) {
      return res.json({ success: true, message: '卷轴信息Update successful' });
    }

    // 插入新的卷轴信息
    let completedInserts = 0;
    let hasError = false;

    volumes.forEach((volume, index) => {
      const insertQuery = `
        INSERT INTO volume (novel_id, volume_id, title, start_chapter, end_chapter, chapter_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      db.query(insertQuery, [
        volume.novel_id,
        volume.volume_id,
        volume.title,
        volume.start_chapter,
        volume.end_chapter,
        volume.chapter_count
      ], (insertErr) => {
        if (insertErr) {
          console.error(`插入卷轴信息失败 (索引 ${index}):`, insertErr);
          hasError = true;
        }
        
        completedInserts++;
        
        // 当所有插入操作完成时
        if (completedInserts === volumes.length) {
          if (hasError) {
            res.status(500).json({ success: false, message: 'Failed to insert some volume information' });
          } else {
            console.log('所有卷轴信息插入成功');
            res.json({ success: true, message: '卷轴信息Update successful' });
          }
        }
      });
    });
  });
});

// 更新章节的volume_id
app.put('/api/novels/:novelId/chapters/volume-id', (req, res) => {
  const { novelId } = req.params;
  const { chapterUpdates } = req.body;

  console.log('收到更新章节volume_id请求:', { novelId, chapterUpdates });

  if (!chapterUpdates || chapterUpdates.length === 0) {
    return res.json({ success: true, message: '章节volume_idUpdate successful' });
  }

  // 批量更新章节的volume_id
  let completedUpdates = 0;
  let hasError = false;

  chapterUpdates.forEach((update, index) => {
    const updateQuery = `
      UPDATE chapter 
      SET volume_id = ? 
      WHERE novel_id = ? AND chapter_number = ?
    `;
    
    db.query(updateQuery, [update.volume_id, update.novel_id, update.chapter_number], (updateErr) => {
      if (updateErr) {
        console.error(`更新章节volume_id失败 (索引 ${index}):`, updateErr);
        hasError = true;
      }
      
      completedUpdates++;
      
      // 当所有更新操作完成时
      if (completedUpdates === chapterUpdates.length) {
        if (hasError) {
          res.status(500).json({ success: false, message: '部分章节volume_idUpdate failed' });
        } else {
          console.log('所有章节volume_idUpdate successful');
          res.json({ success: true, message: '章节volume_idUpdate successful' });
        }
      }
    });
  });
});

// ==================== 首页相关API ====================

// ---- Homepage V2 内存缓存（最小实现）----
// 说明：仅用于 /api/homepage/all 的整体缓存；TTL 到期自动刷新。
const __homepageAllCache = {
  expiresAt: 0,
  payload: null
};
const HOMEPAGE_ALL_TTL_MS = 90 * 1000; // 60~120s 推荐区间内的默认值

// Helper: 将 genre_id_1/genre_id_2 摊平成 (novel_id, genre_id) 的派生表，避免 OR JOIN 爆炸
// 注意：此 SQL 会被 /api/homepage/all 及 Because You Read 复用
const HOMEPAGE_GENRE_MAP_DERIVED_SQL = `
  (
    SELECT novel_id, genre_id_1 AS genre_id
    FROM novel_genre_relation
    WHERE genre_id_1 IS NOT NULL
    UNION ALL
    SELECT novel_id, genre_id_2 AS genre_id
    FROM novel_genre_relation
    WHERE genre_id_2 IS NOT NULL
  ) ngr
`;

// ---- Because You Read 用户级小缓存（避免串用户）----
const __becauseYouReadCache = new Map(); // userId -> { expiresAt, payload }
const BECAUSE_YOU_READ_TTL_MS = 60 * 1000;

function getBecauseYouReadCache(userId) {
  const hit = __becauseYouReadCache.get(String(userId));
  if (hit && hit.payload && Date.now() < hit.expiresAt) return hit.payload;
  return null;
}

function setBecauseYouReadCache(userId, payload) {
  __becauseYouReadCache.set(String(userId), {
    expiresAt: Date.now() + BECAUSE_YOU_READ_TTL_MS,
    payload
  });
}

function isHomepageCacheValid() {
  return __homepageAllCache.payload && Date.now() < __homepageAllCache.expiresAt;
}

function setHomepageCache(payload) {
  __homepageAllCache.payload = payload;
  __homepageAllCache.expiresAt = Date.now() + HOMEPAGE_ALL_TTL_MS;
}

// ---- Homepage Promotions（只读查询）----
// 重要：禁止在首页链路调用任何会创建 Stripe coupon 或写回 pricing_promotion 的逻辑。
function fetchHomepagePromotions(db, limit = 2) {
  const safeLimit = Number.isFinite(Number(limit)) ? Math.floor(Number(limit)) : 2;
  const clampedLimit = Math.max(0, Math.min(2, safeLimit));
  if (clampedLimit <= 0) return Promise.resolve([]);

  const sql = `
      SELECT
        pp.id AS promotion_id,
        pp.novel_id,
        pp.promotion_type,
        pp.discount_value,
        pp.start_at,
        pp.end_at,
        pp.status,
        n.title AS novel_title,
        n.author AS novel_author,
        n.cover AS novel_cover,
        n.status AS novel_status,
        n.chapters AS novel_chapters
      FROM pricing_promotion pp
      INNER JOIN novel n ON n.id = pp.novel_id
      WHERE pp.status = 'active'
        AND pp.start_at <= NOW()
        AND (pp.end_at IS NULL OR pp.end_at >= NOW())
        AND pp.promotion_type IN ('discount')
        AND n.review_status = 'published'
      ORDER BY pp.discount_value ASC, pp.end_at ASC, pp.id DESC
      LIMIT ${clampedLimit}
    `;

  return Db.query(sql, [], { tag: 'homepage.promotions', idempotent: true })
    .then(([rows]) => {
      const list = Array.isArray(rows) ? rows : [];
      return list.map((r) => {
        const discountValue = Number.parseFloat(r.discount_value);
        const safeDiscountValue = Number.isFinite(discountValue) ? discountValue : 1;
        const discountPercentage = Math.round((1 - safeDiscountValue) * 100);

        return {
          promotion: {
            id: Number(r.promotion_id),
            promotion_type: 'discount',
            discount_value: safeDiscountValue,
            discount_percentage: discountPercentage,
            start_at: r.start_at,
            end_at: r.end_at ?? null,
            status: 'active',
          },
          novel: {
            id: Number(r.novel_id),
            title: r.novel_title,
            author: r.novel_author ?? null,
            cover: r.novel_cover ?? null,
            status: r.novel_status ?? null,
            chapters: r.novel_chapters ?? null,
          },
        };
      });
    })
    .catch((err) => {
      console.error('[homepage] promotions query failed:', { tag: 'homepage.promotions', code: err && err.code, fatal: !!(err && err.fatal) });
      return [];
    });
}

// 计算 Because You Read（用户维度；不进入公共缓存）
function computeBecauseYouReadForUser(db, userId, baseBecauseYouRead, genreMapDerivedSql) {
  const safeBase = baseBecauseYouRead || { continue_reading: [], recommendations: [], view_all_url: '/series?sort=based_on_you' };
  const GENRE_MAP_SQL = genreMapDerivedSql || HOMEPAGE_GENRE_MAP_DERIVED_SQL;

  const queryAsync = (sql, params = []) =>
    db.query(sql, params).then(([rows]) => rows);

  return (async () => {
    const result = {
      continue_reading: [],
      recommendations: [],
      view_all_url: safeBase.view_all_url || '/series?sort=based_on_you'
    };

    // 1) continue_reading：最近 30 天，按 novel 聚合取每本书最后阅读章节（排除 bookmark_closed=1）
    try {
      const continueRows = await queryAsync(
        `
          SELECT
            n.id, n.title, n.author, n.cover, n.rating, n.reviews, n.status, n.chapters,
            latest.chapter_id AS last_read_chapter_id,
            c.chapter_number AS last_read_chapter_number,
            c.title AS last_read_chapter_title,
            latest.read_at AS last_read_at
          FROM (
            SELECT
              c.novel_id,
              rl.chapter_id,
              rl.read_at,
              rl.id AS reading_log_id,
              ROW_NUMBER() OVER (PARTITION BY c.novel_id ORDER BY rl.read_at DESC, rl.id DESC) AS rn
            FROM reading_log rl
            INNER JOIN chapter c ON rl.chapter_id = c.id
            INNER JOIN novel n2 ON n2.id = c.novel_id
            LEFT JOIN bookmark b ON b.user_id = rl.user_id AND b.novel_id = c.novel_id
            WHERE rl.user_id = ?
              AND rl.read_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
              AND n2.review_status = 'published'
              AND (b.bookmark_closed IS NULL OR b.bookmark_closed = 0)
          ) latest
          INNER JOIN novel n ON n.id = latest.novel_id
          INNER JOIN chapter c ON c.id = latest.chapter_id
          WHERE latest.rn = 1
          ORDER BY latest.read_at DESC
          LIMIT 6
        `,
        [userId]
      );

      result.continue_reading = Array.isArray(continueRows) ? continueRows : [];
    } catch (e) {
      // 不影响首页公共块
      result.continue_reading = [];
    }

    // 2) recommendations：无 reading_log 种子则返回空（不做全站兜底）
    let seedNovels = [];
    try {
      seedNovels = await queryAsync(
        `
          SELECT DISTINCT c.novel_id
          FROM reading_log rl
          INNER JOIN chapter c ON rl.chapter_id = c.id
          INNER JOIN novel n ON n.id = c.novel_id
          LEFT JOIN bookmark b ON b.user_id = rl.user_id AND b.novel_id = c.novel_id
          WHERE rl.user_id = ?
            AND rl.read_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND n.review_status = 'published'
            AND (b.bookmark_closed IS NULL OR b.bookmark_closed = 0)
        `,
        [userId]
      );
    } catch (e) {
      seedNovels = [];
    }

    const seedNovelIds = Array.isArray(seedNovels) ? seedNovels.map((r) => r.novel_id).filter(Boolean) : [];
    if (seedNovelIds.length === 0) {
      result.recommendations = [];
      return result;
    }

    // 2a) 抽取 top5 genre_id（复用 GENRE_MAP_DERIVED_SQL）
    let topGenres = [];
    try {
      topGenres = await queryAsync(
        `
          SELECT ngr.genre_id, COUNT(*) AS cnt
          FROM ${GENRE_MAP_SQL}
          INNER JOIN (
            SELECT DISTINCT c.novel_id
            FROM reading_log rl
            INNER JOIN chapter c ON rl.chapter_id = c.id
            INNER JOIN novel n ON n.id = c.novel_id
            LEFT JOIN bookmark b ON b.user_id = rl.user_id AND b.novel_id = c.novel_id
            WHERE rl.user_id = ?
              AND rl.read_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
              AND n.review_status = 'published'
              AND (b.bookmark_closed IS NULL OR b.bookmark_closed = 0)
          ) seeds ON seeds.novel_id = ngr.novel_id
          GROUP BY ngr.genre_id
          ORDER BY cnt DESC
          LIMIT 5
        `,
        [userId]
      );
    } catch (e) {
      topGenres = [];
    }

    const genreIds = Array.isArray(topGenres) ? topGenres.map((g) => g.genre_id).filter(Boolean) : [];
    if (genreIds.length === 0) {
      result.recommendations = [];
      return result;
    }

    // 2b/2c) 在这些 genre 内按 weekly_views 取 12 本，排除已读(90d)/已收藏/bookmark_closed=1
    try {
      const genrePlaceholders = genreIds.map(() => '?').join(',');
      const recRows = await queryAsync(
        `
          SELECT
            n.id, n.title, n.author, n.cover, n.rating, n.reviews, n.status, n.chapters,
            COALESCE(SUM(ns.views), 0) AS weekly_views
          FROM novel n
          INNER JOIN ${GENRE_MAP_SQL} ON ngr.novel_id = n.id
          LEFT JOIN novel_statistics ns
            ON ns.novel_id = n.id AND ns.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
          LEFT JOIN (
            SELECT DISTINCT c.novel_id
            FROM reading_log rl
            INNER JOIN chapter c ON rl.chapter_id = c.id
            WHERE rl.user_id = ?
              AND rl.read_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
          ) ur ON ur.novel_id = n.id
          LEFT JOIN (
            SELECT DISTINCT novel_id
            FROM favorite
            WHERE user_id = ? AND favorite_status = 1
          ) uf ON uf.novel_id = n.id
          LEFT JOIN (
            SELECT DISTINCT novel_id
            FROM bookmark
            WHERE user_id = ? AND bookmark_closed = 1
          ) ub ON ub.novel_id = n.id
          WHERE n.review_status = 'published'
            AND ngr.genre_id IN (${genrePlaceholders})
            AND ur.novel_id IS NULL
            AND uf.novel_id IS NULL
            AND ub.novel_id IS NULL
          GROUP BY n.id
          ORDER BY weekly_views DESC, n.rating DESC, n.reviews DESC
          LIMIT 12
        `,
        [userId, userId, userId, ...genreIds]
      );

      result.recommendations = Array.isArray(recRows) ? recRows : [];
    } catch (e) {
      result.recommendations = [];
    }

    return result;
  })();
}

// 1. 获取首页推荐小说
// Featured novels: only link to published novels
app.get('/api/homepage/featured-novels/:section', (req, res) => {
  const { section } = req.params;
  const { limit = 6 } = req.query;
  
  const query = `
    SELECT 
      n.id, n.title, n.author, n.cover, n.rating, n.reviews, n.status,
      hfn.display_order, hfn.section_type
    FROM homepage_featured_novels hfn
    JOIN novel n ON hfn.novel_id = n.id
    WHERE hfn.section_type = ? 
      AND hfn.is_active = 1 
      AND (hfn.start_date IS NULL OR hfn.start_date <= NOW())
      AND (hfn.end_date IS NULL OR hfn.end_date >= NOW())
      AND n.review_status = 'published'
    ORDER BY hfn.display_order ASC, n.rating DESC
    LIMIT ?
  `;
  
  db.query(query, [section, parseInt(limit)], (err, results) => {
    if (err) {
      console.error('Failed to get recommended novels:', err);
      return res.status(500).json({ message: 'Failed to get recommended novels' });
    }
    
    res.json({ novels: results });
  });
});

// 2. 获取首页轮播图
// Only show banners whose linked novel is published (or no novel linked)
app.get('/api/homepage/banners', (req, res) => {
  const query = `
    SELECT 
      hb.id, hb.title, hb.subtitle, hb.image_url, hb.link_url,
      n.id as novel_id, n.title as novel_title
    FROM homepage_banners hb
    LEFT JOIN novel n ON hb.novel_id = n.id
    WHERE hb.is_active = 1 
      AND (hb.start_date IS NULL OR hb.start_date <= NOW())
      AND (hb.end_date IS NULL OR hb.end_date >= NOW())
      AND (hb.novel_id IS NULL OR n.review_status = 'published')
    ORDER BY hb.display_order ASC
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Failed to get carousel images:', err);
      return res.status(500).json({ message: 'Failed to get carousel images' });
    }
    
    res.json({ banners: results });
  });
});

// 3. 获取本周热门小说（基于统计数据）
// Homepage popular this week: only include novels with review_status = 'published'
app.get('/api/homepage/popular-this-week', (req, res) => {
  const { limit = 6 } = req.query;
  
  const query = `
    SELECT 
      n.id, n.title, n.author, n.cover, n.rating, n.reviews, n.status,
      COALESCE(SUM(ns.views), 0) as weekly_views,
      COALESCE(SUM(ns.reads), 0) as weekly_reads
    FROM novel n
    LEFT JOIN novel_statistics ns ON n.id = ns.novel_id 
      AND ns.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    WHERE n.review_status = 'published'
    GROUP BY n.id
    HAVING weekly_views > 0
    ORDER BY weekly_views DESC, weekly_reads DESC
    LIMIT ?
  `;
  
  db.query(query, [parseInt(limit)], (err, results) => {
    if (err) {
      console.error('Failed to get weekly popular:', err);
      return res.status(500).json({ message: 'Failed to get weekly popular' });
    }
    
    res.json({ novels: results });
  });
});

// 4. 获取最新发布的小说
// Homepage new releases: only ongoing & published novels
app.get('/api/homepage/new-releases', (req, res) => {
  const { limit = 6 } = req.query;
  
  const query = `
    SELECT 
      n.id, n.title, n.author, n.cover, n.rating, n.reviews, n.status,
      MAX(c.created_at) as latest_chapter_date
    FROM novel n
    LEFT JOIN chapter c ON n.id = c.novel_id
    WHERE n.status = 'Ongoing'
      AND n.review_status = 'published'
    GROUP BY n.id
    ORDER BY latest_chapter_date DESC, n.id DESC
    LIMIT ?
  `;
  
  db.query(query, [parseInt(limit)], (err, results) => {
    if (err) {
      console.error('Failed to get latest releases:', err);
      return res.status(500).json({ message: 'Failed to get latest releases' });
    }
    
    res.json({ novels: results });
  });
});

// 5. 获取评分最高的小说
// Homepage top series: only published novels with rating & reviews
app.get('/api/homepage/top-series', (req, res) => {
  const { limit = 6 } = req.query;
  
  const query = `
    SELECT 
      n.id, n.title, n.author, n.cover, n.rating, n.reviews, n.status,
      n.chapters
    FROM novel n
    WHERE n.rating > 0
      AND n.reviews > 0
      AND n.review_status = 'published'
    ORDER BY n.rating DESC, n.reviews DESC
    LIMIT ?
  `;
  
  db.query(query, [parseInt(limit)], (err, results) => {
    if (err) {
      console.error('Failed to get high-rated novels:', err);
      return res.status(500).json({ message: 'Failed to get high-rated novels' });
    }
    
    res.json({ novels: results });
  });
});

// 6. 记录小说访问统计
app.post('/api/novel/:id/view', (req, res) => {
  const { id } = req.params;
  const today = new Date().toISOString().split('T')[0];
  
  const query = `
    INSERT INTO novel_statistics (novel_id, date, views) 
    VALUES (?, ?, 1)
    ON DUPLICATE KEY UPDATE views = views + 1
  `;
  
  db.query(query, [id, today], (err, result) => {
    if (err) {
      console.error('Failed to record access statistics:', err);
      return res.status(500).json({ message: 'Failed to record access statistics' });
    }
    
    res.json({ success: true });
  });
});

// 7. 获取首页配置
app.get('/api/homepage/config', (req, res) => {
  const query = `
    SELECT section_name, section_title, display_limit, sort_by, is_active, description
    FROM homepage_config
    WHERE is_active = 1
    ORDER BY id ASC
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Failed to get homepage configuration:', err);
      return res.status(500).json({ message: 'Failed to get homepage configuration' });
    }
    
    res.json({ configs: results });
  });
});

// 8. ⚠️ 已弃用：/api/admin/homepage/featured-novels 写接口（未鉴权）
// 说明：该能力已迁移到 backend/routes/admin.js（/api/admin/homepage/featured-novels）并强制管理员鉴权。
// 保留占位用于避免旧前端/脚本误调用导致“静默成功”，此处明确返回 410。
app.post('/api/admin/homepage/featured-novels', (req, res) => {
  return res.status(410).json({
    success: false,
    message: 'Deprecated: use authenticated admin route /api/admin/homepage/featured-novels via backend/routes/admin.js'
  });
});

// 9. 获取所有首页数据（组合接口）
// Combined homepage data endpoint: all novel lists only include published novels
app.get('/api/homepage/all', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const baseBecauseYouRead = {
      continue_reading: [],
      recommendations: [],
      view_all_url: '/series?sort=based_on_you'
    };
    const GENRE_MAP_DERIVED_SQL = HOMEPAGE_GENRE_MAP_DERIVED_SQL;

    // 如果公共缓存命中：直接返回公共块；若有 userId，则在返回前覆盖 because_you_read（不写入公共缓存）
    if (isHomepageCacheValid()) {
      const cached = __homepageAllCache.payload;
      if (!userId) {
        // 确保字段稳定（老缓存可能不含 because_you_read）
        if (cached?.data?.v2 && !cached.data.v2.because_you_read) {
          const patched = {
            ...cached,
            data: {
              ...cached.data,
              v2: {
                ...cached.data.v2,
                because_you_read: baseBecauseYouRead
              }
            }
          };
          return res.json(patched);
        }
        return res.json(cached);
      }

      // userId 存在：按用户取 because_you_read（带 60s 小缓存）
      let byr = getBecauseYouReadCache(userId);
      if (!byr) {
        byr = await computeBecauseYouReadForUser(db, userId, baseBecauseYouRead, GENRE_MAP_DERIVED_SQL);
        setBecauseYouReadCache(userId, byr);
      }

      const patched = {
        ...cached,
        data: {
          ...cached.data,
          v2: {
            ...(cached.data?.v2 || {}),
            because_you_read: byr
          }
        }
      };
      return res.json(patched);
    }

    const { limit = 6 } = req.query;
    const parsedLimit = Number.parseInt(limit, 10);
    const safeLimit = Number.isFinite(parsedLimit) ? parsedLimit : 6;

    // Helper: 最新章节（每本书取 1 章，按 created_at DESC, id DESC 解决同秒冲突）
    const LATEST_CHAPTER_DERIVED_SQL = `
      (
        SELECT c.*
        FROM chapter c
        INNER JOIN (
          SELECT novel_id, MAX(created_at) AS max_created_at
          FROM chapter
          GROUP BY novel_id
        ) t ON t.novel_id = c.novel_id AND t.max_created_at = c.created_at
        INNER JOIN (
          SELECT novel_id, created_at, MAX(id) AS max_id
          FROM chapter
          GROUP BY novel_id, created_at
        ) t2 ON t2.novel_id = c.novel_id AND t2.created_at = c.created_at AND t2.max_id = c.id
      ) lc
    `;

    // Helper: 判断 novel.created_at 是否存在（不同环境兼容）
    const novelHasCreatedAtPromise = Db.query(
      `SHOW COLUMNS FROM novel LIKE 'created_at'`,
      [],
      { tag: 'homepage.novelHasCreatedAt', idempotent: true }
    )
      .then(([rows]) => Array.isArray(rows) && rows.length > 0)
      .catch(() => false);
    
    // 并行获取所有数据
    const [
      bannersResult,
      popularResult,
      newReleasesResult,
      topSeriesResult,
      configResult,
      novelHasCreatedAt,
      heroResult,
      announcementsResult,
      promotionsResult,
      trendingTabsResult,
      newBooksResult,
      recentUpdatesResult,
      championFeaturedResult
    ] = await Promise.all([
      Db.query(`
        SELECT 
          hb.id, hb.title, hb.subtitle, hb.image_url, hb.link_url,
          n.id as novel_id, n.title as novel_title
        FROM homepage_banners hb
        LEFT JOIN novel n ON hb.novel_id = n.id
        WHERE hb.is_active = 1 
          AND (hb.start_date IS NULL OR hb.start_date <= NOW())
          AND (hb.end_date IS NULL OR hb.end_date >= NOW())
          AND (hb.novel_id IS NULL OR n.review_status = 'published')
        ORDER BY hb.display_order ASC
      `, [], { tag: 'homepage.banners', idempotent: true }).then(([rows]) => rows),
      Db.query(`
        SELECT 
          n.id, n.title, n.author, n.cover, n.rating, n.reviews, n.status,
          COALESCE(SUM(ns.views), 0) as weekly_views,
          COALESCE(SUM(ns.reads), 0) as weekly_reads
        FROM novel n
        LEFT JOIN novel_statistics ns ON n.id = ns.novel_id 
          AND ns.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        WHERE n.review_status = 'published'
        GROUP BY n.id
        HAVING weekly_views > 0
        ORDER BY weekly_views DESC, weekly_reads DESC
        LIMIT ${safeLimit}
      `, [], { tag: 'homepage.popular', idempotent: true }).then(([rows]) => rows),
      Db.query(`
        SELECT 
          n.id, n.title, n.author, n.cover, n.rating, n.reviews, n.status,
          MAX(c.created_at) as latest_chapter_date
        FROM novel n
        LEFT JOIN chapter c ON n.id = c.novel_id
        WHERE n.status = 'Ongoing'
          AND n.review_status = 'published'
        GROUP BY n.id
        ORDER BY latest_chapter_date DESC, n.id DESC
        LIMIT ${safeLimit}
      `, [], { tag: 'homepage.newReleases', idempotent: true }).then(([rows]) => rows),
      Db.query(`
        SELECT 
          n.id, n.title, n.author, n.cover, n.rating, n.reviews, n.status,
          n.chapters
        FROM novel n
        WHERE n.rating > 0
          AND n.reviews > 0
          AND n.review_status = 'published'
        ORDER BY n.rating DESC, n.reviews DESC
        LIMIT ${safeLimit}
      `, [], { tag: 'homepage.topSeries', idempotent: true }).then(([rows]) => rows),
      Db.query(`
        SELECT section_name, section_title, display_limit, sort_by, is_active, description
        FROM homepage_config
        WHERE is_active = 1
        ORDER BY id ASC
      `, [], { tag: 'homepage.config', idempotent: true }).then(([rows]) => rows),

      // novel.created_at 是否存在
      novelHasCreatedAtPromise,

      // v2.hero: banners + novel详情 + latest chapter（避免 N+1）
      Db.query(
        `
          SELECT
            hb.id AS banner_id,
            hb.title AS banner_title,
            hb.subtitle AS banner_subtitle,
            hb.image_url,
            hb.link_url,
            n.id AS novel_id,
            n.title AS novel_title,
            n.author,
            n.translator,
            n.cover,
            n.status,
            n.description,
            n.chapters,
            lc.id AS latest_chapter_id,
            lc.chapter_number AS latest_chapter_number,
            lc.title AS latest_chapter_title,
            lc.created_at AS latest_chapter_created_at
          FROM homepage_banners hb
          LEFT JOIN novel n ON hb.novel_id = n.id
          LEFT JOIN ${LATEST_CHAPTER_DERIVED_SQL} ON lc.novel_id = n.id
          WHERE hb.is_active = 1
            AND (hb.start_date IS NULL OR hb.start_date <= NOW())
            AND (hb.end_date IS NULL OR hb.end_date >= NOW())
            AND (hb.novel_id IS NULL OR n.review_status = 'published')
          ORDER BY hb.display_order ASC
        `
      , [], { tag: 'homepage.hero', idempotent: true }).then(([rows]) => rows),

      // v2.announcements: homepage_announcements（允许表不存在时返回空）
      // 只返回读者端公告，限制2条
      Db.query(
        `
          SELECT id, title, content, link_url, display_order, created_at
          FROM homepage_announcements
          WHERE is_active = 1
            AND target_audience = 'reader'
            AND (start_date IS NULL OR start_date <= NOW())
            AND (end_date IS NULL OR end_date >= NOW())
          ORDER BY display_order ASC, created_at DESC
          LIMIT 2
        `
      , [], { tag: 'homepage.announcements', idempotent: true }).then(([rows]) => rows).catch(() => []), // 不阻断旧首页

      // v2.promotions: pricing_promotion（只读；失败不影响首页）
      fetchHomepagePromotions(db, 2).catch((e) => {
        console.error('[homepage] fetchHomepagePromotions failed:', { code: e && e.code, fatal: !!(e && e.fatal) });
        return [];
      }),

      // v2.trending.tabs: 热门 genre（按已发布小说数排序）
      Db.query(
        `
          SELECT g.id, g.slug, g.name, g.chinese_name, COUNT(*) AS novel_count
          FROM genre g
          JOIN ${GENRE_MAP_DERIVED_SQL} ON ngr.genre_id = g.id
          JOIN novel n ON n.id = ngr.novel_id AND n.review_status = 'published'
          WHERE g.is_active = 1
          GROUP BY g.id
          ORDER BY novel_count DESC
          LIMIT 6
        `
      , [], { tag: 'homepage.trendingTabs', idempotent: true }).then(([rows]) => rows),

      // v2.new_books: 真正新书（created_at 存在则按 created_at，否则按首章时间）
      // 先占位，下面根据 novelHasCreatedAt 再二次查询（保持并行结构）
      Promise.resolve([]),

      // v2.recent_updates: 最新章节列表（每本 1 条，避免同秒冲突）
      Db.query(
        `
          SELECT
            n.id AS novel_id,
            n.title AS novel_title,
            n.cover,
            n.translator,
            lc.id AS chapter_id,
            lc.chapter_number,
            lc.title AS chapter_title,
            lc.created_at AS chapter_created_at
          FROM novel n
          JOIN ${LATEST_CHAPTER_DERIVED_SQL} ON lc.novel_id = n.id
          WHERE n.review_status = 'published'
          ORDER BY lc.created_at DESC, lc.id DESC
          LIMIT 20
        `
      , [], { tag: 'homepage.recentUpdates', idempotent: true }).then(([rows]) => rows),

      // v2.champion.items: 优先 featured(recommended)，fallback 用 topSeries
      Db.query(
        `
          SELECT
            n.id, n.title, n.author, n.cover, n.rating, n.reviews, n.status,
            hfn.display_order, hfn.section_type
          FROM homepage_featured_novels hfn
          JOIN novel n ON hfn.novel_id = n.id
          WHERE hfn.section_type = 'recommended'
            AND hfn.is_active = 1
            AND (hfn.start_date IS NULL OR hfn.start_date <= NOW())
            AND (hfn.end_date IS NULL OR hfn.end_date >= NOW())
            AND n.review_status = 'published'
          ORDER BY hfn.display_order ASC
          LIMIT 6
        `
      , [], { tag: 'homepage.championFeatured', idempotent: true }).then(([rows]) => rows)
    ]);

    // new_books 二次查询（依赖 novelHasCreatedAt，不改变旧 SQL 口径）
    let newBooksFinal;
    if (novelHasCreatedAt) {
      const [rows] = await Db.query(
        `
          SELECT id, title, author, translator, description, chapters, status, cover, rating, reviews, created_at
          FROM novel
          WHERE review_status = 'published'
          ORDER BY created_at DESC, id DESC
          LIMIT ${safeLimit}
        `,
        [],
        { tag: 'homepage.newBooks.createdAt', idempotent: true }
      );
      newBooksFinal = rows;
    } else {
      // fallback：按首章时间（MIN(chapter.created_at)）排序
      const [rows] = await Db.query(
        `
          SELECT
            n.id, n.title, n.author, n.translator, n.description, n.chapters, n.status, n.cover, n.rating, n.reviews,
            MIN(c.created_at) AS first_chapter_created_at
          FROM novel n
          JOIN chapter c ON c.novel_id = n.id
          WHERE n.review_status = 'published'
          GROUP BY n.id
          ORDER BY first_chapter_created_at DESC, n.id DESC
          LIMIT ${safeLimit}
        `,
        [],
        { tag: 'homepage.newBooks.fallbackFirstChapter', idempotent: true }
      );
      newBooksFinal = rows;
    }

    // trending.items_by_tab + popular_genres.items_by_tab（按 tab 并行查；tab 数量固定 6，避免复杂 OR JOIN）
    const trendingTabs = Array.isArray(trendingTabsResult) ? trendingTabsResult : [];
    const trendingItemsByTabEntries = await Promise.all(
      trendingTabs.map(async (g) => {
        const [rows] = await Db.query(
          `
            SELECT
              n.id, n.title, n.author, n.cover, n.status, n.rating, n.reviews, n.chapters,
              COALESCE(SUM(ns.views), 0) AS weekly_views
            FROM novel n
            JOIN ${GENRE_MAP_DERIVED_SQL} ON ngr.novel_id = n.id AND ngr.genre_id = ?
            LEFT JOIN novel_statistics ns ON ns.novel_id = n.id AND ns.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            WHERE n.review_status = 'published'
            GROUP BY n.id
            ORDER BY weekly_views DESC, n.rating DESC, n.reviews DESC
            LIMIT 5
          `,
          [g.id],
          { tag: 'homepage.trending.itemsByTab', idempotent: true }
        );
        return [g.slug, rows];
      })
    );

    const trendingItemsByTab = Object.fromEntries(trendingItemsByTabEntries);

    // popular_genres: 复用 trendingTabs（若不足则按现有数量）
    const popularGenresTabs = trendingTabs;
    const popularGenresItemsByTabEntries = await Promise.all(
      popularGenresTabs.map(async (g) => {
        const [rows] = await Db.query(
          `
            SELECT
              n.id, n.title, n.author, n.cover, n.status, n.rating, n.reviews, n.chapters,
              COALESCE(SUM(ns.views), 0) AS weekly_views
            FROM novel n
            JOIN ${GENRE_MAP_DERIVED_SQL} ON ngr.novel_id = n.id AND ngr.genre_id = ?
            LEFT JOIN novel_statistics ns ON ns.novel_id = n.id AND ns.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            WHERE n.review_status = 'published'
            GROUP BY n.id
            ORDER BY weekly_views DESC, n.rating DESC, n.reviews DESC
            LIMIT 6
          `,
          [g.id],
          { tag: 'homepage.popularGenres.itemsByTab', idempotent: true }
        );
        return [g.slug, rows];
      })
    );

    const popularGenresItemsByTab = Object.fromEntries(popularGenresItemsByTabEntries);

    // champion fallback：若无 featured，则 fallback topSeriesResult（旧字段保持不变）
    const championItems = (Array.isArray(championFeaturedResult) && championFeaturedResult.length > 0)
      ? championFeaturedResult
      : (Array.isArray(topSeriesResult) ? topSeriesResult.slice(0, 6) : []);

    const payload = {
      success: true,
      data: {
        // 旧字段原样保留
        banners: bannersResult,
        popularNovels: popularResult,
        newReleases: newReleasesResult,
        topSeries: topSeriesResult,
        config: configResult,
        // 新增 v2
        v2: {
          hero: {
            items: heroResult || []
          },
          announcements: {
            items: announcementsResult || [],
            view_all_url: '/announcements'
          },
          promotions: {
            items: promotionsResult || [],
            view_all_url: ''
          },
          popular_this_week: {
            items: popularResult || [],
            view_all_url: '/series?sort=popular_week'
          },
          trending: {
            tabs: trendingTabs,
            items_by_tab: trendingItemsByTab,
            view_all_url: '/series?sort=trending'
          },
          new_books: {
            items: newBooksFinal || [],
            view_all_url: '/series?sort=new'
          },
          popular_genres: {
            tabs: popularGenresTabs,
            items_by_tab: popularGenresItemsByTab
          },
          champion: {
            cta_url: '/champion',
            items: championItems
          },
          recent_updates: {
            items: recentUpdatesResult || [],
            view_all_url: '/updates'
          },
          // Because You Read（默认空，避免未登录/无种子时破坏结构）
          because_you_read: baseBecauseYouRead
        }
      }
    };

    setHomepageCache(payload);
    // 如果有 userId：返回前覆盖 because_you_read（不写入公共缓存）
    if (userId) {
      let byr = getBecauseYouReadCache(userId);
      if (!byr) {
        byr = await computeBecauseYouReadForUser(db, userId, baseBecauseYouRead, GENRE_MAP_DERIVED_SQL);
        setBecauseYouReadCache(userId, byr);
      }
      const patched = {
        ...payload,
        data: {
          ...payload.data,
          v2: {
            ...payload.data.v2,
            because_you_read: byr
          }
        }
      };
      return res.json(patched);
    }

    return res.json(payload);

  } catch (error) {
    console.error('Failed to get homepage data:', { code: error && error.code, fatal: !!(error && error.fatal) });
    res.status(500).json({ message: 'Failed to get homepage data' });
  }
});

// ==================== 每日签到API ====================

// 检查用户今日签到状态（支持时区）
app.get('/api/checkin/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { timezone = 'UTC' } = req.query;
    
    const todayCheckin = await dailyCheckinAPI.checkTodayCheckin(userId, timezone);
    const userStats = await dailyCheckinAPI.getUserCheckinStats(userId);
    
    res.json({
      success: true,
      data: {
        hasCheckedInToday: !!todayCheckin,
        todayCheckin,
        userStats,
        timezone: timezone
      }
    });
  } catch (error) {
    console.error('Failed to get check-in status:', error);
    res.status(500).json({ success: false, message: 'Failed to get check-in status' });
  }
});

// 执行签到（支持时区 + 任务系统集成）
app.post('/api/checkin/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { timezone = 'UTC' } = req.body;
    
    const result = await dailyCheckinWithMission.performCheckin(userId, timezone);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Check-in failed:', error);
    res.status(500).json({ success: false, message: 'Check-in failed' });
  }
});

// 获取用户签到历史
app.get('/api/checkin/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 30 } = req.query;
    const history = await dailyCheckinWithMission.getUserCheckinHistory(userId, parseInt(limit));
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Failed to get check-in history:', error);
    res.status(500).json({ success: false, message: 'Failed to get check-in history' });
  }
});

// ==================== 新的任务管理系统API ====================

// 获取用户任务列表（自动初始化）
app.get('/api/mission-v2/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { date } = req.query;
    
    const { checkAndInitializeTodayMissions, checkMissionCompletion } = require('./mission_manager');
    
    // 1. 检查并初始化今日任务
    const initResult = await checkAndInitializeTodayMissions(userId);
    
    if (!initResult.success) {
      return res.status(400).json({
        success: false,
        message: initResult.message
      });
    }
    
    // 2. 获取用户任务列表
    const mysql = require('mysql2/promise');
    const db = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '123456',
      database: process.env.DB_NAME || 'kongfuworld',
      charset: 'utf8mb4'
    });
    
    const targetDate = date || new Date().toISOString().slice(0, 10);
    
    const [missions] = await db.execute(`
      SELECT 
        mc.id,
        mc.mission_key,
        mc.title,
        mc.description,
        mc.target_value,
        mc.reward_keys,
        mc.reward_karma,
        mc.reset_type,
        ump.current_progress,
        ump.is_completed,
        ump.is_claimed,
        ump.progress_date
      FROM mission_config mc
      LEFT JOIN user_mission_progress ump ON mc.id = ump.mission_id 
        AND ump.user_id = ? AND ump.progress_date = ?
      WHERE mc.is_active = 1
      ORDER BY mc.id ASC
    `, [userId, targetDate]);
    
    await db.end();
    
    // 3. 处理任务数据
    const processedMissions = missions.map(mission => ({
      id: mission.id,
      missionKey: mission.mission_key,
      title: mission.title,
      description: mission.description,
      targetValue: mission.target_value,
      rewardKeys: mission.reward_keys,
      rewardKarma: mission.reward_karma,
      resetType: mission.reset_type,
      currentProgress: mission.current_progress || 0,
      isCompleted: mission.is_completed || false,
      isClaimed: mission.is_claimed || false,
      progressDate: mission.progress_date || targetDate,
      progressPercentage: Math.min(100, Math.round((mission.current_progress || 0) / mission.target_value * 100))
    }));
    
    // 4. 检查任务完成状态
    const completionStatus = await checkMissionCompletion(userId);
    
    res.json({
      success: true,
      data: {
        missions: processedMissions,
        date: targetDate,
        userMissionStatus: initResult.status,
        allTasksCompleted: completionStatus.isCompleted,
        completionMessage: completionStatus.message
      }
    });
    
  } catch (error) {
    console.error('Failed to get user missions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user missions',
      error: error.message
    });
  }
});

// 更新任务进度（新版本）
app.post('/api/mission-v2/progress', async (req, res) => {
  try {
    const { userId, missionKey, progressValue = 1 } = req.body;
    
    if (!userId || !missionKey) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters'
      });
    }
    
    const { updateMissionProgress } = require('./mission_manager');
    const result = await updateMissionProgress(userId, missionKey, progressValue);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
    
  } catch (error) {
    console.error('Failed to update mission progress:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update mission progress',
      error: error.message
    });
  }
});

// 检查任务完成状态
app.get('/api/mission-v2/completion/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { checkMissionCompletion } = require('./mission_manager');
    
    const result = await checkMissionCompletion(userId);
    res.json(result);
    
  } catch (error) {
    console.error('Failed to check mission completion status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check mission completion status',
      error: error.message
    });
  }
});

// 获取用户最后阅读章节
app.get('/api/user/:userId/novel/:novelId/last-read', (req, res) => {
  const { userId, novelId } = req.params;
  
  // 查询用户在该小说中的最后阅读记录
  const query = `
    SELECT 
      rl.chapter_id,
      rl.read_at,
      c.chapter_number,
      c.title as chapter_title,
      c.unlock_price
    FROM reading_log rl
    JOIN chapter c ON rl.chapter_id = c.id
    WHERE rl.user_id = ? AND c.novel_id = ?
    ORDER BY rl.read_at DESC
    LIMIT 1
  `;
  
  db.query(query, [userId, novelId], (err, results) => {
    if (err) {
      console.error('Failed to get last read chapter:', err);
      return res.status(500).json({ message: 'Failed to get last read chapter' });
    }
    
    if (results.length === 0) {
      // 用户未阅读过该小说，返回第一章信息
      const firstChapterQuery = `
        SELECT 
          id as chapter_id,
          chapter_number,
          title as chapter_title,
          unlock_price
        FROM chapter 
        WHERE novel_id = ? AND review_status = 'approved'
        ORDER BY chapter_number ASC
        LIMIT 1
      `;
      
      db.query(firstChapterQuery, [novelId], (err2, firstChapterResults) => {
        if (err2) {
          console.error('Failed to get first chapter:', err2);
          return res.status(500).json({ message: 'Failed to get first chapter' });
        }
        
        if (firstChapterResults.length === 0) {
          return res.status(404).json({ message: 'This novel has no chapters yet' });
        }
        
        res.json({
          success: true,
          data: {
            chapter_id: firstChapterResults[0].chapter_id,
            chapter_number: firstChapterResults[0].chapter_number,
            chapter_title: firstChapterResults[0].chapter_title,
            unlock_price: firstChapterResults[0].unlock_price || 0,
            is_first_read: true
          }
        });
      });
    } else {
      const lastRead = results[0];
      
      // 检查用户是否已解锁该章节
      const unlockQuery = `
        SELECT COUNT(*) as unlocked
        FROM chapter_unlocks 
        WHERE user_id = ? AND chapter_id = ?
      `;
      
      db.query(unlockQuery, [userId, lastRead.chapter_id], (err3, unlockResults) => {
        if (err3) {
          console.error('Failed to check unlock status:', err3);
          return res.status(500).json({ message: 'Failed to check unlock status' });
        }
        
        const isUnlocked = unlockResults[0].unlocked > 0;
        
        res.json({
          success: true,
          data: {
            chapter_id: lastRead.chapter_id,
            chapter_number: lastRead.chapter_number,
            chapter_title: lastRead.chapter_title,
            unlock_price: lastRead.unlock_price || 0,
            is_unlocked: isUnlocked,
            read_at: lastRead.read_at,
            is_first_read: false
          }
        });
      });
    }
  });
});

// 获取章节内容
// Volume-Chapter mapping updated: chapter.volume_id = volume.id AND same novel_id
console.log('[Chapter API] ⚠️ 路由定义被加载，路由路径: /api/chapter/:chapterId');
app.get('/api/chapter/:chapterId', async (req, res) => {
  try {
    const { chapterId } = req.params;
    const userId = req.query.userId ? parseInt(req.query.userId) : null;
    
    const query = `
      SELECT 
        c.id,
        c.novel_id,
        c.volume_id,
        c.chapter_number,
        c.title,
        c.content,
        c.unlock_price,
        c.translator_note,
        c.is_released,
        c.is_advance,
        n.title as novel_title,
        n.author,
        n.translator,
        v.title as volume_title,
        v.volume_id
      FROM chapter c
      JOIN novel n ON c.novel_id = n.id
      LEFT JOIN volume v ON c.volume_id = v.id
        AND v.novel_id = c.novel_id
      WHERE c.id = ? AND c.review_status = 'approved'
    `;
    
    // 注意：这里不检查 is_released，因为我们需要在后续逻辑中检查它
    // 如果在这里就过滤掉，用户访问未发布章节时会得到 404，而不是明确的 403 错误
    
    const [results] = await Db.query(query, [chapterId], { tag: 'chapter.get', idempotent: true });
    
    if (results.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Chapter not found or hidden' 
      });
    }
    
    const chapter = results[0];
    
    // 🔍 检查章节可见性（在解锁检查之前）
    const ChampionService = require('./services/championService');
    const championService = new ChampionService();
    const visibility = await championService.getUserChapterVisibility(Db.getPool(), chapter.novel_id, userId);
    
    // 1. 检查 is_released 和 review_status（已在 SQL 中过滤 review_status）
    // 确保 is_released 是数字类型，并严格检查是否为 1
    const isReleased = Number(chapter.is_released) === 1;
    
    if (!isReleased) {
      return res.status(403).json({
        success: false,
        code: 'CHAPTER_NOT_RELEASED',
        message: 'This chapter is not released yet.'
      });
    }
    
    // 2. 根据 Champion 规则检查可见性
    let canAccess = false;
    
    if (!visibility.championEnabled) {
      // 未启用 Champion：只允许访问 is_advance=0 的章节
      canAccess = chapter.is_advance === 0;
    } else if (!visibility.isChampion) {
      // 启用 Champion 但用户不是 Champion：只允许访问 is_advance=0 的章节
      canAccess = chapter.is_advance === 0;
    } else {
      // Champion 用户：允许访问 chapter_number <= visibleMaxChapterNumber 的章节
      canAccess = chapter.chapter_number <= visibility.visibleMaxChapterNumber;
    }
    
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        code: 'CHAPTER_NOT_ACCESSIBLE',
        message: 'This chapter is only available as Champion advance reading.'
      });
    }
    
    // 3. 计算上一章/下一章（基于可见性）
    // 注意：参数顺序必须与 SQL 中的 ? 占位符顺序一致
    let prevVisibilityCondition = 'is_released = 1 AND review_status = \'approved\'';
    let nextVisibilityCondition = 'is_released = 1 AND review_status = \'approved\'';
    const prevParams = [chapter.novel_id];
    const nextParams = [chapter.novel_id];
    
    if (!visibility.championEnabled || !visibility.isChampion) {
      prevVisibilityCondition += ' AND is_advance = 0';
      nextVisibilityCondition += ' AND is_advance = 0';
    } else {
      // Champion 用户：先添加 visibleMaxChapterNumber 参数
      prevVisibilityCondition += ' AND chapter_number <= ?';
      nextVisibilityCondition += ' AND chapter_number <= ?';
      prevParams.push(visibility.visibleMaxChapterNumber);
      nextParams.push(visibility.visibleMaxChapterNumber);
    }
    
    // 最后添加 chapter_number 参数（用于 < 或 > 比较）
    prevParams.push(chapter.chapter_number);
    nextParams.push(chapter.chapter_number);
    
    const prevQuery = `SELECT id FROM chapter WHERE novel_id = ? AND ${prevVisibilityCondition} AND chapter_number < ? ORDER BY chapter_number DESC LIMIT 1`;
    const nextQuery = `SELECT id FROM chapter WHERE novel_id = ? AND ${nextVisibilityCondition} AND chapter_number > ? ORDER BY chapter_number ASC LIMIT 1`;
    
    const [prevResults] = await Db.query(prevQuery, prevParams, { tag: 'chapter.prev', idempotent: true });
    const [nextResults] = await Db.query(nextQuery, nextParams, { tag: 'chapter.next', idempotent: true });
    
    // 额外验证：如果查询返回了结果，再次检查 is_released
    if (nextResults.length > 0) {
      const nextChapterId = nextResults[0].id;
      const [verifyResults] = await Db.query(
        'SELECT id, chapter_number, is_released, review_status FROM chapter WHERE id = ?',
        [nextChapterId],
        { tag: 'chapter.next.verify', idempotent: true }
      );
      if (verifyResults.length > 0) {
        const nextChapter = verifyResults[0];
        if (Number(nextChapter.is_released) !== 1 || nextChapter.review_status !== 'approved') {
          nextResults.length = 0; // 清空结果
        }
      }
    }
    
    const prevId = prevResults.length > 0 ? prevResults[0].id : null;
    const nextId = nextResults.length > 0 ? nextResults[0].id : null;
    
    // 🔒 安全修复：检查用户权限（解锁检查）
    let fullContent = chapter.content;
    let isLocked = false;
    
    // 如果章节有解锁价格，需要检查用户权限
    if (chapter.unlock_price && chapter.unlock_price > 0) {
      if (!userId) {
        isLocked = true;
      } else {
        // 获取用户信息
        const [users] = await Db.query('SELECT * FROM user WHERE id = ?', [userId], { tag: 'chapter.user', idempotent: true });
        if (users.length === 0) {
          isLocked = true;
        } else {
          const user = users[0];
          // 检查解锁状态
          const unlockStatus = await checkChapterUnlockStatus(Db.getPool(), userId, chapterId, chapter, user);
          
          if (!unlockStatus.isUnlocked) {
            isLocked = true;
          }
        }
      }
    }
    
    // 如果章节被锁定，只返回预览内容（前6个段落）
    if (isLocked) {
      const paragraphs = fullContent.split('\n').filter(p => p.trim().length > 0);
      const previewParagraphs = paragraphs.slice(0, 6);
      fullContent = previewParagraphs.join('\n');
    }
    
    // 构建返回对象
    const responseData = {
      id: chapter.id,
      novel_id: chapter.novel_id,
      volume_id: chapter.volume_id,
      chapter_number: chapter.chapter_number,
      title: chapter.title,
      content: fullContent,
      unlock_price: chapter.unlock_price || 0,
      translator_note: chapter.translator_note,
      novel_title: chapter.novel_title,
      author: chapter.author,
      translator: chapter.translator,
      volume_title: chapter.volume_title,
      volume_id: chapter.volume_id,
      is_advance: chapter.is_advance === 1,
      prev_chapter_id: prevId,
      next_chapter_id: nextId,
      has_prev: Boolean(prevId),
      has_next: Boolean(nextId),
      is_locked: isLocked
    };
    
    const finalResponse = {
      success: true,
      data: responseData
    };
    res.json(finalResponse);
  } catch (error) {
    console.error('[Chapter API] failed:', { tag: 'chapter.get', code: error && error.code, fatal: !!(error && error.fatal) });
    res.status(500).json({ 
      success: false,
      message: 'Failed to get chapter content'
    });
  }
});

// 记录用户阅读章节（修正版 - 使用正确的新章节判断逻辑）
app.post('/api/user/:userId/read-chapter', async (req, res) => {
  const { userId } = req.params;
  const { chapterId } = req.body;
  
  if (!chapterId) {
    return res.status(400).json({ message: 'Please provide chapter ID' });
  }
  
  let db;
  try {
    // 使用新的数据库连接
    const mysql = require('mysql2/promise');
    db = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '123456',
      database: process.env.DB_NAME || 'kongfuworld',
      charset: 'utf8mb4'
    });
    
    // 1. 检查章节是否存在
    const [chapters] = await db.execute('SELECT id, novel_id, unlock_price FROM chapter WHERE id = ?', [chapterId]);
    if (chapters.length === 0) {
      return res.status(404).json({ message: 'Chapter not found' });
    }
    const chapter = chapters[0];
    
    // 2. 获取用户信息
    const [userResults] = await db.execute('SELECT id, points, golden_karma, username FROM user WHERE id = ?', [userId]);
    if (userResults.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    const user = userResults[0];
    
    // 3. 先检查并处理时间解锁状态（关键修复）
    await checkAndUpdateTimeUnlock(db, userId, chapterId);
    
    // 4. 判断章节解锁状态（修复免费章节处理）
    let isUnlocked, unlockTime, hasValidChampion = false;
    
    if (!chapter.unlock_price || chapter.unlock_price <= 0) {
      // 免费章节：默认解锁，解锁时间为当前时间
      isUnlocked = true;
      unlockTime = new Date();
      hasValidChampion = false; // 免费章节不需要Champion会员
      console.log(`[DEBUG] 免费章节 ${chapterId}，解锁状态: ${isUnlocked}, 解锁时间: ${unlockTime}`);
    } else {
      // 付费章节：检查解锁记录和Champion会员
      const [unlockInfo] = await db.execute(`
        SELECT 
          CASE 
            WHEN COUNT(*) > 0 THEN 1 
            ELSE 0 
          END as is_unlocked,
          MAX(unlocked_at) as unlock_time
        FROM chapter_unlocks 
        WHERE user_id = ? AND chapter_id = ? AND status = 'unlocked'
      `, [userId, chapterId]);
      
      const [championSubs] = await db.execute(`
        SELECT * FROM user_champion_subscription 
        WHERE user_id = ? AND novel_id = ? AND is_active = 1 AND end_date > NOW()
      `, [userId, chapter.novel_id]);
      
      hasValidChampion = championSubs.length > 0;
      
      isUnlocked = unlockInfo[0].is_unlocked || hasValidChampion;
      unlockTime = unlockInfo[0].unlock_time || (hasValidChampion ? new Date() : null);
      console.log(`[DEBUG] 付费章节 ${chapterId}，解锁状态: ${isUnlocked}, 解锁时间: ${unlockTime}, Champion会员: ${hasValidChampion}`);
    }
    
    // 5. 检查是否有历史阅读记录
    const [existingRecords] = await db.execute(`
      SELECT COUNT(*) as count FROM reading_log 
      WHERE user_id = ? AND chapter_id = ?
    `, [userId, chapterId]);
    
    const hasHistoryRecords = existingRecords[0].count > 0;
    
    // 6. 记录阅读日志（每次访问都插入新记录）
    const [insertResult] = await db.execute(`
      INSERT INTO reading_log (user_id, chapter_id, read_at, is_unlocked, unlock_time, page_enter_time) 
      VALUES (?, ?, NOW(), ?, ?, NOW())
    `, [userId, chapterId, isUnlocked, unlockTime]);
    
    const recordId = insertResult.insertId;
    console.log(`[DEBUG] 用户 ${userId} 访问章节 ${chapterId}，创建新记录 ID: ${recordId}，解锁状态: ${isUnlocked}, 解锁时间: ${unlockTime}`);
    
    // 6. 使用正确的新章节判断逻辑（在记录阅读日志之后）
    const newChapterCheck = await checkIsNewChapterImproved(db, userId, chapterId, hasValidChampion);
    
    // 5. 更新任务进度（使用新的任务管理系统）
    if (newChapterCheck.isNewChapter) {
      try {
        const { updateMissionProgress } = require('./mission_manager');
        const missionKeys = ['read_2_chapters', 'read_5_chapters', 'read_10_chapters'];
        
        for (const missionKey of missionKeys) {
          const result = await updateMissionProgress(userId, missionKey, 1, chapterId);
          if (result.success) {
            console.log(`[DEBUG] 任务 ${missionKey} 进度Update successful:`, result.data);
          } else {
            console.log(`[DEBUG] 任务 ${missionKey} 进度Update failed:`, result.message);
          }
        }
      } catch (error) {
        console.error('Failed to update mission progress:', error);
      }
    }
    
    res.json({
      success: true,
      message: 'Reading record saved',
      recordId: recordId,  // 返回记录ID供前端时间追踪使用
      isNewChapter: newChapterCheck.isNewChapter,
      reason: newChapterCheck.reason,
      details: newChapterCheck.details
    });
    
  } catch (error) {
    console.error('Failed to record reading log:', error);
    // 不要因为记录阅读日志失败而返回错误，只记录日志
    // 这样可以避免影响用户体验
    if (!res.headersSent) {
      res.status(500).json({ message: 'Failed to record reading log', error: error.message });
    }
  } finally {
    // 确保数据库连接被正确关闭
    if (db) {
      try {
        await db.end();
      } catch (closeError) {
        console.error('Failed to close database connection:', closeError);
      }
    }
  }
});

// 检查并处理时间解锁状态
async function checkAndUpdateTimeUnlock(db, userId, chapterId) {
  try {
    const now = new Date();
    
    // 1. 查询章节的时间解锁记录
    const [timeUnlockRecords] = await db.execute(`
      SELECT * FROM chapter_unlocks 
      WHERE user_id = ? AND chapter_id = ? AND unlock_method = 'time_unlock' AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 1
    `, [userId, chapterId]);
    
    if (timeUnlockRecords.length > 0) {
      const timeUnlock = timeUnlockRecords[0];
      const unlockAt = new Date(timeUnlock.unlock_at);
      
      // 2. 检查时间解锁是否已到期
      if (now >= unlockAt) {
        console.log(`时间解锁已到期，更新解锁状态: 章节${chapterId}`);
        
        // 3. 更新解锁状态
        await db.execute(`
          UPDATE chapter_unlocks 
          SET status = 'unlocked', unlocked_at = ?
          WHERE id = ?
        `, [now, timeUnlock.id]);
        
        console.log(`章节${chapterId}时间解锁已完成`);
      } else {
        console.log(`章节${chapterId}时间解锁尚未到期，解锁时间: ${unlockAt.toISOString()}`);
      }
    }
  } catch (error) {
    console.error('检查时间解锁状态失败:', error);
  }
}

// 正确的新章节判断逻辑
// A. 付费章节判断:
//    无Champion会员或已过期: 只有今天解锁且今天首次阅读才算新章节
//    有有效Champion会员: 只有今天首次阅读才算新章节
// B. 免费章节判断:
//    免费章节: 只有今天首次阅读才算新章节
async function checkIsNewChapterImproved(db, userId, chapterId, hasValidChampion = null) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    
    // 1. 查询章节基本信息
    const [chapters] = await db.execute(`
      SELECT id, novel_id, unlock_price
      FROM chapter 
      WHERE id = ?
    `, [chapterId]);
    
    if (chapters.length === 0) {
      return {
        isNewChapter: false,
        reason: 'Chapter not found',
        details: {}
      };
    }
    
    const chapter = chapters[0];
    
    // 2. 查询用户Champion会员状态（如果未提供参数则查询）
    if (hasValidChampion === null) {
      const [championStatus] = await db.execute(`
        SELECT 
          ucs.*,
          CASE 
            WHEN ucs.end_date > NOW() THEN 1
            ELSE 0
          END as is_valid
        FROM user_champion_subscription ucs
        WHERE ucs.user_id = ? AND ucs.novel_id = ? AND ucs.is_active = 1
        ORDER BY ucs.end_date DESC
        LIMIT 1
      `, [userId, chapter.novel_id]);
      
      hasValidChampion = championStatus.length > 0 && championStatus[0].is_valid === 1;
    }
    
    // 3. 查询该章节的所有有效阅读记录（只统计已解锁的阅读记录）
    const [allReadingRecords] = await db.execute(`
      SELECT id, read_at, DATE(read_at) as read_date, is_unlocked
      FROM reading_log 
      WHERE user_id = ? AND chapter_id = ? AND is_unlocked = 1
      ORDER BY read_at ASC
    `, [userId, chapterId]);
    
    // 4. 查询该章节的解锁记录
    const [unlockRecords] = await db.execute(`
      SELECT id, unlock_method, status, unlocked_at, created_at
      FROM chapter_unlocks 
      WHERE user_id = ? AND chapter_id = ?
      ORDER BY created_at ASC
    `, [userId, chapterId]);
    
    // 5. 检查Champion会员解锁状态（使用之前查询的结果）
    // 注意：hasValidChampion已经在第1913行定义过了
    
    // 5. 分析阅读记录
    const todayReadingRecords = allReadingRecords.filter(record => {
      // 使用UTC时间避免时区问题
      const recordDate = new Date(record.read_at).toISOString().slice(0, 10);
      return recordDate === today;
    });
    const historyReadingRecords = allReadingRecords.filter(record => {
      const recordDate = new Date(record.read_at).toISOString().slice(0, 10);
      return recordDate !== today;
    });
    
    // 6. 检查今天是否有解锁记录
    const todayUnlockRecords = unlockRecords.filter(record => {
      const unlockDate = new Date(record.unlocked_at || record.created_at).toISOString().slice(0, 10);
      return unlockDate === today && record.status === 'unlocked';
    });
    
    // 7. 检查Champion会员解锁（今天首次阅读且有效Champion会员）
    const isChampionUnlocked = hasValidChampion && todayReadingRecords.length === 1 && historyReadingRecords.length === 0;
    
    // 7. 判断是否为新章节
    let isNewChapter = false;
    let reason = '';
    let details = {
      totalRecords: allReadingRecords.length,
      todayRecords: todayReadingRecords.length,
      historyRecords: historyReadingRecords.length,
      isTodayFirstRead: todayReadingRecords.length === 1,
      hasTodayUnlock: todayUnlockRecords.length > 0,
      hasValidChampion: hasValidChampion,
      unlock_price: chapter.unlock_price || 0
    };
    
    if (chapter.unlock_price && chapter.unlock_price > 0) {
      // A. 付费章节判断
      if (hasValidChampion) {
        // 有有效Champion会员: 只有今天首次阅读才算新章节
        if (todayReadingRecords.length === 1 && historyReadingRecords.length === 0) {
          isNewChapter = true;
          reason = '有有效Champion会员，今天首次阅读该章节';
        } else if (todayReadingRecords.length === 1 && historyReadingRecords.length > 0) {
          isNewChapter = false;
          reason = '有有效Champion会员，但以前阅读过该章节';
        } else if (todayReadingRecords.length > 1) {
          isNewChapter = false;
          reason = '有有效Champion会员，但今天已经阅读过该章节';
        } else {
          isNewChapter = false;
          reason = '有有效Champion会员，但今天没有阅读该章节';
        }
      } else {
        // 无Champion会员或已过期: 今天解锁且今天首次阅读才算新章节
        if (todayUnlockRecords.length > 0 && todayReadingRecords.length === 1 && historyReadingRecords.length === 0) {
          isNewChapter = true;
          reason = '付费章节，无Champion会员或会员过期，今天解锁该章节并首次阅读';
        } else if (todayUnlockRecords.length > 0 && (todayReadingRecords.length > 1 || historyReadingRecords.length > 0)) {
          isNewChapter = false;
          reason = '付费章节，无Champion会员或会员过期，今天解锁该章节但非首次阅读';
        } else if (todayUnlockRecords.length === 0) {
          isNewChapter = false;
          reason = '付费章节，无Champion会员或会员过期，今天未解锁该章节';
        } else {
          isNewChapter = false;
          reason = '付费章节，无Champion会员或会员过期，今天没有阅读该章节';
        }
      }
    } else {
      // B. 免费章节判断: 只有今天首次阅读才算新章节
      if (todayReadingRecords.length === 1 && historyReadingRecords.length === 0) {
        isNewChapter = true;
        reason = '免费章节，今天首次阅读该章节';
      } else if (todayReadingRecords.length === 1 && historyReadingRecords.length > 0) {
        isNewChapter = false;
        reason = '免费章节，但以前阅读过该章节';
      } else if (todayReadingRecords.length > 1) {
        isNewChapter = false;
        reason = '免费章节，但今天已经阅读过该章节';
      } else {
        isNewChapter = false;
        reason = '免费章节，但今天没有阅读该章节';
      }
    }
    
    // 8. 特殊处理：Champion会员解锁的章节
    if (isChampionUnlocked) {
      isNewChapter = true;
      reason = 'Champion会员解锁，今天首次阅读该章节';
    }
    
    return {
      isNewChapter,
      reason,
      details
    };
    
  } catch (error) {
    console.error('检查新章节失败:', error);
    return {
      isNewChapter: false,
      reason: '检查失败: ' + error.message
    };
  }
}

// 检查章节解锁状态的辅助函数
async function checkChapterUnlockStatus(db, userId, chapterId, chapter, user) {
  try {
    // 1. 检查章节是否免费
    const now = new Date();
    const isFree = !chapter.unlock_price || chapter.unlock_price <= 0;
    
    if (isFree) {
      return {
        isUnlocked: true,
        unlockMethod: 'free',
        reason: '免费章节'
      };
    }
    
    // 2. 检查用户Champion会员状态
    const [championResults] = await db.execute(`
      SELECT * FROM user_champion_subscription 
      WHERE user_id = ? AND novel_id = ? AND is_active = 1 AND end_date > NOW()
    `, [userId, chapter.novel_id]);
    
    if (championResults.length > 0) {
      return {
        isUnlocked: true,
        unlockMethod: 'champion',
        reason: 'Champion会员永久解锁'
      };
    }
    
    // 3. 检查付费解锁记录
    const [unlockResults] = await db.execute(`
      SELECT * FROM chapter_unlocks 
      WHERE user_id = ? AND chapter_id = ? AND status = 'unlocked'
    `, [userId, chapterId]);
    
    if (unlockResults.length > 0) {
      const unlock = unlockResults[0];
      return {
        isUnlocked: true,
        unlockMethod: unlock.unlock_method,
        reason: `通过${getUnlockMethodName(unlock.unlock_method)}解锁`
      };
    }
    
    // 4. 检查时间解锁状态
    const [timeUnlockResults] = await db.execute(`
      SELECT * FROM chapter_unlocks 
      WHERE user_id = ? AND chapter_id = ? AND unlock_method = 'time_unlock' AND status = 'pending'
    `, [userId, chapterId]);
    
    if (timeUnlockResults.length > 0) {
      const timeUnlock = timeUnlockResults[0];
      const unlockAt = new Date(timeUnlock.unlock_at);
      
      if (now >= unlockAt) {
        // 时间解锁已到期，自动解锁
        await db.execute(`
          UPDATE chapter_unlocks 
          SET status = 'unlocked', unlocked_at = ?, updated_at = ?
          WHERE id = ?
        `, [now, now, timeUnlock.id]);
        
        return {
          isUnlocked: true,
          unlockMethod: 'time_unlock',
          reason: '时间解锁已完成'
        };
      } else {
        return {
          isUnlocked: false,
          unlockMethod: 'time_unlock',
          reason: '时间解锁等待中',
          unlockAt: unlockAt
        };
      }
    }
    
    // 5. 章节未解锁
    return {
      isUnlocked: false,
      unlockMethod: 'none',
      reason: '章节未解锁'
    };
    
  } catch (error) {
    console.error('Failed to check unlock status:', error);
    return {
      isUnlocked: false,
      unlockMethod: 'error',
      reason: 'Failed to check unlock status: ' + error.message
    };
  }
}

// 获取解锁方法的中文名称
function getUnlockMethodName(method) {
  const methodNames = {
    'free': '免费',
    'champion': 'Champion会员',
    'key': '钥匙解锁',
    'karma': 'Karma解锁',
    'time_unlock': '时间解锁',
    'subscription': '订阅解锁'
  };
  return methodNames[method] || method;
}

// 获取签到奖励配置
app.get('/api/checkin/rewards', (req, res) => {
  res.json({
    success: true,
    data: dailyCheckinAPI.REWARDS
  });
});

// 获取支持的时区列表
app.get('/api/timezone/supported', (req, res) => {
  const timezoneHandler = require('./utils/timezone');
  res.json({
    success: true,
    data: timezoneHandler.getSupportedTimezones()
  });
});

// 获取用户时区信息
app.get('/api/timezone/info/:timezone', (req, res) => {
  const { timezone } = req.params;
  const timezoneHandler = require('./utils/timezone');
  
  try {
    const info = timezoneHandler.getTimezoneInfo(timezone);
    res.json({
      success: true,
      data: info
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Invalid timezone'
    });
  }
});

// 任务系统路由 (已迁移到 mission-v2)
// const missionRoutes = require('./routes/mission');
// app.use('/api/mission', missionRoutes);

// 新的任务管理系统路由
app.use('/api/mission-v2', missionV2Routes);
app.use('/api/reading-mission', readingWithMissionRoutes);

// 章节解锁系统路由
const chapterUnlockRoutes = require('./routes/chapter_unlock');
app.use('/api/chapter-unlock', chapterUnlockRoutes);

// 作品数据评价系统路由
app.use('/api/analytics', analyticsRoutes);
app.use('/api/rankings', rankingsRoutes);

// Key交易记录路由
const keyTransactionRoutes = require('./routes/key_transaction');
app.use('/api/key-transaction', keyTransactionRoutes);

// 时间解锁系统路由（优化版 - 按需检查）
const timeUnlockRoutes = require('./routes/time_unlock_optimized');
app.use('/api/time-unlock', timeUnlockRoutes);

// 阅读时间追踪路由
const readingTimingRoutes = require('./routes/reading_timing');
app.use('/api/reading-timing', readingTimingRoutes);

// 章节点赞/点踩路由
const chapterLikeRoutes = require('./routes/chapter_like');
app.use('/api/chapter-like', chapterLikeRoutes);

// API文档页面
app.get('/api', (req, res) => {
  res.send(`
    <h2>API文档</h2>
    <ul>
      <li>
        <b>POST /api/login</b><br/>
        <pre>
请求体: { "username": "xxx", "password": "xxx" }
返回: { "message": "Login successful", "user": { ... } }
        </pre>
      </li>
      <li>
        <b>GET /api/homepage/all</b><br/>
        <pre>
获取首页所有数据
返回: { "success": true, "data": { "banners": [...], "popularNovels": [...], ... } }
        </pre>
      </li>
      <li>
        <b>GET /api/checkin/status/:userId</b><br/>
        <pre>
获取用户签到状态
返回: { "success": true, "data": { "hasCheckedInToday": false, ... } }
        </pre>
      </li>
      <li>
        <b>POST /api/checkin/:userId</b><br/>
        <pre>
执行签到
返回: { "success": true, "message": "Check-in successful", "data": { "keysEarned": 3, ... } }
        </pre>
      </li>
    </ul>
  `);
});

// ==================== 评论系统API ====================

// 获取小说的评论列表（只返回主评论，parent_id IS NULL）
app.get('/api/novel/:novelId/reviews', async (req, res) => {
  const startedAt = Date.now();
  const tag = 'novel.reviews';

  const rawId = req.params && req.params.novelId;
  const novelId = Number.parseInt(String(rawId), 10);
  if (!Number.isFinite(novelId) || novelId <= 0) {
    console.info('[API] done:', { tag, ms: Date.now() - startedAt, ok: false, code: 'BAD_ID' });
    return res.status(400).json({ message: 'Invalid novel id' });
  }

  const pageNum = Number.parseInt(String(req.query && req.query.page ? req.query.page : 1), 10);
  const limitNum = Number.parseInt(String(req.query && req.query.limit ? req.query.limit : 10), 10);
  const safePage = Number.isFinite(pageNum) && pageNum > 0 ? Math.floor(pageNum) : 1;
  const safeLimit = Number.isFinite(limitNum) ? Math.max(1, Math.min(50, Math.floor(limitNum))) : 10;
  const safeOffset = (safePage - 1) * safeLimit;

  console.info('[API] start:', { tag });

  const listSql = `
    SELECT
      r.id,
      r.content,
      r.rating,
      r.created_at,
      r.likes,
      r.dislikes,
      r.comments,
      r.views,
      r.is_recommended,
      r.user_id,
      u.username,
      u.avatar,
      u.is_vip
    FROM review r
    JOIN user u ON r.user_id = u.id
    WHERE r.novel_id = ? AND r.parent_id IS NULL
    ORDER BY r.created_at DESC
    LIMIT ${safeLimit} OFFSET ${safeOffset}
  `;

  const totalSql = `
    SELECT COUNT(*) as total
    FROM review
    WHERE novel_id = ? AND parent_id IS NULL
  `;

  // 递归统计所有层级回复数量
  const countRepliesAll = async (parentId) => {
    const [children] = await Db.query(
      'SELECT id FROM review WHERE parent_id = ?',
      [parentId],
      { tag: 'novel.reviews.replyIds', idempotent: true }
    );
    if (!Array.isArray(children) || children.length === 0) return 0;
    const subCounts = await Promise.all(children.map((c) => countRepliesAll(c.id)));
    const subTotal = subCounts.reduce((sum, n) => sum + n, 0);
    return children.length + subTotal;
  };

  try {
    const [[reviews], [countRows]] = await Promise.all([
      Db.query(listSql, [novelId], { tag: 'novel.reviews.list', idempotent: true }),
      Db.query(totalSql, [novelId], { tag: 'novel.reviews.total', idempotent: true }),
    ]);

    const total = (Array.isArray(countRows) && countRows[0] && countRows[0].total) ? Number(countRows[0].total) : 0;

    if (Array.isArray(reviews) && reviews.length > 0) {
      const counts = await Promise.all(reviews.map((r) => countRepliesAll(r.id)));
      for (let i = 0; i < reviews.length; i++) {
        reviews[i].comments = counts[i];
      }
    }

    console.info('[API] done:', { tag, ms: Date.now() - startedAt, ok: true });
    return res.json({
      success: true,
      data: {
        reviews: Array.isArray(reviews) ? reviews : [],
        total,
        page: safePage,
        limit: safeLimit,
      },
    });
  } catch (err) {
    console.error('[API] failed:', {
      tag,
      ms: Date.now() - startedAt,
      code: err && err.code,
      fatal: !!(err && err.fatal),
    });
    return res.status(500).json({ message: '获取评论失败' });
  }
});

// 获取小说的评论统计（只统计主评论，parent_id IS NULL）
app.get('/api/novel/:novelId/review-stats', async (req, res) => {
  const startedAt = Date.now();
  const tag = 'novel.reviewStats';

  const rawId = req.params && req.params.novelId;
  const novelId = Number.parseInt(String(rawId), 10);
  if (!Number.isFinite(novelId) || novelId <= 0) {
    console.info('[API] done:', { tag, ms: Date.now() - startedAt, ok: false, code: 'BAD_ID' });
    return res.status(400).json({ message: 'Invalid novel id' });
  }

  console.info('[API] start:', { tag });

  const query = `
    SELECT
      COUNT(*) as total_reviews,
      AVG(rating) as average_rating,
      SUM(CASE WHEN is_recommended = 1 THEN 1 ELSE 0 END) as recommended_count,
      SUM(likes) as total_likes
    FROM review
    WHERE novel_id = ? AND parent_id IS NULL
  `;

  try {
    const [rows] = await Db.query(query, [novelId], { tag, idempotent: true });
    const stats = (Array.isArray(rows) && rows[0]) ? rows[0] : {};

    const totalReviews = Number(stats.total_reviews || 0);
    const recommendedCount = Number(stats.recommended_count || 0);

    console.info('[API] done:', { tag, ms: Date.now() - startedAt, ok: true });
    return res.json({
      success: true,
      data: {
        total_reviews: totalReviews,
        average_rating: Math.round((Number(stats.average_rating || 0)) * 10) / 10,
        recommended_count: recommendedCount,
        total_likes: Number(stats.total_likes || 0),
        recommendation_rate: totalReviews > 0
          ? Math.round((recommendedCount / totalReviews) * 100)
          : 0,
      },
    });
  } catch (err) {
    console.error('[API] failed:', {
      tag,
      ms: Date.now() - startedAt,
      code: err && err.code,
      fatal: !!(err && err.fatal),
    });
    return res.status(500).json({ message: '获取评论统计失败' });
  }
});

// 提交评论
app.post('/api/novel/:novelId/review', authenticateToken, (req, res) => {
  const { novelId } = req.params;
  const { content, rating, is_recommended } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Please login first' });
  }

  if (!content || content.trim().length < 100) {
    return res.status(400).json({ message: '评论内容至少需要100个字符' });
  }

  // 允许用户多次评论同一部小说，直接插入新评论
  const insertQuery = `
    INSERT INTO review (novel_id, user_id, content, rating, is_recommended, created_at, parent_id)
    VALUES (?, ?, ?, ?, ?, NOW(), NULL)
  `;

  db.query(insertQuery, [novelId, userId, content, rating || null, is_recommended || 0], (err, result) => {
    if (err) {
      console.error('提交评论失败:', err);
      return res.status(500).json({ message: '提交评论失败' });
    }

    // 更新小说的评论数（只统计主评论）
    db.query('UPDATE novel SET reviews = (SELECT COUNT(*) FROM review WHERE novel_id = ? AND parent_id IS NULL) WHERE id = ?', [novelId, novelId], (err2) => {
      if (err2) {
        console.error('更新小说评论数失败:', err2);
      }
    });

    res.json({
      success: true,
      message: '评论提交成功',
      data: {
        review_id: result.insertId
      }
    });
  });
});

// 点赞评论 - 简化版本
// 点赞评价 - 重构版本（使用单表 + is_like）
app.post('/api/review/:reviewId/like', authenticateToken, async (req, res) => {
  const { reviewId } = req.params;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Please login first' });
  }

  try {
    const result = await likeDislikeService.updateReviewLikeStatus(parseInt(reviewId, 10), userId, 1);
    return res.json({
      success: true,
      message: '点赞成功',
      action: 'liked',
      data: {
        likes: result.likes,
        dislikes: result.dislikes
      }
    });
  } catch (err) {
    console.error('点赞评价失败:', err);
    return res.status(500).json({ success: false, message: '点赞失败' });
  }
});

// 点踩评价 - 重构版本（使用单表 + is_like）
app.post('/api/review/:reviewId/dislike', authenticateToken, async (req, res) => {
  const { reviewId } = req.params;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Please login first' });
  }

  try {
    const result = await likeDislikeService.updateReviewLikeStatus(parseInt(reviewId, 10), userId, 0);
    return res.json({
      success: true,
      message: '点踩成功',
      action: 'disliked',
      data: {
        likes: result.likes,
        dislikes: result.dislikes
      }
    });
  } catch (err) {
    console.error('点踩评价失败:', err);
    return res.status(500).json({ success: false, message: '点踩失败' });
  }
});

// 获取评论的回复
app.get('/api/review/:reviewId/comments', (req, res) => {
  const { reviewId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  // 从review表读取回复，使用parent_id关联
  const query = `
    SELECT 
      r.id,
      r.content,
      r.created_at,
      r.likes,
      COALESCE(r.dislikes, 0) as dislikes,
      r.user_id,
      COALESCE(r.comments, 0) as comments,
      u.username,
      u.pen_name,
      u.is_author,
      u.avatar,
      u.is_vip
    FROM review r
    JOIN user u ON r.user_id = u.id
    WHERE r.parent_id = ?
    ORDER BY r.created_at ASC
    LIMIT ? OFFSET ?
  `;

  db.query(query, [reviewId, parseInt(limit), parseInt(offset)], (err, results) => {
    if (err) {
      console.error('获取评论回复失败:', err);
      return res.status(500).json({ message: '获取评论回复失败' });
    }

    res.json({
      success: true,
      data: results
    });
  });
});

// 回复评论
app.post('/api/review/:reviewId/comment', authenticateToken, (req, res) => {
  const { reviewId } = req.params;
  const { content } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Please login first' });
  }

  if (!content || content.trim().length < 10) {
    return res.status(400).json({ message: '回复内容至少需要10个字符' });
  }

  // 先获取父review的novel_id
  db.query('SELECT novel_id FROM review WHERE id = ?', [reviewId], (err, parentReview) => {
    if (err) {
      console.error('获取父评论失败:', err);
      return res.status(500).json({ message: '获取父评论失败' });
    }

    if (parentReview.length === 0) {
      return res.status(404).json({ message: '父评论不存在' });
    }

    const novelId = parentReview[0].novel_id;

    // 将回复保存到review表，使用parent_id关联
  const insertQuery = `
      INSERT INTO review (parent_id, novel_id, user_id, content, created_at, rating, likes, comments, views, is_recommended)
      VALUES (?, ?, ?, ?, NOW(), NULL, 0, 0, 0, 0)
  `;

    db.query(insertQuery, [reviewId, novelId, userId, content], (err2, result) => {
      if (err2) {
        console.error('回复评论失败:', err2);
      return res.status(500).json({ message: '回复评论失败' });
    }

      // 更新父评论的回复数
      db.query('UPDATE review SET comments = comments + 1 WHERE id = ?', [reviewId], (err3) => {
        if (err3) {
          console.error('更新回复数失败:', err3);
      }
    });

      res.json({
        success: true,
        message: '回复成功',
        data: {
          comment_id: result.insertId
        }
      });
    });
  });
});

// 更新评论（主评论或子评论）
app.put('/api/review/:reviewId', authenticateToken, (req, res) => {
  const { reviewId } = req.params;
  const { content } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Please login first' });
  }

  if (!content || content.trim().length < 10) {
    return res.status(400).json({ message: '评论内容至少需要10个字符' });
  }

  // 先检查评论是否存在且属于当前用户
  db.query('SELECT id, user_id FROM review WHERE id = ?', [reviewId], (err, review) => {
    if (err) {
      console.error('查询评论失败:', err);
      return res.status(500).json({ message: '查询评论失败' });
    }

    if (review.length === 0) {
      return res.status(404).json({ message: '评论不存在' });
    }

    if (review[0].user_id !== userId) {
      return res.status(403).json({ message: '无权编辑此评论' });
    }

    // 更新评论内容
    db.query('UPDATE review SET content = ? WHERE id = ?', [content.trim(), reviewId], (err2) => {
      if (err2) {
        console.error('更新评论失败:', err2);
        return res.status(500).json({ message: '更新评论失败' });
      }

      res.json({
        success: true,
        message: '评论更新成功'
      });
    });
  });
});

// ==================== 章节评论API ====================

// 获取章节评论
app.get('/api/chapter/:chapterId/comments', async (req, res) => {
  const { chapterId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.max(1, Math.min(50, parseInt(limit, 10) || 10));
  const safeOffset = (safePage - 1) * safeLimit;

  // 获取评论列表（comment表现在只存储章节评论，target_id就是chapter_id）
  const commentsQuery = `
    SELECT 
      c.id,
      c.content,
      c.created_at,
      c.likes,
      COALESCE(c.dislikes, 0) as dislikes,
      c.parent_comment_id,
      c.user_id,
      u.username,
      u.avatar,
      u.is_vip
    FROM comment c
    JOIN user u ON c.user_id = u.id
    WHERE c.target_id = ?
    ORDER BY c.created_at DESC
    LIMIT ${safeLimit} OFFSET ${safeOffset}
  `;

  try {
    const [comments] = await Db.query(commentsQuery, [chapterId], { tag: 'chapter.comments.list', idempotent: true });
    // 获取评论统计
    const statsQuery = `
      SELECT 
        COUNT(*) as total_comments,
        SUM(CASE WHEN likes > 0 THEN 1 ELSE 0 END) as liked_comments,
        SUM(likes) as total_likes
      FROM comment 
      WHERE target_id = ?
    `;

    const [stats] = await Db.query(statsQuery, [chapterId], { tag: 'chapter.comments.stats', idempotent: true });
    const stat = (stats && stats[0]) ? stats[0] : { total_comments: 0, liked_comments: 0, total_likes: 0 };
    const likeRate = stat.total_comments > 0 ?
      Math.round((stat.liked_comments / stat.total_comments) * 100) : 0;

    return res.json({
      success: true,
      data: {
        comments: comments,
        total: stat.total_comments,
        like_rate: likeRate,
        total_likes: stat.total_likes
      }
    });
  } catch (err) {
    console.error('[chapter.comments] failed:', { tag: 'chapter.comments.list', code: err && err.code, fatal: !!(err && err.fatal) });
    return res.status(500).json({ message: '获取章节评论失败' });
  }
});

// 提交章节评论
app.post('/api/chapter/:chapterId/comment', authenticateToken, (req, res) => {
  const { chapterId } = req.params;
  const { content } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Please login first' });
  }

  if (!content || content.trim().length < 10) {
    return res.status(400).json({ message: '评论内容至少需要10个字符' });
  }

  // 先查询章节的novel_id
  db.query('SELECT novel_id FROM chapter WHERE id = ?', [chapterId], (err, chapterResult) => {
    if (err) {
      console.error('查询章节信息失败:', err);
      return res.status(500).json({ message: '查询章节信息失败' });
    }

    if (chapterResult.length === 0) {
      return res.status(404).json({ message: '章节不存在' });
    }

    const novelId = chapterResult[0].novel_id;

    if (!novelId) {
      console.error('章节novel_id为空，章节ID:', chapterId);
      return res.status(500).json({ message: '章节信息不完整，无法创建评论' });
    }

    console.log('创建章节评论 - chapterId:', chapterId, 'novelId:', novelId, 'userId:', userId);

    const insertQuery = `
      INSERT INTO comment (user_id, target_id, novel_id, content, created_at)
      VALUES (?, ?, ?, ?, NOW())
    `;

    db.query(insertQuery, [userId, chapterId, novelId, content], (err2, result) => {
      if (err2) {
        console.error('提交章节评论失败:', err2);
        return res.status(500).json({ message: '提交章节评论失败' });
      }

      console.log('章节评论创建成功 - commentId:', result.insertId, 'novelId:', novelId);
      res.json({
        success: true,
        message: '评论提交成功',
        data: {
          comment_id: result.insertId
        }
      });
    });
  });
});

// 点赞章节评论 - 简化版本
// 点赞章节评论 - 重构版本（使用单表 + is_like）
app.post('/api/comment/:commentId/like', authenticateToken, async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Please login first' });
  }

  try {
    const result = await likeDislikeService.updateCommentLikeStatus(parseInt(commentId, 10), userId, 1);
    return res.json({
      success: true,
      message: '点赞成功',
      action: 'liked',
      data: {
        likes: result.likes,
        dislikes: result.dislikes
      }
    });
  } catch (err) {
    console.error('点赞章节评论失败:', err);
    return res.status(500).json({ success: false, message: '点赞失败' });
  }
});

// 回复章节评论
app.post('/api/comment/:commentId/reply', authenticateToken, (req, res) => {
  console.log('🔍 回复API被调用');
  const { commentId } = req.params;
  const { content } = req.body;
  const userId = req.user?.userId;

  console.log('🔍 参数:', { commentId, content, userId });

  if (!userId) {
    console.log('❌ 用户未登录');
    return res.status(401).json({ message: 'Please login first' });
  }

  if (!content || content.trim().length < 10) {
    console.log('❌ 回复内容太短:', content?.length);
    return res.status(400).json({ message: '回复内容至少需要10个字符' });
  }

  // 获取原评论的章节ID和novel_id
  db.query('SELECT target_id, novel_id FROM comment WHERE id = ?', [commentId], (err, parentComment) => {
    if (err) {
      console.error('获取原评论失败:', err);
      return res.status(500).json({ message: '获取原评论失败' });
    }

    if (parentComment.length === 0) {
      return res.status(404).json({ message: '原评论不存在' });
    }

    const chapterId = parentComment[0].target_id;
    let novelId = parentComment[0].novel_id;

    // 如果父评论的novel_id是NULL，从章节表查询novel_id
    if (!novelId && chapterId) {
      db.query('SELECT novel_id FROM chapter WHERE id = ?', [chapterId], (err3, chapterResult) => {
        if (err3) {
          console.error('查询章节信息失败:', err3);
          return res.status(500).json({ message: '查询章节信息失败' });
        }

        if (chapterResult.length === 0) {
          return res.status(404).json({ message: '章节不存在' });
        }

        novelId = chapterResult[0].novel_id;

        if (!novelId) {
          console.error('章节novel_id为空，章节ID:', chapterId);
          return res.status(500).json({ message: '章节信息不完整，无法创建回复' });
        }

        console.log('创建回复评论 - parentCommentId:', commentId, 'chapterId:', chapterId, 'novelId:', novelId, 'userId:', userId);

        // 插入回复
        const insertQuery = `
          INSERT INTO comment (user_id, target_id, novel_id, parent_comment_id, content, created_at)
          VALUES (?, ?, ?, ?, ?, NOW())
        `;

        db.query(insertQuery, [userId, chapterId, novelId, commentId, content], (err2, result) => {
          if (err2) {
            console.error('回复评论失败:', err2);
            return res.status(500).json({ message: '回复评论失败' });
          }

          console.log('回复评论创建成功 - replyId:', result.insertId, 'novelId:', novelId);
          res.json({
            success: true,
            message: '回复成功',
            data: {
              reply_id: result.insertId
            }
          });
        });
      });
    } else {
      // 如果父评论已经有novel_id，直接插入
      if (!novelId && chapterId) {
        // 如果父评论的novel_id也是NULL，从章节表查询
        db.query('SELECT novel_id FROM chapter WHERE id = ?', [chapterId], (err3, chapterResult) => {
          if (err3) {
            console.error('查询章节信息失败:', err3);
            return res.status(500).json({ message: '查询章节信息失败' });
          }

          if (chapterResult.length === 0) {
            return res.status(404).json({ message: '章节不存在' });
          }

          novelId = chapterResult[0].novel_id;
          if (!novelId) {
            console.error('章节novel_id为空，章节ID:', chapterId);
            return res.status(500).json({ message: '章节信息不完整，无法创建回复' });
          }

          console.log('创建回复评论（从章节查询novel_id）- parentCommentId:', commentId, 'chapterId:', chapterId, 'novelId:', novelId, 'userId:', userId);

          const insertQuery = `
            INSERT INTO comment (user_id, target_id, novel_id, parent_comment_id, content, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
          `;

          db.query(insertQuery, [userId, chapterId, novelId, commentId, content], (err2, result) => {
            if (err2) {
              console.error('回复评论失败:', err2);
              return res.status(500).json({ message: '回复评论失败' });
            }

            console.log('回复评论创建成功 - replyId:', result.insertId, 'novelId:', novelId);
            res.json({
              success: true,
              message: '回复成功',
              data: {
                reply_id: result.insertId
              }
            });
          });
        });
      } else {
        console.log('创建回复评论（使用父评论novel_id）- parentCommentId:', commentId, 'chapterId:', chapterId, 'novelId:', novelId, 'userId:', userId);

        const insertQuery = `
          INSERT INTO comment (user_id, target_id, novel_id, parent_comment_id, content, created_at)
          VALUES (?, ?, ?, ?, ?, NOW())
        `;

        db.query(insertQuery, [userId, chapterId, novelId, commentId, content], (err2, result) => {
          if (err2) {
            console.error('回复评论失败:', err2);
            return res.status(500).json({ message: '回复评论失败' });
          }

          console.log('回复评论创建成功 - replyId:', result.insertId, 'novelId:', novelId);
          res.json({
            success: true,
            message: '回复成功',
            data: {
              reply_id: result.insertId
            }
          });
        });
      }
    }
  });
});

// 获取评论的回复
app.get('/api/comment/:commentId/replies', (req, res) => {
  const { commentId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  const query = `
    SELECT 
      c.id,
      c.content,
      c.created_at,
      c.likes,
      c.dislikes,
      c.user_id,
      u.username,
      u.pen_name,
      u.is_author,
      u.avatar,
      u.is_vip
    FROM comment c
    JOIN user u ON c.user_id = u.id
    WHERE c.parent_comment_id = ?
    ORDER BY c.created_at ASC
    LIMIT ? OFFSET ?
  `;

  db.query(query, [commentId, parseInt(limit), parseInt(offset)], (err, results) => {
    if (err) {
      console.error('获取评论回复失败:', err);
      return res.status(500).json({ message: '获取评论回复失败' });
    }

    res.json({
      success: true,
      data: results
    });
  });
});

// 更新章节评论
app.put('/api/comment/:commentId', authenticateToken, (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Please login first' });
  }

  if (!content || content.trim().length < 10) {
    return res.status(400).json({ message: '评论内容至少需要10个字符' });
  }

  // 先检查评论是否存在且属于当前用户
  db.query('SELECT user_id FROM comment WHERE id = ?', [commentId], (err, comment) => {
    if (err) {
      console.error('查询评论失败:', err);
      return res.status(500).json({ message: '查询评论失败' });
    }

    if (comment.length === 0) {
      return res.status(404).json({ message: '评论不存在' });
    }

    if (comment[0].user_id !== userId) {
      return res.status(403).json({ message: '无权修改此评论' });
    }

    // 更新评论内容
    db.query('UPDATE comment SET content = ? WHERE id = ?', [content.trim(), commentId], (err2) => {
      if (err2) {
        console.error('更新评论失败:', err2);
        return res.status(500).json({ message: '更新评论失败' });
      }

      res.json({
        success: true,
        message: '评论更新成功'
      });
    });
  });
});

// 不喜欢章节评论 - 简化版本
// 点踩章节评论 - 重构版本（使用单表 + is_like）
app.post('/api/comment/:commentId/dislike', authenticateToken, async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Please login first' });
  }

  try {
    const result = await likeDislikeService.updateCommentLikeStatus(parseInt(commentId, 10), userId, 0);
    return res.json({
      success: true,
      message: '点踩成功',
      action: 'disliked',
      data: {
        likes: result.likes,
        dislikes: result.dislikes
      }
    });
  } catch (err) {
    console.error('点踩章节评论失败:', err);
    return res.status(500).json({ success: false, message: '点踩失败' });
  }
});

// ==================== 段落评论API ====================

// 获取章节的段落评论统计
app.get('/api/chapter/:chapterId/paragraph-comments', async (req, res) => {
  const { chapterId } = req.params;
  
  const query = `
    SELECT 
      paragraph_index,
      COUNT(*) as comment_count
    FROM paragraph_comment 
    WHERE chapter_id = ? AND is_deleted = 0
    GROUP BY paragraph_index
    ORDER BY paragraph_index
  `;
  
  try {
    const [results] = await Db.query(query, [chapterId], { tag: 'chapter.paragraphComments.stats', idempotent: true });
    // 转换为对象格式，便于前端使用
    const commentStats = {};
    results.forEach(row => {
      commentStats[row.paragraph_index] = row.comment_count;
    });
    
    return res.json({
      success: true,
      data: commentStats
    });
  } catch (err) {
    console.error('[chapter.paragraphComments] failed:', { tag: 'chapter.paragraphComments.stats', code: err && err.code, fatal: !!(err && err.fatal) });
    return res.status(500).json({ message: '获取段落评论统计失败' });
  }
});

// 获取指定段落的评论（支持嵌套结构）
app.get('/api/chapter/:chapterId/paragraph/:paragraphIndex/comments', async (req, res) => {
  const { chapterId, paragraphIndex } = req.params;
  const { page = 1, limit = 20 } = req.query;
  
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.max(1, Math.min(50, parseInt(limit, 10) || 20));
  const offset = (safePage - 1) * safeLimit;
  
  // 获取顶级评论（parent_id为NULL）
  const query = `
    SELECT 
      pc.id,
      pc.content,
      pc.created_at,
      COALESCE(pc.like_count, 0) as like_count,
      COALESCE(pc.dislike_count, 0) as dislike_count,
      pc.parent_id,
      pc.user_id,
      u.username,
      u.pen_name,
      u.is_author,
      u.avatar
    FROM paragraph_comment pc
    JOIN user u ON pc.user_id = u.id
    WHERE pc.chapter_id = ? AND pc.paragraph_index = ? AND pc.is_deleted = 0 AND pc.parent_id IS NULL
    ORDER BY pc.created_at DESC
    LIMIT ${safeLimit} OFFSET ${offset}
  `;
  
  try {
    const [topLevelComments] = await Db.query(
      query,
      [chapterId, paragraphIndex],
      { tag: 'chapter.paragraphComments.list', idempotent: true }
    );

    // 获取每个顶级评论的回复（保持原语义：逐条查询）
    const repliesQuery = `
      SELECT 
        pc.id,
        pc.content,
        pc.created_at,
        COALESCE(pc.like_count, 0) as like_count,
        COALESCE(pc.dislike_count, 0) as dislike_count,
        pc.parent_id,
        pc.user_id,
        u.username,
        u.pen_name,
        u.is_author,
        u.avatar
      FROM paragraph_comment pc
      JOIN user u ON pc.user_id = u.id
      WHERE pc.parent_id = ? AND pc.is_deleted = 0
      ORDER BY pc.created_at ASC
    `;

    for (const comment of (topLevelComments || [])) {
      const [replies] = await Db.query(repliesQuery, [comment.id], { tag: 'chapter.paragraphComments.replies', idempotent: true });
      comment.replies = replies;
    }

    // 获取评论总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM paragraph_comment 
      WHERE chapter_id = ? AND paragraph_index = ? AND is_deleted = 0 AND parent_id IS NULL
    `;
    const [countResult] = await Db.query(countQuery, [chapterId, paragraphIndex], { tag: 'chapter.paragraphComments.count', idempotent: true });
    const total = countResult?.[0]?.total ?? 0;

    return res.json({
      success: true,
      data: {
        comments: topLevelComments,
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          pages: Math.ceil(total / safeLimit)
        }
      }
    });
  } catch (err) {
    console.error('[chapter.paragraphComments.list] failed:', { tag: 'chapter.paragraphComments.list', code: err && err.code, fatal: !!(err && err.fatal) });
    return res.status(500).json({ message: '获取段落评论失败' });
  }
});

// 添加段落评论（支持回复）
app.post('/api/chapter/:chapterId/paragraph/:paragraphIndex/comments', (req, res) => {
  const { chapterId, paragraphIndex } = req.params;
  const { content, userId, parentId } = req.body;
  
  if (!content || !userId) {
    return res.status(400).json({ message: '评论内容和用户ID不能为空' });
  }
  
  // 首先获取章节对应的novel_id
  const getNovelIdQuery = `SELECT novel_id FROM chapter WHERE id = ?`;
  
  db.query(getNovelIdQuery, [chapterId], (err, chapterResult) => {
    if (err) {
      console.error('获取章节信息失败:', err);
      return res.status(500).json({ message: '获取章节信息失败' });
    }
    
    if (chapterResult.length === 0) {
      return res.status(404).json({ message: '章节不存在' });
    }
    
    const novelId = chapterResult[0].novel_id;
    
    // 如果是回复，需要从父评论获取novel_id和chapter_id
    if (parentId) {
      const getParentQuery = `SELECT novel_id, chapter_id FROM paragraph_comment WHERE id = ?`;
      db.query(getParentQuery, [parentId], (err, parentResult) => {
        if (err) {
          console.error('获取父评论信息失败:', err);
          return res.status(500).json({ message: '获取父评论信息失败' });
        }
        
        if (parentResult.length === 0) {
          return res.status(404).json({ message: '父评论不存在' });
        }
        
        const parentNovelId = parentResult[0].novel_id || novelId;
        const parentChapterId = parentResult[0].chapter_id || chapterId;
        
        const insertQuery = `
          INSERT INTO paragraph_comment (chapter_id, paragraph_index, novel_id, user_id, content, parent_id)
          VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        db.query(insertQuery, [parentChapterId, paragraphIndex, parentNovelId, userId, content, parentId], (err, result) => {
          if (err) {
            console.error('添加段落评论失败:', err);
            return res.status(500).json({ message: '添加段落评论失败' });
          }
          
          res.json({
            success: true,
            data: {
              id: result.insertId,
              message: '评论添加成功'
            }
          });
        });
      });
    } else {
      // 主评论，直接使用获取到的novel_id
      const insertQuery = `
        INSERT INTO paragraph_comment (chapter_id, paragraph_index, novel_id, user_id, content, parent_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      db.query(insertQuery, [chapterId, paragraphIndex, novelId, userId, content, null], (err, result) => {
        if (err) {
          console.error('添加段落评论失败:', err);
          return res.status(500).json({ message: '添加段落评论失败' });
        }
        
        res.json({
          success: true,
          data: {
            id: result.insertId,
            message: '评论添加成功'
          }
        });
      });
    }
  });
});

// 点赞/点踩评论
app.post('/api/paragraph-comment/:commentId/like', (req, res) => {
  const { commentId } = req.params;
  const { userId, isLike } = req.body; // isLike: 1=点赞, 0=点踩
  
  if (!userId || isLike === undefined) {
    return res.status(400).json({ message: '用户ID和点赞状态不能为空' });
  }
  
  // 检查是否已经点赞/点踩过
  const checkQuery = `
    SELECT id, is_like FROM paragraph_comment_like 
    WHERE comment_id = ? AND user_id = ?
  `;
  
  db.query(checkQuery, [commentId, userId], (err, existing) => {
    if (err) {
      console.error('检查点赞状态失败:', err);
      return res.status(500).json({ message: '检查点赞状态失败' });
    }
    
    if (existing.length > 0) {
      // 如果已经点赞/点踩过，更新状态
      const updateQuery = `
        UPDATE paragraph_comment_like SET is_like = ? WHERE id = ?
      `;
      
      db.query(updateQuery, [isLike, existing[0].id], (err) => {
        if (err) {
          console.error('更新点赞状态失败:', err);
          return res.status(500).json({ message: '更新点赞状态失败' });
        }
        updateCommentCounts(commentId, res);
      });
    } else {
      // 新增点赞/点踩记录
      const insertQuery = `
        INSERT INTO paragraph_comment_like (comment_id, user_id, is_like)
        VALUES (?, ?, ?)
      `;
      
      db.query(insertQuery, [commentId, userId, isLike], (err) => {
        if (err) {
          console.error('添加点赞记录失败:', err);
          return res.status(500).json({ message: '添加点赞记录失败' });
        }
        updateCommentCounts(commentId, res);
      });
    }
  });
});

// 更新评论的点赞/点踩数量
function updateCommentCounts(commentId, res) {
  const countQuery = `
    SELECT 
      SUM(CASE WHEN is_like = 1 THEN 1 ELSE 0 END) as like_count,
      SUM(CASE WHEN is_like = 0 THEN 1 ELSE 0 END) as dislike_count
    FROM paragraph_comment_like 
    WHERE comment_id = ?
  `;
  
  db.query(countQuery, [commentId], (err, counts) => {
    if (err) {
      console.error('获取点赞数量失败:', err);
      return res.status(500).json({ message: '获取点赞数量失败' });
    }
    
    const updateQuery = `
      UPDATE paragraph_comment 
      SET like_count = ?, dislike_count = ? 
      WHERE id = ?
    `;
    
    db.query(updateQuery, [counts[0].like_count || 0, counts[0].dislike_count || 0, commentId], (err) => {
      if (err) {
        console.error('更新评论数量失败:', err);
        return res.status(500).json({ message: '更新评论数量失败' });
      }
      
      res.json({
        success: true,
        data: {
          like_count: counts[0].like_count || 0,
          dislike_count: counts[0].dislike_count || 0
        }
      });
    });
  });
}

// 获取段落评论的回复
app.get('/api/paragraph-comment/:commentId/replies', (req, res) => {
  const { commentId } = req.params;
  
  const query = `
    SELECT 
      pc.id,
      pc.content,
      pc.created_at,
      COALESCE(pc.like_count, 0) as like_count,
      COALESCE(pc.dislike_count, 0) as dislike_count,
      pc.parent_id,
      pc.user_id,
      u.username,
      u.pen_name,
      u.is_author,
      u.avatar
    FROM paragraph_comment pc
    JOIN user u ON pc.user_id = u.id
    WHERE pc.parent_id = ? AND pc.is_deleted = 0
    ORDER BY pc.created_at ASC
  `;
  
  db.query(query, [commentId], (err, replies) => {
    if (err) {
      console.error('获取回复失败:', err);
      return res.status(500).json({ message: '获取回复失败' });
    }
    
    res.json({
      success: true,
      data: replies
    });
  });
});

// 回复段落评论（通过commentId，不需要chapterId和paragraphIndex）
app.post('/api/paragraph-comment/:commentId/reply', (req, res) => {
  const { commentId } = req.params;
  const { content, userId, parentId } = req.body;
  
  if (!content || !userId) {
    return res.status(400).json({ message: '评论内容和用户ID不能为空' });
  }
  
  // 从父评论获取chapter_id, paragraph_index和novel_id
  const getParentQuery = `SELECT chapter_id, paragraph_index, novel_id FROM paragraph_comment WHERE id = ?`;
  
  db.query(getParentQuery, [parentId || commentId], (err, parentResult) => {
    if (err) {
      console.error('获取父评论信息失败:', err);
      return res.status(500).json({ message: '获取父评论信息失败' });
    }
    
    if (parentResult.length === 0) {
      return res.status(404).json({ message: '父评论不存在' });
    }
    
    const chapterId = parentResult[0].chapter_id;
    const paragraphIndex = parentResult[0].paragraph_index;
    const novelId = parentResult[0].novel_id;
    const actualParentId = parentId || commentId;
    
    const insertQuery = `
      INSERT INTO paragraph_comment (chapter_id, paragraph_index, novel_id, user_id, content, parent_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    db.query(insertQuery, [chapterId, paragraphIndex, novelId, userId, content, actualParentId], (err, result) => {
      if (err) {
        console.error('添加段落评论回复失败:', err);
        return res.status(500).json({ message: '添加段落评论回复失败' });
      }
      
      res.json({
        success: true,
        data: {
          id: result.insertId,
          message: '回复添加成功'
        }
      });
    });
  });
});

// 更新段落评论
app.put('/api/paragraph-comment/:commentId', authenticateToken, (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Please login first' });
  }

  if (!content || content.trim().length < 10) {
    return res.status(400).json({ message: '评论内容至少需要10个字符' });
  }

  // 先检查评论是否存在且属于当前用户
  db.query('SELECT user_id FROM paragraph_comment WHERE id = ?', [commentId], (err, comment) => {
    if (err) {
      console.error('查询评论失败:', err);
      return res.status(500).json({ message: '查询评论失败' });
    }

    if (comment.length === 0) {
      return res.status(404).json({ message: '评论不存在' });
    }

    if (comment[0].user_id !== userId) {
      return res.status(403).json({ message: '无权修改此评论' });
    }

    // 更新评论内容
    db.query('UPDATE paragraph_comment SET content = ? WHERE id = ?', [content.trim(), commentId], (err2) => {
      if (err2) {
        console.error('更新评论失败:', err2);
        return res.status(500).json({ message: '更新评论失败' });
      }

      res.json({
        success: true,
        message: '评论更新成功'
      });
    });
  });
});

// ==================== 举报API ====================

// 提交举报
app.post('/api/report', authenticateToken, (req, res) => {
  const { type, remark_id, report } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Please login first' });
  }

  // 验证参数
  if (!type || !remark_id || !report) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  // 验证type值
  const validTypes = ['review', 'comment', 'paragraph_comment'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ success: false, message: 'Invalid type' });
  }

  // 验证report值
  const validReports = [
    'Spoilers',
    'Abuse or harassment',
    'Spam',
    'Copyright infringement',
    'Discrimination (racism, sexism, etc.)',
    'Request to delete a comment that you created'
  ];
  if (!validReports.includes(report)) {
    return res.status(400).json({ success: false, message: 'Invalid report reason' });
  }

  // 验证被举报的内容是否存在
  let checkQuery = '';
  if (type === 'review') {
    checkQuery = 'SELECT id FROM review WHERE id = ?';
  } else if (type === 'comment') {
    checkQuery = 'SELECT id FROM comment WHERE id = ?';
  } else if (type === 'paragraph_comment') {
    checkQuery = 'SELECT id FROM paragraph_comment WHERE id = ?';
  }

  db.query(checkQuery, [remark_id], (err, results) => {
    if (err) {
      console.error('检查被举报内容失败:', err);
      return res.status(500).json({ success: false, message: 'Failed to check reported content' });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Reported content not found' });
    }

    // 插入举报记录
    const insertQuery = `
      INSERT INTO report (user_id, type, remark_id, report, created_at)
      VALUES (?, ?, ?, ?, NOW())
    `;

    db.query(insertQuery, [userId, type, remark_id, report], (err2, result) => {
      if (err2) {
        console.error('提交举报失败:', err2);
        return res.status(500).json({ success: false, message: 'Failed to submit report' });
      }

      res.json({
        success: true,
        message: 'Report submitted successfully',
        data: {
          id: result.insertId
        }
      });
    });
  });
});

// ==================== 章节展示API ====================

// Volume-Chapter mapping refactor (2025-12-02):
// - All JOINs now use c.volume_id = v.id AND v.novel_id = c.novel_id
// - Affected endpoints: /api/novel/:novelId/volumes, /api/volume/:volumeId/chapters, /api/chapter/:chapterId
// - Mapping rule: chapter.volume_id = volume.id (same novel_id)

// 获取小说的卷和章节信息
app.get('/api/novel/:novelId/volumes', async (req, res) => {
  const startedAt = Date.now();
  const tag = 'novel.volumes';

  const rawId = req.params && req.params.novelId;
  const novelId = Number.parseInt(String(rawId), 10);
  if (!Number.isFinite(novelId) || novelId <= 0) {
    console.info('[API] done:', { tag, ms: Date.now() - startedAt, ok: false, code: 'BAD_ID' });
    return res.status(400).json({ message: 'Invalid novel id' });
  }

  const sort = String((req.query && req.query.sort) || 'newest');
  const orderBy = sort === 'oldest' ? 'v.volume_id ASC' : 'v.volume_id DESC';

  console.info('[API] start:', { tag });

  // Volume-Chapter mapping updated: chapter.volume_id = volume.id AND same novel_id
  const volumesQuery = `
    SELECT
      v.id,
      v.volume_id,
      v.title,
      v.start_chapter,
      v.end_chapter,
      v.chapter_count,
      COUNT(c.id) as actual_chapter_count,
      MAX(c.created_at) as latest_chapter_date
    FROM volume v
    LEFT JOIN chapter c ON c.volume_id = v.id
      AND c.novel_id = v.novel_id
      AND c.review_status = 'approved'
    WHERE v.novel_id = ?
    GROUP BY v.id, v.volume_id, v.title, v.start_chapter, v.end_chapter, v.chapter_count
    ORDER BY ${orderBy}
  `;

  const latestChapterQuery = `
    SELECT
      c.id,
      c.chapter_number,
      c.title,
      c.created_at,
      v.volume_id
    FROM chapter c
    JOIN volume v ON c.volume_id = v.id
      AND v.novel_id = c.novel_id
    WHERE c.novel_id = ? AND c.review_status = 'approved'
    ORDER BY c.created_at DESC
    LIMIT 1
  `;

  try {
    const [[volumes], [latestChapter]] = await Promise.all([
      Db.query(volumesQuery, [novelId], { tag: 'novel.volumes.list', idempotent: true }),
      Db.query(latestChapterQuery, [novelId], { tag: 'novel.volumes.latestChapter', idempotent: true }),
    ]);

    console.info('[API] done:', { tag, ms: Date.now() - startedAt, ok: true });
    return res.json({
      success: true,
      data: {
        volumes: Array.isArray(volumes) ? volumes : [],
        latest_chapter: (Array.isArray(latestChapter) && latestChapter[0]) ? latestChapter[0] : null,
        total_volumes: Array.isArray(volumes) ? volumes.length : 0,
      },
    });
  } catch (err) {
    console.error('[API] failed:', {
      tag,
      ms: Date.now() - startedAt,
      code: err && err.code,
      fatal: !!(err && err.fatal),
    });
    return res.status(500).json({ message: '获取卷信息失败' });
  }
});

// 获取指定卷的章节列表
app.get('/api/volume/:volumeId/chapters', async (req, res) => {
  const volumeId = parseInt(req.params.volumeId, 10);
  const { sort = 'chapter_number' } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const userId = req.query.userId ? parseInt(req.query.userId, 10) : null;

  const offset = (page - 1) * limit;
  
  // 确保 offset 是整数
  const offsetNum = parseInt(offset) || 0;

  try {
    // 获取卷信息（包含 novel_id）
    const [volumeInfo] = await Db.query(
      `SELECT v.*, n.title as novel_title, v.novel_id
       FROM volume v
       JOIN novel n ON v.novel_id = n.id
       WHERE v.id = ?`,
      [volumeId],
      { tag: 'volumeChapters.volumeInfo', idempotent: true }
    );

    if (volumeInfo.length === 0) {
      return res.status(404).json({ message: '卷不存在' });
    }

    const novelId = volumeInfo[0].novel_id;

    // 调用 championService 获取可见性信息
    const ChampionService = require('./services/championService');
    const championService = new ChampionService();
    const visibility = await championService.getUserChapterVisibility(Db.getPool(), novelId, userId);

    // 获取章节列表
    let orderBy = 'c.chapter_number ASC';
    if (sort === 'newest') {
      orderBy = 'c.created_at DESC';
    } else if (sort === 'oldest') {
      orderBy = 'c.created_at ASC';
    }

    // 构建可见性过滤条件
    let visibilityCondition = 'c.is_released = 1 AND c.review_status = \'approved\'';
    const queryParams = [volumeId];

    if (!visibility.championEnabled || !visibility.isChampion) {
      // 未启用 Champion 或非 Champion 用户：只显示 is_advance=0 的章节
      visibilityCondition += ' AND c.is_advance = 0';
    } else {
      // Champion 用户：显示 chapter_number <= visibleMaxChapterNumber 的章节
      visibilityCondition += ' AND c.chapter_number <= ?';
      queryParams.push(visibility.visibleMaxChapterNumber);
    }

    // Volume-Chapter mapping updated: chapter.volume_id = volume.id AND same novel_id
    // LIMIT 和 OFFSET 需要直接插入数值，不能使用占位符
    const chaptersQuery = `
      SELECT 
        c.id,
        c.chapter_number,
        c.title,
        c.created_at,
        c.is_advance,
        c.unlock_price,
        CASE 
          WHEN c.unlock_price > 0 THEN 'locked'
          WHEN c.is_advance = 1 THEN 'advance'
          ELSE 'free'
        END as access_status
      FROM chapter c
      JOIN volume v ON c.volume_id = v.id
        AND v.novel_id = c.novel_id
      WHERE v.id = ? AND ${visibilityCondition}
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${offsetNum}
    `;

    const [chapters] = await Db.query(chaptersQuery, queryParams, { tag: 'volumeChapters.chapters', idempotent: true });

    // 获取章节总数（使用相同的可见性条件）
    const totalQuery = `
      SELECT COUNT(*) as total
      FROM chapter c
      JOIN volume v ON c.volume_id = v.id
        AND v.novel_id = c.novel_id
      WHERE v.id = ? AND ${visibilityCondition}
    `;

    const totalParams = [volumeId];
    if (visibility.championEnabled && visibility.isChampion) {
      totalParams.push(visibility.visibleMaxChapterNumber);
    }

    const [totalResult] = await Db.query(totalQuery, totalParams, { tag: 'volumeChapters.total', idempotent: true });

    res.json({
      success: true,
      data: {
        volume: volumeInfo[0],
        chapters,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalResult[0].total,
          pages: Math.ceil(totalResult[0].total / limit)
        }
      }
    });
  } catch (error) {
    console.error('获取卷章节列表失败:', { code: error && error.code, fatal: !!(error && error.fatal) });
    res.status(500).json({ message: '获取卷章节列表失败', error: error.message });
  }
});

// 导入定时发布服务
const scheduledReleaseService = require('./services/scheduledReleaseService');

// 启动定时发布任务（每小时整点执行）
scheduledReleaseService.startScheduledReleaseTask();

// 导入作品数据统计服务
const novelAnalyticsService = require('./services/novelAnalyticsService');

// 启动每日统计定时任务（每天凌晨3点执行）
novelAnalyticsService.startDailyStatsTask();

app.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
}); 