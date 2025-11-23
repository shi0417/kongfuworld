const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const Decimal = require('decimal.js');
const PayPalService = require('../services/paypalService');
const AlipayService = require('../services/alipayService');
const router = express.Router();

// 初始化PayPal服务
const paypalService = new PayPalService();

// 初始化支付宝服务
const alipayService = new AlipayService();

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

// JWT验证中间件（管理员）
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ success: false, message: '请先登录' });
  }

  jwt.verify(token, 'admin-secret-key', (err, admin) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Token无效或已过期' });
    }
    req.admin = admin;
    next();
  });
};

// 管理员登录
router.post('/login', async (req, res) => {
  let db;
  try {
    const { name, password } = req.body;
    
    if (!name || !password) {
      return res.status(400).json({
        success: false,
        message: '请输入用户名和密码'
      });
    }

    db = await mysql.createConnection(dbConfig);
    
    // 查询管理员
    const [admins] = await db.execute(
      'SELECT * FROM admin WHERE name = ?',
      [name]
    );

    if (admins.length === 0) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    const admin = admins[0];
    
    // 验证密码（这里使用明文比较，实际应该使用哈希）
    if (admin.password !== password) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    // 生成JWT token
    const token = jwt.sign(
      { adminId: admin.id, name: admin.name, level: admin.level },
      'admin-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: '登录成功',
      data: {
        id: admin.id,
        name: admin.name,
        level: admin.level,
        token: token
      }
    });

  } catch (error) {
    console.error('管理员登录错误:', error);
    res.status(500).json({
      success: false,
      message: '登录失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取待审批的小说列表
router.get('/pending-novels', authenticateAdmin, async (req, res) => {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    // 查询待审批的小说（created, submitted, reviewing状态）
    const [novels] = await db.execute(
      `SELECT n.*, u.username as author_name, u.pen_name
       FROM novel n
       LEFT JOIN user u ON (n.author = u.pen_name OR n.author = u.username)
       WHERE n.review_status IN ('created', 'submitted', 'reviewing')
       ORDER BY n.id DESC`
    );

    res.json({
      success: true,
      data: novels
    });

  } catch (error) {
    console.error('获取待审批小说列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取列表失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 审批小说（批准或拒绝）
router.post('/review-novel', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { novelId, action, reason } = req.body; // action: 'approve' 或 'reject'
    
    if (!novelId || !action) {
      return res.status(400).json({
        success: false,
        message: '参数不完整'
      });
    }

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: '操作类型无效'
      });
    }

    db = await mysql.createConnection(dbConfig);
    
    // 审批通过设置为 approved，拒绝设置为 locked（违规锁定）
    const status = action === 'approve' ? 'approved' : 'locked';
    
    // 更新小说状态
    await db.execute(
      'UPDATE novel SET review_status = ? WHERE id = ?',
      [status, novelId]
    );

    res.json({
      success: true,
      message: action === 'approve' ? '已批准' : '已锁定',
      data: {
        novelId,
        status
      }
    });

  } catch (error) {
    console.error('审批小说错误:', error);
    res.status(500).json({
      success: false,
      message: '操作失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取所有小说列表（带筛选）
router.get('/novels', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    db = await mysql.createConnection(dbConfig);
    
    let query = `SELECT n.*, u.username as author_name, u.pen_name
                 FROM novel n
                 LEFT JOIN user u ON (n.author = u.pen_name OR n.author = u.username)`;
    const params = [];
    
    if (status) {
      query += ' WHERE n.review_status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY n.id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
    
    const [novels] = await db.execute(query, params);
    
    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM novel';
    const countParams = [];
    if (status) {
      countQuery += ' WHERE review_status = ?';
      countParams.push(status);
    }
    const [countResult] = await db.execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: novels,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('获取小说列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取列表失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取小说详情
router.get('/novel/:id', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { id } = req.params;
    
    db = await mysql.createConnection(dbConfig);
    
    const [novels] = await db.execute(
      `SELECT n.*, u.username as author_name, u.pen_name, u.email as author_email
       FROM novel n
       LEFT JOIN user u ON (n.author = u.pen_name OR n.author = u.username)
       WHERE n.id = ?`,
      [id]
    );

    if (novels.length === 0) {
      return res.status(404).json({
        success: false,
        message: '小说不存在'
      });
    }

    res.json({
      success: true,
      data: novels[0]
    });

  } catch (error) {
    console.error('获取小说详情错误:', error);
    res.status(500).json({
      success: false,
      message: '获取详情失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取费用统计汇总（新版本：基于订阅和Karma购买）
router.get('/payments/summary', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { start_date, end_date, payment_method, payment_status, user_id } = req.query;
    
    db = await mysql.createConnection(dbConfig);
    
    // 1. 订阅收入统计
    const subscriptionParams = [];
    let subscriptionQuery = `
      SELECT 
        COALESCE(SUM(ucsr.payment_amount), 0) as subscription_income,
        COUNT(*) as subscription_count
      FROM user_champion_subscription_record ucsr
      WHERE ucsr.payment_status = 'completed'
    `;
    if (start_date) {
      subscriptionQuery += ' AND ucsr.created_at >= ?';
      subscriptionParams.push(start_date);
    }
    if (end_date) {
      subscriptionQuery += ' AND ucsr.created_at <= ?';
      subscriptionParams.push(end_date + ' 23:59:59');
    }
    if (payment_method) {
      const methods = payment_method.split(',');
      subscriptionQuery += ` AND ucsr.payment_method IN (${methods.map(() => '?').join(',')})`;
      subscriptionParams.push(...methods);
    }
    if (user_id) {
      subscriptionQuery += ' AND ucsr.user_id = ?';
      subscriptionParams.push(user_id);
    }
    
    const [subscriptionStats] = await db.execute(subscriptionQuery, subscriptionParams);
    
    // 2. Karma购买收入统计
    const karmaParams = [];
    let karmaQuery = `
      SELECT 
        COALESCE(SUM(ukt.amount_paid), 0) as karma_income,
        COUNT(*) as karma_count
      FROM user_karma_transactions ukt
      WHERE ukt.transaction_type = 'purchase'
        AND ukt.status = 'completed'
    `;
    if (start_date) {
      karmaQuery += ' AND ukt.created_at >= ?';
      karmaParams.push(start_date);
    }
    if (end_date) {
      karmaQuery += ' AND ukt.created_at <= ?';
      karmaParams.push(end_date + ' 23:59:59');
    }
    if (payment_method) {
      const methods = payment_method.split(',');
      karmaQuery += ` AND ukt.payment_method IN (${methods.map(() => '?').join(',')})`;
      karmaParams.push(...methods);
    }
    if (user_id) {
      karmaQuery += ' AND ukt.user_id = ?';
      karmaParams.push(user_id);
    }
    
    const [karmaStats] = await db.execute(karmaQuery, karmaParams);
    
    // 3. 付费用户数（去重）
    const paidUsersParams = [];
    let paidUsersQuery = `
      SELECT COUNT(DISTINCT user_id) as paid_user_count
      FROM (
        SELECT ucsr.user_id
        FROM user_champion_subscription_record ucsr
        WHERE ucsr.payment_status = 'completed'
    `;
    if (start_date) {
      paidUsersQuery += ' AND ucsr.created_at >= ?';
      paidUsersParams.push(start_date);
    }
    if (end_date) {
      paidUsersQuery += ' AND ucsr.created_at <= ?';
      paidUsersParams.push(end_date + ' 23:59:59');
    }
    if (payment_method) {
      const methods = payment_method.split(',');
      paidUsersQuery += ` AND ucsr.payment_method IN (${methods.map(() => '?').join(',')})`;
      paidUsersParams.push(...methods);
    }
    if (user_id) {
      paidUsersQuery += ' AND ucsr.user_id = ?';
      paidUsersParams.push(user_id);
    }
    paidUsersQuery += `
        UNION
        SELECT ukt.user_id
        FROM user_karma_transactions ukt
        WHERE ukt.transaction_type = 'purchase'
          AND ukt.status = 'completed'
    `;
    if (start_date) {
      paidUsersQuery += ' AND ukt.created_at >= ?';
      paidUsersParams.push(start_date);
    }
    if (end_date) {
      paidUsersQuery += ' AND ukt.created_at <= ?';
      paidUsersParams.push(end_date + ' 23:59:59');
    }
    if (payment_method) {
      const methods = payment_method.split(',');
      paidUsersQuery += ` AND ukt.payment_method IN (${methods.map(() => '?').join(',')})`;
      paidUsersParams.push(...methods);
    }
    if (user_id) {
      paidUsersQuery += ' AND ukt.user_id = ?';
      paidUsersParams.push(user_id);
    }
    paidUsersQuery += ') as combined_users';
    
    const [paidUsersStats] = await db.execute(paidUsersQuery, paidUsersParams);
    
    // 4. 今日统计
    const today = new Date().toISOString().split('T')[0];
    const [todaySubscription] = await db.execute(
      `SELECT 
        COALESCE(SUM(payment_amount), 0) as income,
        COUNT(*) as count
      FROM user_champion_subscription_record
      WHERE payment_status = 'completed' AND DATE(created_at) = ?`,
      [today]
    );
    const [todayKarma] = await db.execute(
      `SELECT 
        COALESCE(SUM(amount_paid), 0) as income,
        COUNT(*) as count
      FROM user_karma_transactions
      WHERE transaction_type = 'purchase' AND status = 'completed' AND DATE(created_at) = ?`,
      [today]
    );
    
    // 5. 本月统计
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const [monthlySubscription] = await db.execute(
      `SELECT 
        COALESCE(SUM(payment_amount), 0) as income,
        COUNT(*) as count
      FROM user_champion_subscription_record
      WHERE payment_status = 'completed' AND created_at >= ?`,
      [monthStart]
    );
    const [monthlyKarma] = await db.execute(
      `SELECT 
        COALESCE(SUM(amount_paid), 0) as income,
        COUNT(*) as count
      FROM user_karma_transactions
      WHERE transaction_type = 'purchase' AND status = 'completed' AND created_at >= ?`,
      [monthStart]
    );
    
    const subscriptionIncome = parseFloat(subscriptionStats[0].subscription_income || 0);
    const karmaIncome = parseFloat(karmaStats[0].karma_income || 0);
    const totalIncome = subscriptionIncome + karmaIncome;
    const paidUserCount = parseInt(paidUsersStats[0].paid_user_count || 0);
    const arppu = paidUserCount > 0 ? totalIncome / paidUserCount : 0;
    
    res.json({
      success: true,
      data: {
        totalIncome: totalIncome,
        subscriptionIncome: subscriptionIncome,
        karmaIncome: karmaIncome,
        paidUserCount: paidUserCount,
        arppu: arppu,
        todayIncome: parseFloat(todaySubscription[0].income || 0) + parseFloat(todayKarma[0].income || 0),
        todayTransactions: parseInt(todaySubscription[0].count || 0) + parseInt(todayKarma[0].count || 0),
        monthlyIncome: parseFloat(monthlySubscription[0].income || 0) + parseFloat(monthlyKarma[0].income || 0),
        monthlyTransactions: parseInt(monthlySubscription[0].count || 0) + parseInt(monthlyKarma[0].count || 0),
        totalTransactions: parseInt(subscriptionStats[0].subscription_count || 0) + parseInt(karmaStats[0].karma_count || 0)
      }
    });

  } catch (error) {
    console.error('获取费用统计汇总错误:', error);
    res.status(500).json({
      success: false,
      message: '获取统计失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取订阅收入明细
router.get('/subscriptions', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { start_date, end_date, payment_method, payment_status, user_id, novel_id, page = 1, page_size = 20 } = req.query;
    
    db = await mysql.createConnection(dbConfig);
    
    // 构建筛选条件
    const conditions = [];
    const params = [];
    
    if (start_date) {
      conditions.push('ucsr.created_at >= ?');
      params.push(start_date);
    }
    if (end_date) {
      conditions.push('ucsr.created_at <= ?');
      params.push(end_date + ' 23:59:59');
    }
    if (payment_method) {
      const methods = payment_method.split(',');
      conditions.push(`ucsr.payment_method IN (${methods.map(() => '?').join(',')})`);
      params.push(...methods);
    }
    if (payment_status) {
      conditions.push('ucsr.payment_status = ?');
      params.push(payment_status);
    }
    if (user_id) {
      conditions.push('ucsr.user_id = ?');
      params.push(user_id);
    }
    if (novel_id) {
      conditions.push('ucsr.novel_id = ?');
      params.push(novel_id);
    }
    
    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    
    // 获取总数
    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM user_champion_subscription_record ucsr ${whereClause}`,
      params
    );
    const total = parseInt(countResult[0].total || 0);
    
    // 获取明细（带分页）
    const pageSizeInt = parseInt(page_size) || 20;
    const pageInt = parseInt(page) || 1;
    const offset = (pageInt - 1) * pageSizeInt;
    const [records] = await db.execute(
      `SELECT 
        ucsr.*,
        u.username,
        u.pen_name,
        n.title as novel_title
      FROM user_champion_subscription_record ucsr
      LEFT JOIN user u ON ucsr.user_id = u.id
      LEFT JOIN novel n ON ucsr.novel_id = n.id
      ${whereClause}
      ORDER BY ucsr.created_at DESC
      LIMIT ${pageSizeInt} OFFSET ${offset}`,
      params
    );
    
    res.json({
      success: true,
      data: {
        total: total,
        page: parseInt(page),
        page_size: parseInt(page_size),
        items: records.map(item => ({
          id: item.id,
          user_id: item.user_id,
          user_name: item.username || item.pen_name || `用户${item.user_id}`,
          novel_id: item.novel_id,
          novel_title: item.novel_title || '未知',
          tier_level: item.tier_level,
          tier_name: item.tier_name,
          monthly_price: parseFloat(item.monthly_price || 0),
          payment_amount: parseFloat(item.payment_amount || 0),
          payment_method: item.payment_method,
          payment_status: item.payment_status,
          subscription_type: item.subscription_type,
          subscription_duration_months: item.subscription_duration_months,
          start_date: item.start_date,
          end_date: item.end_date,
          auto_renew: item.auto_renew === 1,
          currency: item.currency,
          local_amount: item.local_amount ? parseFloat(item.local_amount) : null,
          local_currency: item.local_currency,
          exchange_rate: item.exchange_rate ? parseFloat(item.exchange_rate) : null,
          discount_amount: item.discount_amount ? parseFloat(item.discount_amount) : 0,
          discount_code: item.discount_code,
          tax_amount: item.tax_amount ? parseFloat(item.tax_amount) : 0,
          fee_amount: item.fee_amount ? parseFloat(item.fee_amount) : 0,
          refund_amount: item.refund_amount ? parseFloat(item.refund_amount) : 0,
          refund_reason: item.refund_reason,
          refund_date: item.refund_date,
          stripe_payment_intent_id: item.stripe_payment_intent_id,
          paypal_order_id: item.paypal_order_id,
          stripe_customer_id: item.stripe_customer_id,
          paypal_payer_id: item.paypal_payer_id,
          card_brand: item.card_brand,
          card_last4: item.card_last4,
          card_exp_month: item.card_exp_month,
          card_exp_year: item.card_exp_year,
          ip_address: item.ip_address,
          user_agent: item.user_agent,
          notes: item.notes,
          created_at: item.created_at,
          updated_at: item.updated_at
        }))
      }
    });

  } catch (error) {
    console.error('获取订阅收入明细错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取Karma购买明细
router.get('/karma-purchases', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { start_date, end_date, payment_method, status, user_id, page = 1, page_size = 20 } = req.query;
    
    db = await mysql.createConnection(dbConfig);
    
    // 构建筛选条件
    const conditions = ['ukt.transaction_type = ?'];
    const params = ['purchase'];
    
    if (start_date) {
      conditions.push('ukt.created_at >= ?');
      params.push(start_date);
    }
    if (end_date) {
      conditions.push('ukt.created_at <= ?');
      params.push(end_date + ' 23:59:59');
    }
    if (payment_method) {
      const methods = payment_method.split(',');
      conditions.push(`ukt.payment_method IN (${methods.map(() => '?').join(',')})`);
      params.push(...methods);
    }
    if (status) {
      conditions.push('ukt.status = ?');
      params.push(status);
    }
    if (user_id) {
      conditions.push('ukt.user_id = ?');
      params.push(user_id);
    }
    
    const whereClause = 'WHERE ' + conditions.join(' AND ');
    
    // 获取总数
    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM user_karma_transactions ukt ${whereClause}`,
      params
    );
    const total = parseInt(countResult[0].total || 0);
    
    // 获取明细（带分页）
    const pageSizeInt = parseInt(page_size) || 20;
    const pageInt = parseInt(page) || 1;
    const offset = (pageInt - 1) * pageSizeInt;
    const [records] = await db.execute(
      `SELECT 
        ukt.*,
        u.username,
        u.pen_name
      FROM user_karma_transactions ukt
      LEFT JOIN user u ON ukt.user_id = u.id
      ${whereClause}
      ORDER BY ukt.created_at DESC
      LIMIT ${pageSizeInt} OFFSET ${offset}`,
      params
    );
    
    res.json({
      success: true,
      data: {
        total: total,
        page: parseInt(page),
        page_size: parseInt(page_size),
        items: records.map(item => ({
          id: item.id,
          user_id: item.user_id,
          user_name: item.username || item.pen_name || `用户${item.user_id}`,
          transaction_type: item.transaction_type,
          karma_amount: item.karma_amount,
          karma_type: item.karma_type,
          payment_method: item.payment_method,
          payment_record_id: item.payment_record_id,
          novel_id: item.novel_id,
          chapter_id: item.chapter_id,
          description: item.description,
          reason: item.reason,
          balance_before: item.balance_before,
          balance_after: item.balance_after,
          status: item.status,
          transaction_id: item.transaction_id,
          stripe_payment_intent_id: item.stripe_payment_intent_id,
          paypal_order_id: item.paypal_order_id,
          currency: item.currency,
          amount_paid: item.amount_paid ? parseFloat(item.amount_paid) : 0,
          amount: item.amount ? parseFloat(item.amount) : 0,
          created_at: item.created_at,
          updated_at: item.updated_at
        }))
      }
    });

  } catch (error) {
    console.error('获取Karma购买明细错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取作者收入统计
router.get('/author-income-stats', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { month, userId } = req.query; // month格式：2025-10
    
    if (!month) {
      return res.status(400).json({
        success: false,
        message: '请指定月份'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    // 解析月份
    const monthStart = `${month}-01`;
    const nextMonth = new Date(new Date(monthStart).setMonth(new Date(monthStart).getMonth() + 1));
    const monthEnd = nextMonth.toISOString().split('T')[0];
    
    // 1. 获取作者基础收入（从 author_royalty 表）
    let baseIncomeQuery = `
      SELECT 
        ar.author_id,
        u.username as author_name,
        u.pen_name,
        COALESCE(SUM(ar.author_amount_usd), 0) as base_income_usd
      FROM author_royalty ar
      LEFT JOIN user u ON ar.author_id = u.id
      WHERE ar.settlement_month = ?
    `;
    
    const baseIncomeParams = [monthStart];
    
    if (userId) {
      baseIncomeQuery += ' AND ar.author_id = ?';
      baseIncomeParams.push(userId);
    }
    
    baseIncomeQuery += ' GROUP BY ar.author_id, u.username, u.pen_name';
    
    const [baseIncomeStats] = await db.execute(baseIncomeQuery, baseIncomeParams);
    
    // 2. 获取作者推广收入（从 commission_transaction 表，按推广人汇总）
    let referralIncomeQuery = `
      SELECT 
        ct.user_id as author_id,
        u.username as author_name,
        u.pen_name,
        COALESCE(SUM(ct.commission_amount_usd), 0) as referral_income_usd
      FROM commission_transaction ct
      LEFT JOIN user u ON ct.user_id = u.id
      WHERE ct.commission_type = 'author_referral'
        AND ct.settlement_month = ?
    `;
    
    const referralIncomeParams = [monthStart];
    
    if (userId) {
      referralIncomeQuery += ' AND ct.user_id = ?';
      referralIncomeParams.push(userId);
    }
    
    referralIncomeQuery += ' GROUP BY ct.user_id, u.username, u.pen_name';
    
    const [referralIncomeStats] = await db.execute(referralIncomeQuery, referralIncomeParams);
    
    // 3. 合并两个结果集
    const incomeMap = new Map();
    
    // 先添加基础收入
    baseIncomeStats.forEach(item => {
      incomeMap.set(item.author_id, {
        author_id: item.author_id,
        author_name: item.author_name,
        pen_name: item.pen_name,
        base_income_usd: parseFloat(item.base_income_usd || 0),
        referral_income_usd: 0,
        total_income_usd: parseFloat(item.base_income_usd || 0)
      });
    });
    
    // 再添加推广收入（如果作者已有基础收入记录，则累加；如果没有，则新建）
    referralIncomeStats.forEach(item => {
      const authorId = item.author_id;
      if (incomeMap.has(authorId)) {
        const existing = incomeMap.get(authorId);
        existing.referral_income_usd = parseFloat(item.referral_income_usd || 0);
        existing.total_income_usd = existing.base_income_usd + existing.referral_income_usd;
      } else {
        incomeMap.set(authorId, {
          author_id: authorId,
          author_name: item.author_name,
          pen_name: item.pen_name,
          base_income_usd: 0,
          referral_income_usd: parseFloat(item.referral_income_usd || 0),
          total_income_usd: parseFloat(item.referral_income_usd || 0)
        });
      }
    });
    
    // 4. 为每个作者计算推广收入的详细计算方法
    const statsWithCalculation = await Promise.all(
      Array.from(incomeMap.values()).map(async (item) => {
        // 只对有推广收入的作者计算详细方法
        if (item.referral_income_usd <= 0) {
          return {
            ...item,
            calculationMethod: '暂无推广收入'
          };
        }
        
        // 获取该作者作为推广人的所有作者推广佣金明细，按层级和被推广作者分组
        const [calculationDetails] = await db.execute(
          `SELECT 
            ct.level,
            ct.source_author_id,
            u2.username as source_author_username,
            u2.pen_name as source_author_pen_name,
            cpl.percent,
            ct.plan_id
          FROM commission_transaction ct
          LEFT JOIN user u2 ON ct.source_author_id = u2.id
          LEFT JOIN commission_plan_level cpl ON ct.plan_id = cpl.plan_id AND ct.level = cpl.level
          WHERE ct.commission_type = 'author_referral'
            AND ct.settlement_month = ?
            AND ct.user_id = ?
          GROUP BY ct.level, ct.source_author_id, u2.username, u2.pen_name, cpl.percent, ct.plan_id
          ORDER BY ct.level, ct.source_author_id`,
          [monthStart, item.author_id]
        );
        
        // 获取所有被推广作者的ID，然后从 author_royalty 表查询每个作者的真实总基础收入
        const sourceAuthorIds = [...new Set(calculationDetails.map(d => d.source_author_id))];
        const authorBaseIncomeMap = new Map();
        
        if (sourceAuthorIds.length > 0) {
          const placeholders = sourceAuthorIds.map(() => '?').join(',');
          const [authorBaseIncomes] = await db.execute(
            `SELECT 
              author_id,
              COALESCE(SUM(author_amount_usd), 0) as total_base_amount
            FROM author_royalty
            WHERE settlement_month = ?
              AND author_id IN (${placeholders})
            GROUP BY author_id`,
            [monthStart, ...sourceAuthorIds]
          );
          
          authorBaseIncomes.forEach(income => {
            authorBaseIncomeMap.set(income.author_id, parseFloat(income.total_base_amount || 0));
          });
        }
        
        // 构建计算方法字符串
        const calculationParts = [];
        const levelGroups = {};
        
        // 按层级分组
        calculationDetails.forEach(detail => {
          if (!levelGroups[detail.level]) {
            levelGroups[detail.level] = [];
          }
          levelGroups[detail.level].push(detail);
        });
        
        // 按层级顺序构建字符串
        const levelNames = ['一级', '二级', '三级', '四级', '五级', '六级', '七级', '八级', '九级', '十级'];
        
        Object.keys(levelGroups).sort((a, b) => parseInt(a) - parseInt(b)).forEach(level => {
          const levelDetails = levelGroups[level];
          const levelIndex = parseInt(level) - 1;
          const levelName = levelNames[levelIndex] || `第${level}级`;
          const levelParts = [];
          
          levelDetails.forEach(detail => {
            const authorName = detail.source_author_username || detail.source_author_pen_name || `用户${detail.source_author_id}`;
            // 从 author_royalty 表获取真实的总基础收入
            const baseAmount = authorBaseIncomeMap.get(detail.source_author_id) || 0;
            const percent = parseFloat(detail.percent || 0);
            const percentDisplay = (percent * 100).toFixed(0);
            
            if (baseAmount > 0 && percent > 0) {
              levelParts.push(`（${authorName}）作者基础收入总额：${baseAmount.toFixed(2)}*${percentDisplay}%`);
            }
          });
          
          if (levelParts.length > 0) {
            calculationParts.push(`${levelName}${levelParts.join('+')}`);
          }
        });
        
        return {
          ...item,
          calculationMethod: calculationParts.length > 0 ? calculationParts.join('+') : '暂无数据'
        };
      })
    );
    
    // 转换为数组并按总收入排序
    const stats = statsWithCalculation.sort((a, b) => b.total_income_usd - a.total_income_usd);
    
    // 获取明细
    let detailQuery = `
      SELECT 
        ar.*,
        u.username as author_name,
        u.pen_name,
        n.title as novel_title,
        rs.spend_time,
        rs.amount_usd as reader_spend_amount
      FROM author_royalty ar
      LEFT JOIN user u ON ar.author_id = u.id
      LEFT JOIN novel n ON ar.novel_id = n.id
      LEFT JOIN reader_spending rs ON ar.source_spend_id = rs.id
      WHERE ar.settlement_month = ?
    `;
    
    const detailParams = [monthStart];
    
    if (userId) {
      detailQuery += ' AND ar.author_id = ?';
      detailParams.push(userId);
    }
    
    detailQuery += ' ORDER BY ar.created_at DESC';
    
    const [details] = await db.execute(detailQuery, detailParams);
    
    // 获取作者推广佣金明细
    let referralQuery = `
      SELECT 
        ct.*,
        u.username,
        u.pen_name,
        u2.username as source_author_name,
        u2.pen_name as source_author_pen_name,
        n.title as novel_title
      FROM commission_transaction ct
      LEFT JOIN user u ON ct.user_id = u.id
      LEFT JOIN user u2 ON ct.source_author_id = u2.id
      LEFT JOIN novel n ON ct.novel_id = n.id
      WHERE ct.commission_type = 'author_referral'
        AND ct.settlement_month = ?
    `;
    
    const referralParams = [monthStart];
    
    if (userId) {
      referralQuery += ' AND (ct.user_id = ? OR ct.source_author_id = ?)';
      referralParams.push(userId, userId);
    }
    
    referralQuery += ' ORDER BY ct.created_at DESC';
    
    const [referralDetails] = await db.execute(referralQuery, referralParams);
    
    res.json({
      success: true,
      data: {
        month: monthStart,
        summary: stats.map(item => ({
          authorId: item.author_id,
          authorName: item.author_name || item.pen_name || `用户${item.author_id}`,
          baseIncome: parseFloat(item.base_income_usd || 0),
          referralIncome: parseFloat(item.referral_income_usd || 0),
          totalIncome: parseFloat(item.total_income_usd || 0),
          calculationMethod: item.calculationMethod || '暂无推广收入'
        })),
        details: details.map(item => ({
          id: item.id,
          authorId: item.author_id,
          authorName: item.author_name || item.pen_name || `用户${item.author_id}`,
          novelId: item.novel_id,
          novelTitle: item.novel_title,
          grossAmount: parseFloat(item.gross_amount_usd || 0),
          authorAmount: parseFloat(item.author_amount_usd || 0),
          spendTime: item.spend_time,
          readerSpendAmount: parseFloat(item.reader_spend_amount || 0)
        })),
        referralDetails: referralDetails.map(item => ({
          id: item.id,
          userId: item.user_id,
          userName: item.username || item.pen_name || `用户${item.user_id}`,
          sourceAuthorId: item.source_author_id,
          sourceAuthorName: item.source_author_name || item.source_author_pen_name || `用户${item.source_author_id}`,
          novelId: item.novel_id,
          novelTitle: item.novel_title,
          level: item.level,
          baseAmount: parseFloat(item.base_amount_usd || 0),
          commissionAmount: parseFloat(item.commission_amount_usd || 0),
          createdAt: item.created_at
        }))
      }
    });

  } catch (error) {
    console.error('获取作者收入统计错误:', error);
    res.status(500).json({
      success: false,
      message: '获取统计失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取读者收入统计
router.get('/reader-income-stats', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { month, userId } = req.query; // month格式：2025-10
    
    if (!month) {
      return res.status(400).json({
        success: false,
        message: '请指定月份'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    // 解析月份
    const monthStart = `${month}-01`;
    const nextMonth = new Date(new Date(monthStart).setMonth(new Date(monthStart).getMonth() + 1));
    const monthEnd = nextMonth.toISOString().split('T')[0];
    
    // 获取读者推广收入汇总
    let query = `
      SELECT 
        ct.user_id,
        u.username,
        u.pen_name,
        COALESCE(SUM(ct.commission_amount_usd), 0) as total_referral_income_usd,
        COUNT(DISTINCT ct.source_user_id) as referral_count
      FROM commission_transaction ct
      LEFT JOIN user u ON ct.user_id = u.id
      WHERE ct.commission_type = 'reader_referral'
        AND ct.settlement_month = ?
    `;
    
    const params = [monthStart];
    
    if (userId) {
      query += ' AND ct.user_id = ?';
      params.push(userId);
    }
    
    query += ' GROUP BY ct.user_id, u.username, u.pen_name ORDER BY total_referral_income_usd DESC';
    
    const [stats] = await db.execute(query, params);
    
    // 为每个推广人计算详细的计算方法
    const statsWithCalculation = await Promise.all(stats.map(async (item) => {
      // 获取该推广人的所有佣金明细，按层级和被推广读者分组
      const [calculationDetails] = await db.execute(
        `SELECT 
          ct.level,
          ct.source_user_id,
          u2.username as source_username,
          u2.pen_name as source_pen_name,
          SUM(ct.base_amount_usd) as total_base_amount,
          cpl.percent,
          ct.plan_id
        FROM commission_transaction ct
        LEFT JOIN user u2 ON ct.source_user_id = u2.id
        LEFT JOIN commission_plan_level cpl ON ct.plan_id = cpl.plan_id AND ct.level = cpl.level
        WHERE ct.commission_type = 'reader_referral'
          AND ct.settlement_month = ?
          AND ct.user_id = ?
        GROUP BY ct.level, ct.source_user_id, u2.username, u2.pen_name, cpl.percent, ct.plan_id
        ORDER BY ct.level, ct.source_user_id`,
        [monthStart, item.user_id]
      );
      
      // 构建计算方法字符串
      const calculationParts = [];
      const levelGroups = {};
      
      // 按层级分组
      calculationDetails.forEach(detail => {
        if (!levelGroups[detail.level]) {
          levelGroups[detail.level] = [];
        }
        levelGroups[detail.level].push(detail);
      });
      
      // 按层级顺序构建字符串
      const levelNames = ['一级', '二级', '三级', '四级', '五级', '六级', '七级', '八级', '九级', '十级'];
      
      Object.keys(levelGroups).sort((a, b) => parseInt(a) - parseInt(b)).forEach(level => {
        const levelDetails = levelGroups[level];
        const levelIndex = parseInt(level) - 1;
        const levelName = levelNames[levelIndex] || `第${level}级`;
        const levelParts = [];
        
        levelDetails.forEach(detail => {
          const userName = detail.source_username || detail.source_pen_name || `用户${detail.source_user_id}`;
          const baseAmount = parseFloat(detail.total_base_amount || 0);
          const percent = parseFloat(detail.percent || 0);
          const percentDisplay = (percent * 100).toFixed(0);
          
          if (baseAmount > 0 && percent > 0) {
            levelParts.push(`（${userName}）消费总额：${baseAmount.toFixed(2)}*${percentDisplay}%`);
          }
        });
        
        if (levelParts.length > 0) {
          calculationParts.push(`${levelName}${levelParts.join('+')}`);
        }
      });
      
      return {
        ...item,
        calculationMethod: calculationParts.length > 0 ? calculationParts.join('+') : '暂无数据'
      };
    }));
    
    // 获取读者消费汇总（用于展示读者推广的基础数据）
    let spendingQuery = `
      SELECT 
        rs.user_id,
        u.username,
        u.pen_name,
        COALESCE(SUM(rs.amount_usd), 0) as total_spending_usd,
        COUNT(*) as spending_count
      FROM reader_spending rs
      LEFT JOIN user u ON rs.user_id = u.id
      WHERE rs.settlement_month = ?
    `;
    
    const spendingParams = [monthStart];
    
    if (userId) {
      spendingQuery += ' AND rs.user_id = ?';
      spendingParams.push(userId);
    }
    
    spendingQuery += ' GROUP BY rs.user_id, u.username, u.pen_name ORDER BY total_spending_usd DESC';
    
    const [spendingStats] = await db.execute(spendingQuery, spendingParams);
    
    // 获取读者推广佣金明细
    let detailQuery = `
      SELECT 
        ct.*,
        u.username,
        u.pen_name,
        u2.username as source_user_name,
        u2.pen_name as source_user_pen_name,
        n.title as novel_title,
        rs.amount_usd as source_spending_amount
      FROM commission_transaction ct
      LEFT JOIN user u ON ct.user_id = u.id
      LEFT JOIN user u2 ON ct.source_user_id = u2.id
      LEFT JOIN novel n ON ct.novel_id = n.id
      LEFT JOIN reader_spending rs ON ct.reference_id = rs.id
      WHERE ct.commission_type = 'reader_referral'
        AND ct.settlement_month = ?
    `;
    
    const detailParams = [monthStart];
    
    if (userId) {
      detailQuery += ' AND ct.user_id = ?';
      detailParams.push(userId);
    }
    
    detailQuery += ' ORDER BY ct.created_at DESC';
    
    const [details] = await db.execute(detailQuery, detailParams);
    
    res.json({
      success: true,
      data: {
        month: monthStart,
        referralSummary: statsWithCalculation.map(item => ({
          userId: item.user_id,
          userName: item.username || item.pen_name || `用户${item.user_id}`,
          totalReferralIncome: parseFloat(item.total_referral_income_usd || 0),
          referralCount: parseInt(item.referral_count || 0),
          calculationMethod: item.calculationMethod
        })),
        spendingSummary: spendingStats.map(item => ({
          userId: item.user_id,
          userName: item.username || item.pen_name || `用户${item.user_id}`,
          totalSpending: parseFloat(item.total_spending_usd || 0),
          spendingCount: parseInt(item.spending_count || 0)
        })),
        details: details.map(item => ({
          id: item.id,
          userId: item.user_id,
          userName: item.username || item.pen_name || `用户${item.user_id}`,
          sourceUserId: item.source_user_id,
          sourceUserName: item.source_user_name || item.source_user_pen_name || `用户${item.source_user_id}`,
          novelId: item.novel_id,
          novelTitle: item.novel_title,
          level: item.level,
          baseAmount: parseFloat(item.base_amount_usd || 0),
          commissionAmount: parseFloat(item.commission_amount_usd || 0),
          sourceSpendingAmount: parseFloat(item.source_spending_amount || item.base_amount_usd || 0),
          createdAt: item.created_at
        }))
      }
    });

  } catch (error) {
    console.error('获取读者收入统计错误:', error);
    res.status(500).json({
      success: false,
      message: '获取统计失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 生成基础收入数据（reader_spending）
router.post('/generate-reader-spending', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { month } = req.body; // month格式：2025-10
    
    if (!month) {
      return res.status(400).json({
        success: false,
        message: '请指定月份'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    // 解析月份
    const monthStart = `${month}-01 00:00:00`;
    const nextMonth = new Date(new Date(monthStart).setMonth(new Date(monthStart).getMonth() + 1));
    const monthEnd = nextMonth.toISOString().split('T')[0] + ' 00:00:00';
    const settlementMonth = `${month}-01`;
    
    // 检查是否已经生成过
    const [existing] = await db.execute(
      'SELECT COUNT(*) as count FROM reader_spending WHERE settlement_month = ?',
      [settlementMonth]
    );
    
    if (existing[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: '该月份数据已存在，如需重新生成请先删除现有数据'
      });
    }
    
    let generatedCount = 0;
    
    // Step 1: 从 chapter_unlocks 表生成数据
    // 只处理 unlock_method='karma' AND cost>0 的记录
    const [chapterUnlocks] = await db.execute(
      `SELECT 
        cu.id,
        cu.user_id,
        cu.chapter_id,
        cu.cost as karma_amount,
        cu.unlocked_at,
        c.novel_id
      FROM chapter_unlocks cu
      INNER JOIN chapter c ON cu.chapter_id = c.id
      WHERE cu.unlocked_at >= ? 
        AND cu.unlocked_at < ?
        AND cu.unlock_method = 'karma'
        AND cu.cost > 0
      ORDER BY cu.unlocked_at`,
      [monthStart, monthEnd]
    );
    
    for (const unlock of chapterUnlocks) {
      // 查询当时的Karma汇率
      const [rateRows] = await db.execute(
        `SELECT usd_per_karma 
         FROM karma_dollars 
         WHERE effective_from <= ? 
           AND (effective_to IS NULL OR effective_to > ?)
         ORDER BY effective_from DESC
         LIMIT 1`,
        [unlock.unlocked_at, unlock.unlocked_at]
      );
      
      // 使用高精度计算，不四舍五入
      const usdPerKarma = rateRows.length > 0 
        ? new Decimal(rateRows[0].usd_per_karma) 
        : new Decimal(0.01); // 默认0.01
      const karmaAmount = new Decimal(unlock.karma_amount);
      const amountUsd = karmaAmount.mul(usdPerKarma); // 高精度乘法，不四舍五入
      
      // 插入 reader_spending
      await db.execute(
        `INSERT INTO reader_spending 
         (user_id, novel_id, karma_amount, amount_usd, source_type, source_id, spend_time, settlement_month)
         VALUES (?, ?, ?, ?, 'chapter_unlock', ?, ?, ?)`,
        [
          unlock.user_id,
          unlock.novel_id,
          unlock.karma_amount,
          amountUsd.toNumber(), // 转换为数字，保留完整精度
          unlock.id,
          unlock.unlocked_at,
          settlementMonth
        ]
      );
      generatedCount++;
    }
    
    // Step 2: 从 user_champion_subscription_record 表生成数据
    // 只处理 payment_status='completed' 的记录
    const [subscriptions] = await db.execute(
      `SELECT 
        id,
        user_id,
        novel_id,
        payment_amount as amount_usd,
        created_at as spend_time
      FROM user_champion_subscription_record
      WHERE created_at >= ? 
        AND created_at < ?
        AND payment_status = 'completed'
        AND payment_amount > 0
      ORDER BY created_at`,
      [monthStart, monthEnd]
    );
    
    for (const sub of subscriptions) {
      // 使用高精度，直接使用原始值，不四舍五入
      const amountUsd = new Decimal(sub.amount_usd);
      
      // 插入 reader_spending
      await db.execute(
        `INSERT INTO reader_spending 
         (user_id, novel_id, karma_amount, amount_usd, source_type, source_id, spend_time, settlement_month)
         VALUES (?, ?, 0, ?, 'subscription', ?, ?, ?)`,
        [
          sub.user_id,
          sub.novel_id,
          amountUsd.toNumber(), // 转换为数字，保留完整精度
          sub.id,
          sub.spend_time,
          settlementMonth
        ]
      );
      generatedCount++;
    }
    
    res.json({
      success: true,
      message: `成功生成 ${generatedCount} 条基础收入数据`,
      data: {
        month: settlementMonth,
        count: generatedCount,
        chapterUnlocks: chapterUnlocks.length,
        subscriptions: subscriptions.length
      }
    });

  } catch (error) {
    console.error('生成基础收入数据错误:', error);
    res.status(500).json({
      success: false,
      message: '生成失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取基础收入数据（reader_spending）
router.get('/reader-spending', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { month } = req.query; // month格式：2025-10
    
    if (!month) {
      return res.status(400).json({
        success: false,
        message: '请指定月份'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    const settlementMonth = `${month}-01`;
    
    // 获取汇总统计
    const [summary] = await db.execute(
      `SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(amount_usd), 0) as total_amount_usd,
        SUM(CASE WHEN source_type = 'chapter_unlock' THEN 1 ELSE 0 END) as chapter_unlock_count,
        SUM(CASE WHEN source_type = 'subscription' THEN 1 ELSE 0 END) as subscription_count,
        SUM(CASE WHEN source_type = 'chapter_unlock' THEN amount_usd ELSE 0 END) as chapter_unlock_amount,
        SUM(CASE WHEN source_type = 'subscription' THEN amount_usd ELSE 0 END) as subscription_amount
      FROM reader_spending
      WHERE settlement_month = ?`,
      [settlementMonth]
    );
    
    // 获取详细列表
    const [details] = await db.execute(
      `SELECT 
        rs.*,
        u.username,
        u.pen_name,
        n.title as novel_title
      FROM reader_spending rs
      LEFT JOIN user u ON rs.user_id = u.id
      LEFT JOIN novel n ON rs.novel_id = n.id
      WHERE rs.settlement_month = ?
      ORDER BY rs.spend_time DESC
      LIMIT 1000`,
      [settlementMonth]
    );
    
    res.json({
      success: true,
      data: {
        month: settlementMonth,
        summary: {
          totalCount: parseInt(summary[0].total_count || 0),
          totalAmountUsd: parseFloat(summary[0].total_amount_usd || 0),
          chapterUnlockCount: parseInt(summary[0].chapter_unlock_count || 0),
          subscriptionCount: parseInt(summary[0].subscription_count || 0),
          chapterUnlockAmount: parseFloat(summary[0].chapter_unlock_amount || 0),
          subscriptionAmount: parseFloat(summary[0].subscription_amount || 0)
        },
        details: details.map(item => ({
          id: item.id,
          userId: item.user_id,
          userName: item.username || item.pen_name || `用户${item.user_id}`,
          novelId: item.novel_id,
          novelTitle: item.novel_title || '未知',
          karmaAmount: item.karma_amount,
          amountUsd: parseFloat(item.amount_usd || 0),
          sourceType: item.source_type,
          sourceId: item.source_id,
          spendTime: item.spend_time,
          settled: item.settled === 1
        }))
      }
    });

  } catch (error) {
    console.error('获取基础收入数据错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 删除指定月份的基础收入数据
router.delete('/reader-spending', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { month } = req.query; // month格式：2025-10
    
    if (!month) {
      return res.status(400).json({
        success: false,
        message: '请指定月份'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    const settlementMonth = `${month}-01`;
    
    // 检查是否已结算
    const [check] = await db.execute(
      'SELECT COUNT(*) as count FROM reader_spending WHERE settlement_month = ? AND settled = 1',
      [settlementMonth]
    );
    
    if (check[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: '该月份数据已结算，无法删除'
      });
    }
    
    const [result] = await db.execute(
      'DELETE FROM reader_spending WHERE settlement_month = ?',
      [settlementMonth]
    );
    
    res.json({
      success: true,
      message: `成功删除 ${result.affectedRows} 条数据`,
      data: {
        deletedCount: result.affectedRows
      }
    });

  } catch (error) {
    console.error('删除基础收入数据错误:', error);
    res.status(500).json({
      success: false,
      message: '删除失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取作者基础收入数据
router.get('/author-royalty', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { month, search } = req.query; // month格式：2025-10, search: 搜索关键词
    
    if (!month) {
      return res.status(400).json({
        success: false,
        message: '请指定月份'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    const settlementMonth = `${month}-01`;
    
    // 构建查询条件
    let whereClause = 'ar.settlement_month = ?';
    let queryParams = [settlementMonth];
    
    // 如果提供了搜索关键词，根据 user_id, username, email, pen_name, phone_number 查询
    if (search) {
      whereClause += ` AND (
        u.id = ? OR 
        u.username LIKE ? OR 
        u.email LIKE ? OR 
        u.pen_name LIKE ? OR 
        u.phone_number LIKE ?
      )`;
      const searchPattern = `%${search}%`;
      queryParams.push(
        isNaN(search) ? -1 : parseInt(search), // 如果是数字，尝试作为ID查询
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern
      );
    }
    
    // 获取汇总统计
    const [summary] = await db.execute(
      `SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(ar.gross_amount_usd), 0) as total_amount_usd,
        COALESCE(SUM(ar.author_amount_usd), 0) as total_author_amount_usd,
        COUNT(DISTINCT ar.author_id) as author_count,
        COUNT(DISTINCT ar.novel_id) as novel_count
      FROM author_royalty ar
      LEFT JOIN user u ON ar.author_id = u.id
      WHERE ${whereClause}`,
      queryParams
    );
    
    // 获取详细列表
    const [details] = await db.execute(
      `SELECT 
        ar.*,
        u.username,
        u.pen_name,
        u.email,
        n.title as novel_title
      FROM author_royalty ar
      LEFT JOIN user u ON ar.author_id = u.id
      LEFT JOIN novel n ON ar.novel_id = n.id
      WHERE ${whereClause}
      ORDER BY ar.created_at DESC
      LIMIT 1000`,
      queryParams
    );
    
    res.json({
      success: true,
      data: {
        month: settlementMonth,
        summary: {
          totalCount: parseInt(summary[0].total_count || 0),
          totalAmountUsd: parseFloat(summary[0].total_amount_usd || 0),
          totalAuthorAmountUsd: parseFloat(summary[0].total_author_amount_usd || 0),
          authorCount: parseInt(summary[0].author_count || 0),
          novelCount: parseInt(summary[0].novel_count || 0)
        },
        details: details.map(item => ({
          id: item.id,
          authorId: item.author_id,
          authorName: item.username || item.pen_name || `用户${item.author_id}`,
          novelId: item.novel_id,
          novelTitle: item.novel_title || '未知',
          grossAmountUsd: parseFloat(item.gross_amount_usd || 0),
          authorAmountUsd: parseFloat(item.author_amount_usd || 0),
          settlementMonth: item.settlement_month ? item.settlement_month.toString().split('T')[0] : null,
          createdAt: item.created_at
        }))
      }
    });

  } catch (error) {
    console.error('获取作者基础收入数据错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 生成作者基础收入数据
router.post('/author-royalty/generate', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { month } = req.body; // month格式：2025-10
    
    if (!month) {
      return res.status(400).json({
        success: false,
        message: '请指定月份'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    const settlementMonth = `${month}-01`;
    const monthStart = `${month}-01 00:00:00`;
    const monthEnd = new Date(new Date(monthStart).setMonth(new Date(monthStart).getMonth() + 1)).toISOString().slice(0, 19).replace('T', ' ');
    
    // 检查是否已经生成过
    const [existing] = await db.execute(
      'SELECT COUNT(*) as count FROM author_royalty WHERE settlement_month = ?',
      [settlementMonth]
    );
    
    if (existing[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: '该月份数据已存在，请先删除后再生成'
      });
    }
    
    // 获取该月份的所有 reader_spending 记录
    const [spendings] = await db.execute(
      `SELECT 
        rs.id,
        rs.user_id,
        rs.novel_id,
        rs.amount_usd,
        rs.spend_time
      FROM reader_spending rs
      WHERE rs.settlement_month = ?
      ORDER BY rs.spend_time`,
      [settlementMonth]
    );
    
    if (spendings.length === 0) {
      return res.status(400).json({
        success: false,
        message: '该月份没有读者消费数据，请先生成基础收入数据'
      });
    }
    
    let generatedCount = 0;
    
    // 为每条 reader_spending 生成对应的 author_royalty
    for (const spending of spendings) {
      // 获取小说的作者ID
      const [novels] = await db.execute(
        'SELECT user_id FROM novel WHERE id = ?',
        [spending.novel_id]
      );
      
      if (novels.length === 0 || !novels[0].user_id) {
        console.warn(`小说 ${spending.novel_id} 没有作者，跳过`);
        continue;
      }
      
      const authorId = novels[0].user_id;
      
      // 根据消费时间查找当时生效的合同
      const [contracts] = await db.execute(
        `SELECT plan_id 
         FROM novel_royalty_contract 
         WHERE novel_id = ?
           AND author_id = ?
           AND effective_from <= ?
           AND (effective_to IS NULL OR effective_to > ?)
         ORDER BY effective_from DESC
         LIMIT 1`,
        [spending.novel_id, authorId, spending.spend_time, spending.spend_time]
      );
      
      let royaltyPercent = new Decimal(0.5); // 默认50%
      
      if (contracts.length > 0) {
        // 查找对应的分成方案
        const [plans] = await db.execute(
          'SELECT royalty_percent FROM author_royalty_plan WHERE id = ?',
          [contracts[0].plan_id]
        );
        
        if (plans.length > 0) {
          royaltyPercent = new Decimal(plans[0].royalty_percent);
        }
      } else {
        // 如果没有合同，使用默认方案
        const [defaultPlans] = await db.execute(
          'SELECT royalty_percent FROM author_royalty_plan WHERE is_default = 1 ORDER BY start_date DESC LIMIT 1'
        );
        
        if (defaultPlans.length > 0) {
          royaltyPercent = new Decimal(defaultPlans[0].royalty_percent);
        }
      }
      
      // 使用高精度计算，不四舍五入
      const grossAmountUsd = new Decimal(spending.amount_usd);
      const authorAmountUsd = grossAmountUsd.mul(royaltyPercent); // 高精度乘法，不四舍五入
      
      // 插入 author_royalty
      await db.execute(
        `INSERT INTO author_royalty 
         (author_id, novel_id, source_spend_id, gross_amount_usd, author_amount_usd, settlement_month)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          authorId,
          spending.novel_id,
          spending.id,
          grossAmountUsd.toNumber(), // 转换为数字，保留完整精度
          authorAmountUsd.toNumber(), // 转换为数字，保留完整精度
          settlementMonth
        ]
      );
      
      generatedCount++;
    }
    
    res.json({
      success: true,
      message: `成功生成 ${generatedCount} 条作者基础收入数据`,
      data: {
        month: settlementMonth,
        count: generatedCount
      }
    });

  } catch (error) {
    console.error('生成作者基础收入数据错误:', error);
    res.status(500).json({
      success: false,
      message: '生成失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 删除指定月份的作者基础收入数据
router.delete('/author-royalty', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { month } = req.query; // month格式：2025-10
    
    if (!month) {
      return res.status(400).json({
        success: false,
        message: '请指定月份'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    const settlementMonth = `${month}-01`;
    
    const [result] = await db.execute(
      'DELETE FROM author_royalty WHERE settlement_month = ?',
      [settlementMonth]
    );
    
    res.json({
      success: true,
      message: `成功删除 ${result.affectedRows} 条数据`,
      data: {
        deletedCount: result.affectedRows
      }
    });

  } catch (error) {
    console.error('删除作者基础收入数据错误:', error);
    res.status(500).json({
      success: false,
      message: '删除失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取推广佣金明细数据
router.get('/commission-transaction', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { month, search, type } = req.query; // month格式：2025-10, search: 搜索关键词, type: 佣金类型
    
    if (!month) {
      return res.status(400).json({
        success: false,
        message: '请指定月份'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    const settlementMonth = `${month}-01`;
    
    // 构建查询条件
    let whereClause = 'ct.settlement_month = ?';
    let queryParams = [settlementMonth];
    
    // 如果提供了搜索关键词，根据 user_id, username, email, pen_name, phone_number 查询
    if (search) {
      whereClause += ` AND (
        u.id = ? OR 
        u.username LIKE ? OR 
        u.email LIKE ? OR 
        u.pen_name LIKE ? OR 
        u.phone_number LIKE ?
      )`;
      const searchPattern = `%${search}%`;
      queryParams.push(
        isNaN(search) ? -1 : parseInt(search),
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern
      );
    }
    
    // 如果指定了佣金类型
    if (type && (type === 'reader_referral' || type === 'author_referral')) {
      whereClause += ' AND ct.commission_type = ?';
      queryParams.push(type);
    }
    
    // 获取汇总统计
    const [summary] = await db.execute(
      `SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(ct.commission_amount_usd), 0) as total_commission_usd,
        SUM(CASE WHEN ct.commission_type = 'reader_referral' THEN ct.commission_amount_usd ELSE 0 END) as reader_referral_commission,
        SUM(CASE WHEN ct.commission_type = 'author_referral' THEN ct.commission_amount_usd ELSE 0 END) as author_referral_commission,
        COUNT(DISTINCT ct.user_id) as user_count
      FROM commission_transaction ct
      LEFT JOIN user u ON ct.user_id = u.id
      WHERE ${whereClause}`,
      queryParams
    );
    
    // 获取详细列表
    const [details] = await db.execute(
      `SELECT 
        ct.*,
        u.username,
        u.pen_name,
        u_source.username as source_username,
        u_source.pen_name as source_pen_name,
        u_author.username as source_author_username,
        u_author.pen_name as source_author_pen_name,
        n.title as novel_title
      FROM commission_transaction ct
      LEFT JOIN user u ON ct.user_id = u.id
      LEFT JOIN user u_source ON ct.source_user_id = u_source.id
      LEFT JOIN user u_author ON ct.source_author_id = u_author.id
      LEFT JOIN novel n ON ct.novel_id = n.id
      WHERE ${whereClause}
      ORDER BY ct.created_at DESC
      LIMIT 1000`,
      queryParams
    );
    
    res.json({
      success: true,
      data: {
        month: settlementMonth,
        summary: {
          totalCount: parseInt(summary[0].total_count || 0),
          totalCommissionUsd: parseFloat(summary[0].total_commission_usd || 0),
          readerReferralCommission: parseFloat(summary[0].reader_referral_commission || 0),
          authorReferralCommission: parseFloat(summary[0].author_referral_commission || 0),
          userCount: parseInt(summary[0].user_count || 0)
        },
        details: details.map(item => ({
          id: item.id,
          userId: item.user_id,
          userName: item.username || item.pen_name || `用户${item.user_id}`,
          commissionType: item.commission_type,
          level: item.level,
          sourceUserId: item.source_user_id,
          sourceAuthorId: item.source_author_id,
          sourceUserName: item.source_username || item.source_pen_name || (item.source_user_id ? `用户${item.source_user_id}` : null),
          sourceAuthorName: item.source_author_username || item.source_author_pen_name || (item.source_author_id ? `用户${item.source_author_id}` : null),
          novelId: item.novel_id,
          novelTitle: item.novel_title || null,
          baseAmountUsd: parseFloat(item.base_amount_usd || 0),
          commissionAmountUsd: parseFloat(item.commission_amount_usd || 0),
          settlementMonth: item.settlement_month ? item.settlement_month.toString().split('T')[0] : null,
          createdAt: item.created_at
        }))
      }
    });

  } catch (error) {
    console.error('获取推广佣金明细数据错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 生成推广佣金明细数据
router.post('/commission-transaction/generate', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { month } = req.body; // month格式：2025-10
    
    if (!month) {
      return res.status(400).json({
        success: false,
        message: '请指定月份'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    const settlementMonth = `${month}-01`;
    
    // 检查是否已经生成过
    const [existing] = await db.execute(
      'SELECT COUNT(*) as count FROM commission_transaction WHERE settlement_month = ?',
      [settlementMonth]
    );
    
    if (existing[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: '该月份数据已存在，请先删除后再生成'
      });
    }
    
    let generatedCount = 0;
    let readerReferralCount = 0;
    let authorReferralCount = 0;
    
    // Step 3: 读者推广佣金（基于 reader_spending + referrals.promoter_plan_id）
    const [spendings] = await db.execute(
      `SELECT 
        rs.id,
        rs.user_id,
        rs.novel_id,
        rs.amount_usd,
        rs.spend_time
      FROM reader_spending rs
      WHERE rs.settlement_month = ?
      ORDER BY rs.spend_time`,
      [settlementMonth]
    );
    
    for (const spending of spendings) {
      const consumer = spending.user_id;
      // 使用高精度，不四舍五入
      const baseAmountUsd = new Decimal(spending.amount_usd);
      let current = consumer;
      let level = 1;
      const maxLevelLimit = 10; // 防止死循环
      
      while (level <= maxLevelLimit) {
        const [referrals] = await db.execute(
          'SELECT referrer_id, promoter_plan_id FROM referrals WHERE user_id = ? LIMIT 1',
          [current]
        );
        
        if (referrals.length === 0) break;
        
        const upline = referrals[0].referrer_id;
        const planId = referrals[0].promoter_plan_id;
        
        if (planId) {
          // 获取方案信息
          const [plans] = await db.execute(
            'SELECT max_level FROM commission_plan WHERE id = ?',
            [planId]
          );
          
          if (plans.length > 0 && level <= plans[0].max_level) {
            // 获取该层级的比例
            const [levels] = await db.execute(
              'SELECT percent FROM commission_plan_level WHERE plan_id = ? AND level = ?',
              [planId, level]
            );
            
            if (levels.length > 0) {
              const percent = new Decimal(levels[0].percent);
              if (percent.gt(0)) {
                // 使用高精度计算，不四舍五入
                const commissionUsd = baseAmountUsd.mul(percent);
                
                // 插入 commission_transaction
                await db.execute(
                  `INSERT INTO commission_transaction 
                   (user_id, source_user_id, novel_id, plan_id, level, commission_type,
                    base_amount_usd, commission_amount_usd, reference_id, settlement_month)
                   VALUES (?, ?, ?, ?, ?, 'reader_referral', ?, ?, ?, ?)`,
                  [
                    upline,
                    consumer,
                    spending.novel_id,
                    planId,
                    level,
                    baseAmountUsd.toNumber(), // 转换为数字，保留完整精度
                    commissionUsd.toNumber(), // 转换为数字，保留完整精度
                    spending.id,
                    settlementMonth
                  ]
                );
                
                generatedCount++;
                readerReferralCount++;
              }
            }
          }
        }
        
        current = upline;
        level++;
      }
    }
    
    // Step 4: 作者推广佣金（基于 author_royalty + referrals.author_plan_id）
    const [authorRoyalties] = await db.execute(
      `SELECT 
        ar.id,
        ar.author_id,
        ar.novel_id,
        ar.author_amount_usd
      FROM author_royalty ar
      WHERE ar.settlement_month = ?
      ORDER BY ar.created_at`,
      [settlementMonth]
    );
    
    for (const ar of authorRoyalties) {
      const author = ar.author_id;
      // 使用高精度，不四舍五入
      const baseAmountUsd = new Decimal(ar.author_amount_usd);
      let current = author;
      let level = 1;
      const maxLevelLimit = 10; // 防止死循环
      
      while (level <= maxLevelLimit) {
        const [referrals] = await db.execute(
          'SELECT referrer_id, author_plan_id FROM referrals WHERE user_id = ? LIMIT 1',
          [current]
        );
        
        if (referrals.length === 0) break;
        
        const upline = referrals[0].referrer_id;
        const planId = referrals[0].author_plan_id;
        
        if (planId) {
          // 获取方案信息
          const [plans] = await db.execute(
            'SELECT max_level FROM commission_plan WHERE id = ?',
            [planId]
          );
          
          if (plans.length > 0 && level <= plans[0].max_level) {
            // 获取该层级的比例
            const [levels] = await db.execute(
              'SELECT percent FROM commission_plan_level WHERE plan_id = ? AND level = ?',
              [planId, level]
            );
            
            if (levels.length > 0) {
              const percent = new Decimal(levels[0].percent);
              if (percent.gt(0)) {
                // 使用高精度计算，不四舍五入
                const commissionUsd = baseAmountUsd.mul(percent);
                
                // 插入 commission_transaction
                await db.execute(
                  `INSERT INTO commission_transaction 
                   (user_id, source_author_id, novel_id, plan_id, level, commission_type,
                    base_amount_usd, commission_amount_usd, reference_id, settlement_month)
                   VALUES (?, ?, ?, ?, ?, 'author_referral', ?, ?, ?, ?)`,
                  [
                    upline,
                    author,
                    ar.novel_id,
                    planId,
                    level,
                    baseAmountUsd.toNumber(), // 转换为数字，保留完整精度
                    commissionUsd.toNumber(), // 转换为数字，保留完整精度
                    ar.id,
                    settlementMonth
                  ]
                );
                
                generatedCount++;
                authorReferralCount++;
              }
            }
          }
        }
        
        current = upline;
        level++;
      }
    }
    
    res.json({
      success: true,
      message: `成功生成 ${generatedCount} 条推广佣金明细数据（读者推广：${readerReferralCount}，作者推广：${authorReferralCount}）`,
      data: {
        month: settlementMonth,
        count: generatedCount,
        readerReferralCount: readerReferralCount,
        authorReferralCount: authorReferralCount
      }
    });

  } catch (error) {
    console.error('生成推广佣金明细数据错误:', error);
    res.status(500).json({
      success: false,
      message: '生成失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 删除指定月份的推广佣金明细数据
router.delete('/commission-transaction', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { month } = req.query; // month格式：2025-10
    
    if (!month) {
      return res.status(400).json({
        success: false,
        message: '请指定月份'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    const settlementMonth = `${month}-01`;
    
    const [result] = await db.execute(
      'DELETE FROM commission_transaction WHERE settlement_month = ?',
      [settlementMonth]
    );
    
    res.json({
      success: true,
      message: `成功删除 ${result.affectedRows} 条数据`,
      data: {
        deletedCount: result.affectedRows
      }
    });

  } catch (error) {
    console.error('删除推广佣金明细数据错误:', error);
    res.status(500).json({
      success: false,
      message: '删除失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// ==================== 提成设置相关接口 ====================

// 获取推广分成方案列表
router.get('/commission-plans', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { plan_type, search } = req.query;
    db = await mysql.createConnection(dbConfig);
    
    let query = `
      SELECT 
        cp.*,
        u.username as owner_username,
        u.pen_name as owner_pen_name,
        (SELECT COUNT(*) FROM referrals r WHERE r.promoter_plan_id = cp.id) as reader_referral_count,
        (SELECT COUNT(*) FROM referrals r WHERE r.author_plan_id = cp.id) as author_referral_count
      FROM commission_plan cp
      LEFT JOIN user u ON cp.owner_user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (plan_type && plan_type !== 'all') {
      query += ' AND cp.plan_type = ?';
      params.push(plan_type);
    }
    
    if (search) {
      query += ' AND (cp.name LIKE ? OR cp.id = ?)';
      params.push(`%${search}%`, search);
    }
    
    query += ' ORDER BY cp.start_date DESC, cp.id DESC';
    
    const [plans] = await db.execute(query, params);
    
    // 获取每个方案的层级信息
    const plansWithLevels = await Promise.all(plans.map(async (plan) => {
      const [levels] = await db.execute(
        'SELECT level, percent FROM commission_plan_level WHERE plan_id = ? ORDER BY level',
        [plan.id]
      );
      return {
        ...plan,
        levels: levels.map(l => ({
          level: l.level,
          percent: parseFloat(l.percent)
        }))
      };
    }));
    
    res.json({
      success: true,
      data: plansWithLevels
    });
  } catch (error) {
    console.error('获取推广分成方案列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取推广分成方案详情
router.get('/commission-plans/:id', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { id } = req.params;
    db = await mysql.createConnection(dbConfig);
    
    const [plans] = await db.execute(
      `SELECT 
        cp.*,
        u.username as owner_username,
        u.pen_name as owner_pen_name
      FROM commission_plan cp
      LEFT JOIN user u ON cp.owner_user_id = u.id
      WHERE cp.id = ?`,
      [id]
    );
    
    if (plans.length === 0) {
      return res.status(404).json({
        success: false,
        message: '方案不存在'
      });
    }
    
    const [levels] = await db.execute(
      'SELECT level, percent FROM commission_plan_level WHERE plan_id = ? ORDER BY level',
      [id]
    );
    
    // 统计使用情况
    const [readerCount] = await db.execute(
      'SELECT COUNT(*) as count FROM referrals WHERE promoter_plan_id = ?',
      [id]
    );
    const [authorCount] = await db.execute(
      'SELECT COUNT(*) as count FROM referrals WHERE author_plan_id = ?',
      [id]
    );
    
    res.json({
      success: true,
      data: {
        plan: {
          id: plans[0].id,
          name: plans[0].name,
          plan_type: plans[0].plan_type,
          max_level: plans[0].max_level,
          start_date: plans[0].start_date,
          end_date: plans[0].end_date,
          is_custom: plans[0].is_custom === 1,
          owner_user_id: plans[0].owner_user_id,
          remark: plans[0].remark,
          created_at: plans[0].created_at,
          updated_at: plans[0].updated_at
        },
        levels: levels.map(l => ({
          level: l.level,
          percent: parseFloat(l.percent)
        }))
      }
    });
  } catch (error) {
    console.error('获取推广分成方案详情错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 辅助函数：将ISO日期格式转换为MySQL DATETIME格式
function formatDateForMySQL(dateString) {
  if (!dateString) return null;
  
  // 如果已经是MySQL格式，直接返回
  if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateString)) {
    return dateString;
  }
  
  // 处理ISO格式 (2025-11-17T08:00:00.000Z)
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return null;
    }
    
    // 转换为本地时间，然后格式化为 MySQL DATETIME 格式
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch (error) {
    console.error('日期格式转换错误:', error);
    return null;
  }
}

// 创建/更新推广分成方案
router.post('/commission-plans', authenticateAdmin, async (req, res) => {
  let db;
  try {
    let { id, name, plan_type, max_level, start_date, end_date, is_custom, owner_user_id, remark, levels } = req.body;
    db = await mysql.createConnection(dbConfig);
    
    // 转换日期格式
    const formattedStartDate = formatDateForMySQL(start_date);
    const formattedEndDate = end_date ? formatDateForMySQL(end_date) : null;
    
    await db.beginTransaction();
    
    try {
      if (id) {
        // 更新方案
        await db.execute(
          `UPDATE commission_plan 
           SET name = ?, max_level = ?, start_date = ?, end_date = ?, is_custom = ?, owner_user_id = ?, remark = ?
           WHERE id = ?`,
          [name, max_level, formattedStartDate, formattedEndDate, is_custom ? 1 : 0, owner_user_id || null, remark || null, id]
        );
        
        // 只有在明确传递了levels参数时才删除并重新插入层级
        if (levels && Array.isArray(levels)) {
          // 删除旧层级
          await db.execute('DELETE FROM commission_plan_level WHERE plan_id = ?', [id]);
        }
      } else {
        // 创建新方案
        const [result] = await db.execute(
          `INSERT INTO commission_plan (name, plan_type, max_level, start_date, end_date, is_custom, owner_user_id, remark)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [name, plan_type, max_level, formattedStartDate, formattedEndDate, is_custom ? 1 : 0, owner_user_id || null, remark || null]
        );
        id = result.insertId;
      }
      
      // 插入层级
      if (levels && Array.isArray(levels)) {
        for (const level of levels) {
          await db.execute(
            'INSERT INTO commission_plan_level (plan_id, level, percent) VALUES (?, ?, ?)',
            [id, level.level, level.percent]
          );
        }
      }
      
      await db.commit();
      
      res.json({
        success: true,
        message: id ? '更新成功' : '创建成功',
        data: { id }
      });
    } catch (error) {
      await db.rollback();
      throw error;
    }
  } catch (error) {
    console.error('保存推广分成方案错误:', error);
    res.status(500).json({
      success: false,
      message: '保存失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 停用推广分成方案
router.post('/commission-plans/:id/disable', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { id } = req.params;
    const { end_date } = req.body;
    db = await mysql.createConnection(dbConfig);
    
    await db.execute(
      'UPDATE commission_plan SET end_date = ? WHERE id = ?',
      [end_date || new Date().toISOString().slice(0, 19).replace('T', ' '), id]
    );
    
    res.json({
      success: true,
      message: '停用成功'
    });
  } catch (error) {
    console.error('停用推广分成方案错误:', error);
    res.status(500).json({
      success: false,
      message: '停用失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取推广分成方案层级列表
router.get('/commission-plans/:id/levels', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { id } = req.params;
    db = await mysql.createConnection(dbConfig);
    
    const [levels] = await db.execute(
      'SELECT id, plan_id, level, percent FROM commission_plan_level WHERE plan_id = ? ORDER BY level',
      [id]
    );
    
    res.json({
      success: true,
      data: levels.map(l => ({
        id: l.id,
        plan_id: l.plan_id,
        level: l.level,
        percent: parseFloat(l.percent)
      }))
    });
  } catch (error) {
    console.error('获取推广分成方案层级列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 更新推广分成方案层级比例
router.put('/commission-plan-levels/:id', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { id } = req.params;
    const { percent } = req.body;
    
    if (percent === undefined || percent === null) {
      return res.status(400).json({
        success: false,
        message: '缺少percent参数'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    await db.execute(
      'UPDATE commission_plan_level SET percent = ? WHERE id = ?',
      [percent, id]
    );
    
    res.json({
      success: true,
      message: '更新成功'
    });
  } catch (error) {
    console.error('更新推广分成方案层级比例错误:', error);
    res.status(500).json({
      success: false,
      message: '更新失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 创建推广分成方案层级
router.post('/commission-plan-levels', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { plan_id, level, percent } = req.body;
    
    if (!plan_id || !level || percent === undefined || percent === null) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数：plan_id, level, percent'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    // 检查方案是否存在以及level是否超过max_level
    const [plans] = await db.execute(
      'SELECT max_level FROM commission_plan WHERE id = ?',
      [plan_id]
    );
    
    if (plans.length === 0) {
      return res.status(404).json({
        success: false,
        message: '方案不存在'
      });
    }
    
    if (level > plans[0].max_level) {
      return res.status(400).json({
        success: false,
        message: `层级不能超过最大层级 ${plans[0].max_level}`
      });
    }
    
    // 检查该层级是否已存在
    const [existing] = await db.execute(
      'SELECT id FROM commission_plan_level WHERE plan_id = ? AND level = ?',
      [plan_id, level]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: '该层级已存在'
      });
    }
    
    // 插入新层级
    const [result] = await db.execute(
      'INSERT INTO commission_plan_level (plan_id, level, percent) VALUES (?, ?, ?)',
      [plan_id, level, percent]
    );
    
    res.json({
      success: true,
      message: '创建成功',
      data: {
        id: result.insertId,
        plan_id,
        level,
        percent: parseFloat(percent)
      }
    });
  } catch (error) {
    console.error('创建推广分成方案层级错误:', error);
    res.status(500).json({
      success: false,
      message: '创建失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取用户绑定关系列表（referrals）
router.get('/referrals', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { 
      user_id, 
      referrer_id, 
      promoter_plan_id, 
      author_plan_id, 
      created_from, 
      created_to,
      page = 1,
      page_size = 20
    } = req.query;
    
    db = await mysql.createConnection(dbConfig);
    
    // 构建查询条件
    let query = `
      SELECT
        r.id,
        r.user_id,
        u.username AS user_name,
        u.pen_name AS user_pen_name,
        r.referrer_id,
        ru.username AS referrer_name,
        ru.pen_name AS referrer_pen_name,
        r.promoter_plan_id,
        pp.name AS promoter_plan_name,
        r.author_plan_id,
        ap.name AS author_plan_name,
        r.created_at,
        r.updated_at
      FROM referrals r
      LEFT JOIN user u ON r.user_id = u.id
      LEFT JOIN user ru ON r.referrer_id = ru.id
      LEFT JOIN commission_plan pp ON r.promoter_plan_id = pp.id
      LEFT JOIN commission_plan ap ON r.author_plan_id = ap.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (user_id) {
      query += ' AND r.user_id = ?';
      params.push(user_id);
    }
    
    if (referrer_id) {
      query += ' AND r.referrer_id = ?';
      params.push(referrer_id);
    }
    
    if (promoter_plan_id) {
      query += ' AND r.promoter_plan_id = ?';
      params.push(promoter_plan_id);
    }
    
    if (author_plan_id) {
      query += ' AND r.author_plan_id = ?';
      params.push(author_plan_id);
    }
    
    if (created_from) {
      query += ' AND r.created_at >= ?';
      params.push(formatDateForMySQL(created_from));
    }
    
    if (created_to) {
      query += ' AND r.created_at <= ?';
      params.push(formatDateForMySQL(created_to));
    }
    
    // 获取总数（先构建COUNT查询，使用相同的WHERE条件）
    const countParams = [];
    let countQuery = 'SELECT COUNT(*) as total FROM referrals r WHERE 1=1';
    
    if (user_id) {
      countQuery += ' AND r.user_id = ?';
      countParams.push(user_id);
    }
    if (referrer_id) {
      countQuery += ' AND r.referrer_id = ?';
      countParams.push(referrer_id);
    }
    if (promoter_plan_id) {
      countQuery += ' AND r.promoter_plan_id = ?';
      countParams.push(promoter_plan_id);
    }
    if (author_plan_id) {
      countQuery += ' AND r.author_plan_id = ?';
      countParams.push(author_plan_id);
    }
    if (created_from) {
      countQuery += ' AND r.created_at >= ?';
      countParams.push(formatDateForMySQL(created_from));
    }
    if (created_to) {
      countQuery += ' AND r.created_at <= ?';
      countParams.push(formatDateForMySQL(created_to));
    }
    
    const [countResult] = await db.execute(countQuery, countParams);
    const total = countResult[0].total;
    
    // 添加排序和分页
    const pageNum = parseInt(page) || 1;
    const pageSizeNum = parseInt(page_size) || 20;
    const offset = Math.max(0, (pageNum - 1) * pageSizeNum);
    const limitNum = Math.max(1, pageSizeNum);
    
    query += ' ORDER BY r.id DESC';
    query += ` LIMIT ${limitNum} OFFSET ${offset}`;
    
    const [referrals] = await db.execute(query, params);
    
    // 格式化返回数据
    const list = referrals.map(item => ({
      id: item.id,
      user_id: item.user_id,
      user_name: item.user_name || item.user_pen_name || `用户${item.user_id}`,
      referrer_id: item.referrer_id,
      referrer_name: item.referrer_name || item.referrer_pen_name || `用户${item.referrer_id}`,
      promoter_plan_id: item.promoter_plan_id,
      promoter_plan_name: item.promoter_plan_name,
      author_plan_id: item.author_plan_id,
      author_plan_name: item.author_plan_name,
      created_at: item.created_at,
      updated_at: item.updated_at
    }));
    
    res.json({
      success: true,
      data: {
        list,
        total,
        page: pageNum,
        pageSize: pageSizeNum
      }
    });
    
  } catch (error) {
    console.error('获取用户绑定关系列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 更新用户绑定关系的推广方案
router.put('/referrals/:id', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { id } = req.params;
    const { promoter_plan_id, author_plan_id } = req.body;
    
    db = await mysql.createConnection(dbConfig);
    
    // 验证记录是否存在
    const [existing] = await db.execute(
      'SELECT id FROM referrals WHERE id = ?',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: '记录不存在'
      });
    }
    
    // 构建更新语句
    const updateFields = [];
    const updateValues = [];
    
    if (promoter_plan_id !== undefined) {
      updateFields.push('promoter_plan_id = ?');
      updateValues.push(promoter_plan_id || null);
    }
    
    if (author_plan_id !== undefined) {
      updateFields.push('author_plan_id = ?');
      updateValues.push(author_plan_id || null);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: '至少需要提供一个方案ID'
      });
    }
    
    updateFields.push('updated_at = NOW()');
    updateValues.push(id);
    
    await db.execute(
      `UPDATE referrals SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );
    
    res.json({
      success: true,
      message: '更新成功'
    });
  } catch (error) {
    console.error('更新用户绑定关系错误:', error);
    res.status(500).json({
      success: false,
      message: '更新失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取用户详情
router.get('/user/:id', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { id } = req.params;
    db = await mysql.createConnection(dbConfig);
    
    const [users] = await db.execute(
      `SELECT * FROM user WHERE id = ?`,
      [id]
    );
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    const user = users[0];
    
    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        confirmed_email: user.confirmed_email,
        phone_number: user.phone_number,
        country_code: user.country_code,
        qq_number: user.qq_number,
        wechat_number: user.wechat_number,
        pen_name: user.pen_name,
        bio: user.bio,
        avatar: user.avatar,
        is_author: user.is_author === 1,
        is_vip: user.is_vip === 1,
        is_real_name_verified: user.is_real_name_verified === 1,
        status: user.status,
        balance: parseFloat(user.balance || 0),
        points: parseFloat(user.points || 0),
        golden_karma: parseFloat(user.golden_karma || 0),
        vip_expire_at: user.vip_expire_at,
        last_login_at: user.last_login_at,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });
  } catch (error) {
    console.error('获取用户详情错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 搜索用户（用于owner_user_id选择）
router.get('/users/search', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { q } = req.query;
    if (!q || q.trim() === '') {
      return res.json({
        success: true,
        data: []
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    // 搜索所有可能的字段：id, username, email, pen_name, phone_number, qq_number, wechat_number
    const searchTerm = `%${q}%`;
    const [users] = await db.execute(
      `SELECT id, username, email, pen_name, phone_number, qq_number, wechat_number, is_author, status
       FROM user
       WHERE id = ? OR username LIKE ? OR email LIKE ? OR pen_name LIKE ? 
             OR phone_number LIKE ? OR qq_number LIKE ? OR wechat_number LIKE ?
       ORDER BY id DESC
       LIMIT 20`,
      [q, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm]
    );
    
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('搜索用户错误:', error);
    res.status(500).json({
      success: false,
      message: '搜索失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 搜索小说（用于unlockprice查询）
router.get('/novels/search', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { q } = req.query;
    if (!q || q.trim() === '') {
      return res.json({
        success: true,
        data: []
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    // 搜索所有可能的字段：id, title, author, 主角名
    const searchTerm = `%${q}%`;
    
    // 先尝试按ID精确匹配
    const isNumeric = /^\d+$/.test(q.trim());
    
    let query;
    let params;
    
    if (isNumeric) {
      // 如果是数字，同时搜索ID和标题、作者、主角
      query = `
        SELECT DISTINCT n.id, n.title, n.author, n.description, n.status
        FROM novel n
        LEFT JOIN protagonist p ON n.id = p.novel_id
        WHERE n.id = ? OR n.title LIKE ? OR n.author LIKE ? OR p.name LIKE ?
        ORDER BY n.id DESC
        LIMIT 20
      `;
      params = [parseInt(q.trim()), searchTerm, searchTerm, searchTerm];
    } else {
      // 如果不是数字，只搜索标题、作者、主角
      query = `
        SELECT DISTINCT n.id, n.title, n.author, n.description, n.status
        FROM novel n
        LEFT JOIN protagonist p ON n.id = p.novel_id
        WHERE n.title LIKE ? OR n.author LIKE ? OR p.name LIKE ?
        ORDER BY n.id DESC
        LIMIT 20
      `;
      params = [searchTerm, searchTerm, searchTerm];
    }
    
    const [novels] = await db.execute(query, params);
    
    res.json({
      success: true,
      data: novels
    });
  } catch (error) {
    console.error('搜索小说错误:', error);
    res.status(500).json({
      success: false,
      message: '搜索失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取Karma汇率列表
router.get('/karma-rates', authenticateAdmin, async (req, res) => {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    const [rates] = await db.execute(
      `SELECT 
        id,
        usd_per_karma,
        effective_from,
        effective_to,
        created_at
      FROM karma_dollars
      ORDER BY effective_from DESC`
    );
    
    res.json({
      success: true,
      data: rates.map(rate => ({
        id: rate.id,
        usd_per_karma: parseFloat(rate.usd_per_karma),
        effective_from: rate.effective_from,
        effective_to: rate.effective_to,
        created_at: rate.created_at
      }))
    });
  } catch (error) {
    console.error('获取Karma汇率列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 创建新的Karma汇率
router.post('/karma-rates', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { usd_per_karma, effective_from } = req.body;
    db = await mysql.createConnection(dbConfig);
    
    await db.beginTransaction();
    
    try {
      // 找到当前生效的汇率（effective_to为NULL）
      const [currentRates] = await db.execute(
        'SELECT id, effective_from FROM karma_dollars WHERE effective_to IS NULL ORDER BY effective_from DESC LIMIT 1'
      );
      
      if (currentRates.length > 0) {
        // 将当前汇率的结束时间设置为新汇率生效时间前一秒
        const newEffectiveFrom = new Date(effective_from);
        const prevEffectiveTo = new Date(newEffectiveFrom.getTime() - 1000);
        
        await db.execute(
          'UPDATE karma_dollars SET effective_to = ? WHERE id = ?',
          [prevEffectiveTo.toISOString().slice(0, 19).replace('T', ' '), currentRates[0].id]
        );
      }
      
      // 插入新汇率
      const [result] = await db.execute(
        'INSERT INTO karma_dollars (usd_per_karma, effective_from, effective_to) VALUES (?, ?, NULL)',
        [usd_per_karma, effective_from]
      );
      
      await db.commit();
      
      res.json({
        success: true,
        message: '创建成功',
        data: { id: result.insertId }
      });
    } catch (error) {
      await db.rollback();
      throw error;
    }
  } catch (error) {
    console.error('创建Karma汇率错误:', error);
    res.status(500).json({
      success: false,
      message: '创建失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取作者分成方案列表
router.get('/author-royalty-plans', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { is_default, search } = req.query;
    db = await mysql.createConnection(dbConfig);
    
    let query = `
      SELECT 
        arp.*,
        (SELECT COUNT(*) FROM novel_royalty_contract nrc WHERE nrc.plan_id = arp.id) as novel_count
      FROM author_royalty_plan arp
      WHERE 1=1
    `;
    const params = [];
    
    if (is_default !== undefined && is_default !== '') {
      query += ' AND arp.is_default = ?';
      params.push(is_default === 'true' ? 1 : 0);
    }
    
    if (search) {
      query += ' AND (arp.name LIKE ? OR arp.id = ?)';
      params.push(`%${search}%`, search);
    }
    
    query += ' ORDER BY arp.start_date DESC, arp.id DESC';
    
    const [plans] = await db.execute(query, params);
    
    res.json({
      success: true,
      data: plans.map(plan => ({
        ...plan,
        royalty_percent: parseFloat(plan.royalty_percent),
        is_default: plan.is_default === 1,
        owner_user_id: plan.owner_user_id ? parseInt(plan.owner_user_id) : null,
        novel_count: parseInt(plan.novel_count || 0)
      }))
    });
  } catch (error) {
    console.error('获取作者分成方案列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取作者分成方案详情
router.get('/author-royalty-plans/:id', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { id } = req.params;
    db = await mysql.createConnection(dbConfig);
    
    const [plans] = await db.execute(
      'SELECT * FROM author_royalty_plan WHERE id = ?',
      [id]
    );
    
    if (plans.length === 0) {
      return res.status(404).json({
        success: false,
        message: '方案不存在'
      });
    }
    
    // 获取使用此方案的小说列表（前10条）
    const [novels] = await db.execute(
      `SELECT 
        nrc.novel_id,
        n.title as novel_title,
        nrc.effective_from,
        nrc.effective_to
      FROM novel_royalty_contract nrc
      LEFT JOIN novel n ON nrc.novel_id = n.id
      WHERE nrc.plan_id = ?
      ORDER BY nrc.effective_from DESC
      LIMIT 10`,
      [id]
    );
    
    res.json({
      success: true,
      data: {
        ...plans[0],
        royalty_percent: parseFloat(plans[0].royalty_percent),
        is_default: plans[0].is_default === 1,
        owner_user_id: plans[0].owner_user_id ? parseInt(plans[0].owner_user_id) : null,
        novels: novels
      }
    });
  } catch (error) {
    console.error('获取作者分成方案详情错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 创建/更新作者分成方案
router.post('/author-royalty-plans', authenticateAdmin, async (req, res) => {
  let db;
  try {
    let { id, name, royalty_percent, is_default, owner_user_id, start_date, end_date, remark } = req.body;
    db = await mysql.createConnection(dbConfig);
    
    await db.beginTransaction();
    
    try {
      if (is_default) {
        // 如果设为默认，先取消其他默认方案
        await db.execute(
          'UPDATE author_royalty_plan SET is_default = 0 WHERE is_default = 1'
        );
      }
      
      if (id) {
        // 更新方案
        await db.execute(
          `UPDATE author_royalty_plan 
           SET name = ?, royalty_percent = ?, is_default = ?, owner_user_id = ?, start_date = ?, end_date = ?, remark = ?
           WHERE id = ?`,
          [name, royalty_percent, is_default ? 1 : 0, owner_user_id || null, start_date, end_date || null, remark || null, id]
        );
      } else {
        // 创建新方案
        const [result] = await db.execute(
          `INSERT INTO author_royalty_plan (name, royalty_percent, is_default, owner_user_id, start_date, end_date, remark)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [name, royalty_percent, is_default ? 1 : 0, owner_user_id || null, start_date, end_date || null, remark || null]
        );
        id = result.insertId;
      }
      
      await db.commit();
      
      res.json({
        success: true,
        message: id ? '更新成功' : '创建成功',
        data: { id }
      });
    } catch (error) {
      await db.rollback();
      throw error;
    }
  } catch (error) {
    console.error('保存作者分成方案错误:', error);
    res.status(500).json({
      success: false,
      message: '保存失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取小说分成合同列表
router.get('/novel-royalty-contracts/:novelId', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { novelId } = req.params;
    db = await mysql.createConnection(dbConfig);
    
    const [contracts] = await db.execute(
      `SELECT 
        nrc.*,
        arp.name as plan_name,
        arp.royalty_percent
      FROM novel_royalty_contract nrc
      LEFT JOIN author_royalty_plan arp ON nrc.plan_id = arp.id
      WHERE nrc.novel_id = ?
      ORDER BY nrc.effective_from DESC`,
      [novelId]
    );
    
    res.json({
      success: true,
      data: contracts.map(contract => ({
        ...contract,
        royalty_percent: parseFloat(contract.royalty_percent)
      }))
    });
  } catch (error) {
    console.error('获取小说分成合同列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 创建小说分成合同
router.post('/novel-royalty-contracts', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { novel_id, plan_id, effective_from, remark } = req.body;
    db = await mysql.createConnection(dbConfig);
    
    await db.beginTransaction();
    
    try {
      // 找到当前生效的合同（effective_to为NULL）
      const [currentContracts] = await db.execute(
        'SELECT id, effective_from FROM novel_royalty_contract WHERE novel_id = ? AND effective_to IS NULL ORDER BY effective_from DESC LIMIT 1',
        [novel_id]
      );
      
      if (currentContracts.length > 0) {
        // 将当前合同的结束时间设置为新合同生效时间前一秒
        const newEffectiveFrom = new Date(effective_from);
        const prevEffectiveTo = new Date(newEffectiveFrom.getTime() - 1000);
        
        await db.execute(
          'UPDATE novel_royalty_contract SET effective_to = ? WHERE id = ?',
          [prevEffectiveTo.toISOString().slice(0, 19).replace('T', ' '), currentContracts[0].id]
        );
      }
      
      // 获取作者ID
      const [novels] = await db.execute('SELECT user_id as author_id FROM novel WHERE id = ?', [novel_id]);
      if (novels.length === 0) {
        throw new Error('小说不存在');
      }
      
      // 插入新合同
      const [result] = await db.execute(
        `INSERT INTO novel_royalty_contract (novel_id, author_id, plan_id, effective_from, effective_to, remark)
         VALUES (?, ?, ?, ?, NULL, ?)`,
        [novel_id, novels[0].author_id, plan_id, effective_from, remark || null]
      );
      
      await db.commit();
      
      res.json({
        success: true,
        message: '创建成功',
        data: { id: result.insertId }
      });
    } catch (error) {
      await db.rollback();
      throw error;
    }
  } catch (error) {
    console.error('创建小说分成合同错误:', error);
    res.status(500).json({
      success: false,
      message: '创建失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// ==================== 用户结算总览相关接口（支持作者+推广者） ====================

// 工具函数：解析月份格式
function parseMonth(month) {
  if (!month) return null;
  if (month.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return month;
  }
  if (month.match(/^\d{4}-\d{2}$/)) {
    return `${month}-01`;
  }
  return month;
}

// 获取用户结算总览列表（支持所有用户：作者+推广者）
router.get('/user-settlement/overview', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { month, status, userId, minUnpaid, role } = req.query;
    // role: 'all' | 'author_only' | 'promoter_only'
    
    db = await mysql.createConnection(dbConfig);
    
    // 解析月份
    const monthStart = month ? parseMonth(month) : null;
    
    // 构建查询 - 使用子查询避免 GROUP BY 问题
    const monthParam = monthStart || new Date().toISOString().substring(0, 7) + '-01';
    
    let query = `
      SELECT 
        u.id as user_id,
        u.username,
        u.pen_name,
        u.email,
        u.is_author,
        -- 判断是否推广者（在commission_transaction中有记录）
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM commission_transaction 
            WHERE user_id = u.id LIMIT 1
          ) THEN 1 
          ELSE 0 
        END as is_promoter,
        -- 本月收入（一个用户一个月一笔支付单）
        COALESCE(uim_month.author_base_income_usd, 0) as month_author_base_income,
        COALESCE(uim_month.reader_referral_income_usd, 0) as month_reader_referral_income,
        COALESCE(uim_month.author_referral_income_usd, 0) as month_author_referral_income,
        COALESCE(uim_month.total_income_usd, 0) as month_total_income,
        CASE WHEN uim_month.payout_status = 'paid' THEN uim_month.total_income_usd ELSE 0 END as month_paid_amount,
        CASE WHEN uim_month.payout_status = 'paid' THEN 0 ELSE COALESCE(uim_month.total_income_usd, 0) END as month_unpaid_amount,
        COALESCE(uim_month.payout_status, 'unpaid') as month_status,
        uim_month.id as income_monthly_id,
        uim_month.payout_id,
        -- 支付方式（从user_payout表获取）
        up.method as payout_method,
        -- 累计未支付（使用子查询）
        COALESCE((
          SELECT SUM(total_income_usd)
          FROM user_income_monthly
          WHERE user_id = u.id AND payout_status = 'unpaid'
        ), 0) as total_unpaid_amount
      FROM user u
      LEFT JOIN user_income_monthly uim_month ON u.id = uim_month.user_id 
        AND uim_month.month = ?
      LEFT JOIN user_payout up ON uim_month.payout_id = up.id
      WHERE 1=1
    `;
    
    const params = [monthParam];
    
    // 角色筛选
    if (role === 'author_only') {
      query += ' AND u.is_author = 1';
    } else if (role === 'promoter_only') {
      query += ' AND EXISTS (SELECT 1 FROM commission_transaction WHERE user_id = u.id LIMIT 1)';
      query += ' AND u.is_author = 0';
    }
    // role === 'all' 时不添加筛选条件，显示所有有收入的用户
    
    if (userId) {
      query += ' AND u.id = ?';
      params.push(parseInt(userId));
    }
    
    // 只显示有收入的用户（本月有收入或累计有未支付）
    query += ` AND (
      uim_month.total_income_usd > 0 
      OR EXISTS (
        SELECT 1 FROM user_income_monthly 
        WHERE user_id = u.id AND payout_status = 'unpaid'
      )
    )`;
    
    // 状态筛选
    if (status && status !== 'all') {
      if (status === 'unpaid') {
        query += ' AND (uim_month.payout_status IS NULL OR uim_month.payout_status = \'unpaid\')';
      } else {
        query += ' AND uim_month.payout_status = ?';
        params.push(status);
      }
    }
    
    query += ' ORDER BY total_unpaid_amount DESC, u.id ASC';
    
    const [results] = await db.execute(query, params);
    
    // 在应用层进行未支付金额筛选
    let filteredResults = results;
    if (minUnpaid) {
      filteredResults = results.filter(row => 
        parseFloat(row.total_unpaid_amount || 0) >= parseFloat(minUnpaid)
      );
    }
    
    res.json({
      success: true,
      data: filteredResults.map(row => ({
        user_id: row.user_id,
        username: row.username,
        pen_name: row.pen_name,
        email: row.email,
        is_author: row.is_author === 1,
        is_promoter: row.is_promoter === 1,
        month_author_base_income: parseFloat(row.month_author_base_income || 0),
        month_reader_referral_income: parseFloat(row.month_reader_referral_income || 0),
        month_author_referral_income: parseFloat(row.month_author_referral_income || 0),
        month_total_income: parseFloat(row.month_total_income || 0),
        month_paid_amount: parseFloat(row.month_paid_amount || 0),
        month_unpaid_amount: parseFloat(row.month_unpaid_amount || 0),
        month_status: row.month_status || 'unpaid',
        total_unpaid_amount: parseFloat(row.total_unpaid_amount || 0),
        income_monthly_id: row.income_monthly_id || null,
        payout_id: row.payout_id || null,
        payout_method: row.payout_method || null // 支付方式
      }))
    });
  } catch (error) {
    console.error('获取用户结算总览错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取用户结算详情（支持所有用户：作者+推广者）
router.get('/user-settlement/detail/:userId', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { userId } = req.params;
    const { months = 6 } = req.query; // 默认显示最近6个月
    
    // 调试日志：输出原始参数
    console.log('[DEBUG] 用户结算详情 - 原始参数:');
    console.log('  userId (原始):', userId, '类型:', typeof userId);
    console.log('  months (原始):', months, '类型:', typeof months);
    
    // 确保 userId 是数字类型
    const userIdNum = parseInt(userId, 10);
    console.log('  userIdNum (parseInt后):', userIdNum, '类型:', typeof userIdNum, 'isNaN:', isNaN(userIdNum));
    
    if (isNaN(userIdNum)) {
      console.error('[ERROR] userId 解析失败:', userId);
      return res.status(400).json({
        success: false,
        message: '无效的用户ID'
      });
    }
    
    // 确保 months 是数字类型
    const monthsNum = parseInt(String(months), 10) || 6;
    console.log('  monthsNum (parseInt后):', monthsNum, '类型:', typeof monthsNum);
    
    // 确保 userIdNum 是整数（提前处理，供后续使用）
    const userIdInt = Number.isInteger(userIdNum) ? userIdNum : parseInt(String(userIdNum), 10);
    console.log('  userIdInt (最终):', userIdInt, '类型:', typeof userIdInt, 'isNaN:', isNaN(userIdInt));
    
    if (isNaN(userIdInt)) {
      console.error('[ERROR] userIdInt 验证失败:', userIdNum);
      return res.status(400).json({
        success: false,
        message: '用户ID无效'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    console.log('[DEBUG] 数据库连接成功');
    
    // 获取用户基本信息
    const [users] = await db.execute(
      'SELECT id, username, pen_name, email, is_author, created_at FROM user WHERE id = ?',
      [userIdInt]
    );
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    const user = users[0];
    
    // 判断是否推广者
    const [promoterCheck] = await db.execute(
      'SELECT COUNT(*) as count FROM commission_transaction WHERE user_id = ? LIMIT 1',
      [userIdInt]
    );
    const isPromoter = parseInt(promoterCheck[0].count || 0) > 0;
    
    // 计算累计未支付金额（一个用户一个月一笔支付单）
    const [unpaidResult] = await db.execute(
      `SELECT COALESCE(SUM(total_income_usd), 0) as total_unpaid
       FROM user_income_monthly
       WHERE user_id = ? AND payout_status = 'unpaid'`,
      [userIdInt]
    );
    const totalUnpaid = parseFloat(unpaidResult[0].total_unpaid || 0);
    
    // 获取默认收款账户
    const [accounts] = await db.execute(
      'SELECT * FROM user_payout_account WHERE user_id = ? AND is_default = 1 LIMIT 1',
      [userIdInt]
    );
    const defaultAccount = accounts.length > 0 ? accounts[0] : null;
    
    // 获取用户所有收款账户（用于发起支付时选择）
    const [allAccounts] = await db.execute(
      'SELECT * FROM user_payout_account WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
      [userIdInt]
    );
    
    // 获取最近N个月的收入汇总
    // 确保 months 是有效的整数，范围在 1-100 之间
    let monthsInt = 6; // 默认值
    if (monthsNum !== undefined && monthsNum !== null) {
      const parsed = parseInt(String(monthsNum), 10);
      console.log('  monthsNum 解析:', monthsNum, '->', parsed, 'isNaN:', isNaN(parsed));
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 100) {
        monthsInt = parsed;
      }
    }
    console.log('[DEBUG] 准备查询月度收入汇总:');
    console.log('  userIdInt:', userIdInt, '类型:', typeof userIdInt, 'Number.isInteger:', Number.isInteger(userIdInt));
    console.log('  monthsInt:', monthsInt, '类型:', typeof monthsInt, 'Number.isInteger:', Number.isInteger(monthsInt));
    console.log('  SQL参数数组:', [userIdInt, monthsInt]);
    console.log('  参数详细检查:');
    console.log('    userIdInt 值:', userIdInt);
    console.log('    userIdInt 类型:', typeof userIdInt);
    console.log('    userIdInt isNaN:', isNaN(userIdInt));
    console.log('    userIdInt Number.isInteger:', Number.isInteger(userIdInt));
    console.log('    monthsInt 值:', monthsInt);
    console.log('    monthsInt 类型:', typeof monthsInt);
    console.log('    monthsInt isNaN:', isNaN(monthsInt));
    console.log('    monthsInt Number.isInteger:', Number.isInteger(monthsInt));
    
    // 强制转换为整数（确保类型正确）
    const finalUserId = Number.isInteger(userIdInt) ? userIdInt : Math.floor(Number(userIdInt));
    const finalMonths = Number.isInteger(monthsInt) ? monthsInt : Math.floor(Number(monthsInt));
    console.log('[DEBUG] 最终参数（强制转换后）:');
    console.log('  finalUserId:', finalUserId, '类型:', typeof finalUserId);
    console.log('  finalMonths:', finalMonths, '类型:', typeof finalMonths);
    
    // 验证参数范围（防止SQL注入）
    if (finalMonths < 1 || finalMonths > 100) {
      throw new Error('months 参数必须在 1-100 之间');
    }
    if (finalUserId < 1) {
      throw new Error('userId 必须大于 0');
    }
    
    let monthlyIncomes;
    try {
      // 方法1: 尝试使用 query 方法而不是 execute（LIMIT 参数可能有问题）
      console.log('[DEBUG] 尝试使用 query 方法执行查询');
      const sql = `SELECT 
        id,
        month,
        author_base_income_usd,
        reader_referral_income_usd,
        author_referral_income_usd,
        total_income_usd,
        CASE WHEN payout_status = 'paid' THEN 0 ELSE total_income_usd END as unpaid_amount,
        payout_status,
        payout_id
       FROM user_income_monthly
       WHERE user_id = ?
       ORDER BY month DESC
       LIMIT ${finalMonths}`;
      
      console.log('[DEBUG] SQL语句:', sql);
      console.log('[DEBUG] 参数:', [finalUserId]);
      
      const [rows] = await db.query(sql, [finalUserId]);
      monthlyIncomes = rows;
      console.log('[DEBUG] 月度收入汇总查询成功，返回', monthlyIncomes.length, '条记录');
    } catch (queryError) {
      console.error('[ERROR] 月度收入汇总查询失败:');
      console.error('  错误信息:', queryError.message);
      console.error('  错误代码:', queryError.code);
      console.error('  错误SQL状态:', queryError.sqlState);
      console.error('  原始SQL参数:', [userIdInt, monthsInt]);
      console.error('  最终SQL参数:', [finalUserId, finalMonths]);
      console.error('  参数类型检查:');
      console.error('    userIdInt:', typeof userIdInt, 'isNaN:', isNaN(userIdInt), 'Number.isInteger:', Number.isInteger(userIdInt));
      console.error('    monthsInt:', typeof monthsInt, 'isNaN:', isNaN(monthsInt), 'Number.isInteger:', Number.isInteger(monthsInt));
      console.error('    finalUserId:', typeof finalUserId, 'isNaN:', isNaN(finalUserId), 'Number.isInteger:', Number.isInteger(finalUserId));
      console.error('    finalMonths:', typeof finalMonths, 'isNaN:', isNaN(finalMonths), 'Number.isInteger:', Number.isInteger(finalMonths));
      
      // 如果 query 方法也失败，尝试使用 execute 但不用 LIMIT 参数
      console.log('[DEBUG] 尝试备用方案：使用 execute 但 LIMIT 直接拼接');
      try {
        const sqlWithLimit = `SELECT 
          id,
          month,
          author_base_income_usd,
          reader_referral_income_usd,
          author_referral_income_usd,
          total_income_usd,
          CASE WHEN payout_status = 'paid' THEN 0 ELSE total_income_usd END as unpaid_amount,
          payout_status,
          payout_id
         FROM user_income_monthly
         WHERE user_id = ?
         ORDER BY month DESC
         LIMIT ${finalMonths}`;
        const [rows] = await db.execute(sqlWithLimit, [finalUserId]);
        monthlyIncomes = rows;
        console.log('[DEBUG] 备用方案成功，返回', monthlyIncomes.length, '条记录');
      } catch (fallbackError) {
        console.error('[ERROR] 备用方案也失败:', fallbackError.message);
        throw queryError; // 抛出原始错误
      }
    }
    
    // 获取支付记录（一个用户一个月一笔支付单）
    const [payouts] = await db.execute(
      `SELECT 
        up.*
       FROM user_payout up
       WHERE up.user_id = ?
       ORDER BY up.created_at DESC
       LIMIT 50`,
      [userIdInt]
    );
    
    // 安全解析 JSON 的辅助函数（处理字符串和对象两种情况）
    const safeParseJSON = (value, defaultValue = {}) => {
      if (!value) return defaultValue;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch (e) {
          console.warn('[WARN] JSON解析失败，使用默认值:', e.message);
          return defaultValue;
        }
      }
      // 如果已经是对象，直接返回
      if (typeof value === 'object') {
        return value;
      }
      return defaultValue;
    };

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          pen_name: user.pen_name,
          email: user.email,
          is_author: user.is_author === 1,
          is_promoter: isPromoter,
          created_at: user.created_at
        },
        total_unpaid_amount: totalUnpaid,
        default_account: defaultAccount ? {
          id: defaultAccount.id,
          method: defaultAccount.method,
          account_label: defaultAccount.account_label,
          account_data: safeParseJSON(defaultAccount.account_data)
        } : null,
        all_accounts: allAccounts.map(acc => ({
          id: acc.id,
          method: acc.method,
          account_label: acc.account_label,
          account_data: safeParseJSON(acc.account_data),
          is_default: acc.is_default === 1
        })),
        monthly_incomes: monthlyIncomes.map(row => ({
          id: row.id,
          month: row.month,
          author_base_income_usd: parseFloat(row.author_base_income_usd || 0),
          reader_referral_income_usd: parseFloat(row.reader_referral_income_usd || 0),
          author_referral_income_usd: parseFloat(row.author_referral_income_usd || 0),
          total_income_usd: parseFloat(row.total_income_usd || 0),
          unpaid_amount: parseFloat(row.unpaid_amount || 0),
          payout_status: row.payout_status,
          payout_id: row.payout_id || null
        })),
        payouts: await Promise.all(payouts.map(async (row) => {
          // 查询对应的gateway_transaction
          let gatewayTransaction = null;
          if (row.gateway_tx_id) {
            try {
              const [gatewayRows] = await db.execute(
                'SELECT * FROM payout_gateway_transaction WHERE id = ?',
                [row.gateway_tx_id]
              );
              if (gatewayRows.length > 0) {
                const gt = gatewayRows[0];
                gatewayTransaction = {
                  id: gt.id,
                  provider: gt.provider,
                  provider_tx_id: gt.provider_tx_id,
                  status: gt.status,
                  base_amount_usd: parseFloat(gt.base_amount_usd || 0),
                  payout_currency: gt.payout_currency || 'USD',
                  payout_amount: parseFloat(gt.payout_amount || 0),
                  fx_rate: parseFloat(gt.fx_rate || 1.0),
                  request_payload: gt.request_payload ? safeParseJSON(gt.request_payload, null) : null,
                  response_payload: gt.response_payload ? safeParseJSON(gt.response_payload, null) : null,
                  error_code: gt.error_code,
                  error_message: gt.error_message,
                  created_at: gt.created_at,
                  updated_at: gt.updated_at
                };
              }
            } catch (err) {
              console.error('[WARN] 查询gateway_transaction失败:', err.message);
            }
          }
          
          return {
            id: row.id,
            month: row.month,
            income_monthly_id: row.income_monthly_id,
            base_amount_usd: parseFloat(row.base_amount_usd || 0),
            payout_currency: row.payout_currency || 'USD',
            payout_amount: parseFloat(row.payout_amount || 0),
            fx_rate: parseFloat(row.fx_rate || (row.payout_currency === 'USD' ? 1.0 : 0)),
            status: row.status,
            method: row.method,
            account_info: row.account_info ? safeParseJSON(row.account_info, null) : null,
            requested_at: row.requested_at,
            paid_at: row.paid_at,
            admin_id: row.admin_id || null,
            note: row.note,
            gateway_tx_id: row.gateway_tx_id || null,
            gateway_transaction: gatewayTransaction
          };
        }))
      }
    });
  } catch (error) {
    console.error('[ERROR] 获取用户结算详情错误:');
    console.error('  错误类型:', error.constructor.name);
    console.error('  错误消息:', error.message);
    console.error('  错误代码:', error.code);
    console.error('  错误SQL状态:', error.sqlState);
    console.error('  错误堆栈:', error.stack);
    if (error.sql) {
      console.error('  SQL语句:', error.sql);
    }
    if (error.sqlMessage) {
      console.error('  SQL消息:', error.sqlMessage);
    }
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message,
      debug: process.env.NODE_ENV === 'development' ? {
        code: error.code,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage
      } : undefined
    });
  } finally {
    if (db) {
      console.log('[DEBUG] 关闭数据库连接');
      await db.end();
    }
  }
});

// 发起支付（带防重复支付逻辑）
router.post('/settlements/:incomeMonthlyId/pay', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const incomeMonthlyId = parseInt(req.params.incomeMonthlyId);
    const adminId = req.admin?.id || null; // 从认证中间件获取
    
    if (isNaN(incomeMonthlyId)) {
      return res.status(400).json({
        success: false,
        message: '无效的收入记录ID'
      });
    }
    
    const { method = 'paypal', account_id, payout_currency = 'USD', fx_rate = '1.0', note } = req.body;
    
    if (!account_id) {
      return res.status(400).json({
        success: false,
        message: '缺少收款账户ID'
      });
    }
    
    const accountIdNum = parseInt(account_id);
    const payoutCurrency = String(payout_currency).toUpperCase();
    let fxRate = parseFloat(fx_rate);
    
    // 验证币种
    if (!['USD', 'CNY'].includes(payoutCurrency)) {
      return res.status(400).json({
        success: false,
        message: '支付币种必须是 USD 或 CNY'
      });
    }
    
    // USD 时汇率固定为 1.0
    if (payoutCurrency === 'USD') {
      fxRate = 1.0;
    } else if (isNaN(fxRate) || fxRate <= 0) {
      return res.status(400).json({
        success: false,
        message: 'CNY 支付需要提供有效的汇率'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    await db.beginTransaction();
    
    try {
      // 1. 锁住并获取月度收入记录
      const [incomeRows] = await db.execute(
        'SELECT * FROM user_income_monthly WHERE id = ? FOR UPDATE',
        [incomeMonthlyId]
      );
      
      if (incomeRows.length === 0) {
        await db.rollback();
        return res.status(404).json({
          success: false,
          message: '收入记录不存在'
        });
      }
      
      const incomeMonthly = incomeRows[0];
      
      // 2. 检查 payout_status，防止重复支付
      if (incomeMonthly.payout_status === 'paid') {
        await db.rollback();
        return res.status(400).json({
          success: false,
          message: '该结算已经支付完成，请勿重复发起。可使用【同步 PayPal 状态】刷新结果。'
        });
      }
      
      // 检查是否已有正在处理的支付单
      if (incomeMonthly.payout_id) {
        const [existingPayoutRows] = await db.execute(
          'SELECT status FROM user_payout WHERE id = ?',
          [incomeMonthly.payout_id]
        );
        
        if (existingPayoutRows.length > 0) {
          const existingPayoutStatus = existingPayoutRows[0].status;
          if (existingPayoutStatus === 'paid' || existingPayoutStatus === 'processing') {
            await db.rollback();
            return res.status(400).json({
              success: false,
              message: '该结算已经发起支付或已支付，请勿重复发起。可使用【同步 PayPal 状态】刷新结果。'
            });
          }
        }
      }
      
      // 3. 获取收款账户信息
      const [accounts] = await db.execute(
        'SELECT * FROM user_payout_account WHERE id = ? AND user_id = ?',
        [accountIdNum, incomeMonthly.user_id]
      );
      
      if (accounts.length === 0) {
        await db.rollback();
        return res.status(404).json({
          success: false,
          message: '收款账户不存在'
        });
      }
      
      const account = accounts[0];
      
      // 安全解析 JSON 的辅助函数
      const safeParseJSON = (value, defaultValue = {}) => {
        if (!value) return defaultValue;
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch (e) {
            return defaultValue;
          }
        }
        if (typeof value === 'object') {
          return value;
        }
        return defaultValue;
      };
      
      const accountInfo = {
        account_id: account.id,
        method: account.method,
        account_label: account.account_label,
        account_data: safeParseJSON(account.account_data)
      };
      
      // 4. 计算实际支付金额
      const baseAmountUsd = parseFloat(incomeMonthly.total_income_usd || 0);
      const payoutAmount = Math.round(baseAmountUsd * fxRate * 100) / 100;
      
      // 5. 查找或创建 user_payout
      let payout = null;
      let payoutId;
      
      if (incomeMonthly.payout_id) {
        // 已有 payout_id，检查并更新
        const [payoutRows] = await db.execute(
          'SELECT * FROM user_payout WHERE id = ? FOR UPDATE',
          [incomeMonthly.payout_id]
        );
        
        if (payoutRows.length === 0) {
          await db.rollback();
          return res.status(404).json({
            success: false,
            message: '支付单不存在'
          });
        }
        
        payout = payoutRows[0];
        
        // 检查支付单状态
        if (payout.status === 'paid' || payout.status === 'processing') {
          await db.rollback();
          return res.status(400).json({
            success: false,
            message: '该结算已经发起支付或已支付，请勿重复发起。可使用【同步 PayPal 状态】刷新结果。'
          });
        }
        
        // 如果是 failed / cancelled，可以重试
        payoutId = payout.id;
        const finalAdminId = adminId || null;
        
        // 更新支付单状态为 processing
        await db.execute(
          `UPDATE user_payout
           SET status = 'processing',
               requested_at = NOW(),
               updated_at = NOW(),
               admin_id = ?
           WHERE id = ?`,
          [finalAdminId, payoutId]
        );
      } else {
        // 创建新的支付单
        // 确保所有参数都不是 undefined
        const userId = incomeMonthly.user_id || null;
        const month = incomeMonthly.month || null;
        const finalAdminId = adminId || null;
        const finalNote = note || null;
        
        const [result] = await db.execute(
          `INSERT INTO user_payout (
            user_id, month, income_monthly_id,
            base_amount_usd, payout_currency, payout_amount, fx_rate,
            status, method, account_info, requested_at, admin_id, note
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'processing', ?, ?, NOW(), ?, ?)`,
          [
            userId,
            month,
            incomeMonthlyId,
            baseAmountUsd,
            payoutCurrency,
            payoutAmount,
            fxRate,
            method,
            JSON.stringify(accountInfo),
            finalAdminId,
            finalNote
          ]
        );
        
        payoutId = result.insertId;
        
        // 更新 user_income_monthly 的 payout_id（不更新 payout_status，保持 'unpaid'，直到支付完成）
        await db.execute(
          `UPDATE user_income_monthly
           SET payout_id = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [payoutId, incomeMonthlyId]
        );
      }
      
      // 6. 创建 payout_gateway_transaction
      const requestPayload = {
        amount: payoutAmount,
        method: method,
        currency: payoutCurrency,
        payout_id: payoutId,
        account_info: accountInfo
      };
      
      const [gatewayResult] = await db.execute(
        `INSERT INTO payout_gateway_transaction (
          provider, provider_tx_id, status,
          base_amount_usd, payout_currency, payout_amount, fx_rate,
          request_payload, created_at
        ) VALUES (?, NULL, 'created', ?, ?, ?, ?, ?, NOW())`,
        [
          method,
          baseAmountUsd,
          payoutCurrency,
          payoutAmount,
          fxRate,
          JSON.stringify(requestPayload)
        ]
      );
      
      const gatewayTxId = gatewayResult.insertId;
      
      // 7. 更新 user_payout 的 gateway_tx_id
      await db.execute(
        `UPDATE user_payout
         SET gateway_tx_id = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [gatewayTxId, payoutId]
      );
      
      // 8. 调用支付API（PayPal/支付宝/微信）
      let paymentResult = null;
      if (method.toLowerCase() === 'paypal') {
        try {
          const accountData = accountInfo.account_data || {};
          const email = accountData.email;
          
          if (!email) {
            throw new Error('PayPal账户信息中缺少email字段');
          }
          
          // 使用幂等的 sender_batch_id（每个用户每个月一个固定ID）
          const monthStr = incomeMonthly.month ? new Date(incomeMonthly.month).toISOString().substring(0, 7).replace('-', '') : '';
          const senderBatchId = `PAYOUT_USER_${incomeMonthly.user_id}_${monthStr}`;
          
          const payoutNote = `Payout for ${incomeMonthly.month} - User ID: ${incomeMonthly.user_id}`;
          paymentResult = await paypalService.createPayout(
            email,
            payoutAmount,
            payoutCurrency,
            payoutNote,
            senderBatchId // 传递幂等ID
          );
          
          console.log('[发起支付] PayPal API返回结果:', JSON.stringify(paymentResult, null, 2));
        } catch (paypalError) {
          console.error('[发起支付] PayPal调用错误:', paypalError);
          paymentResult = {
            success: false,
            message: `PayPal支付失败: ${paypalError.message}`,
            error: paypalError
          };
        }
      } else if (method.toLowerCase() === 'alipay') {
        // 调用支付宝转账API
        try {
          const accountData = accountInfo.account_data || {};
          const payeeAccount = accountData.account || accountData.login_id; // 支付宝账号（手机号或邮箱）
          const payeeRealName = accountData.name || accountData.real_name || ''; // 收款方真实姓名（可选但建议提供）
          
          if (!payeeAccount) {
            throw new Error('支付宝账户信息中缺少account或login_id字段');
          }
          
          // 生成商户订单号
          // 策略：
          // 1. 检查是否已存在成功的支付记录，如果存在且参数一致，直接返回成功
          // 2. 如果是重试失败的支付（failed/cancelled状态），使用带时间戳的唯一订单号
          // 3. 否则，使用固定的订单号（幂等性）
          const monthStr = incomeMonthly.month ? new Date(incomeMonthly.month).toISOString().substring(0, 7).replace('-', '') : '';
          let outBizNo = `ALIPAY_USER_${incomeMonthly.user_id}_${monthStr}`;
          
          // 计算转账金额（需要在检查之前计算，用于参数比较）
          const transferAmount = payoutCurrency === 'CNY' ? payoutAmount : payoutAmount * fxRate;
          const transferRemark = `转账 - ${incomeMonthly.month} - 用户ID: ${incomeMonthly.user_id}`;
          
          // 检查是否已存在成功的支付宝支付记录
          if (payoutId && payout && payout.gateway_tx_id) {
            const [existingTx] = await db.execute(
              `SELECT provider_tx_id, status, response_payload, request_payload
               FROM payout_gateway_transaction 
               WHERE id = ? AND provider = 'alipay'`,
              [payout.gateway_tx_id]
            );
            
            if (existingTx.length > 0 && existingTx[0].status === 'succeeded') {
              // 已存在成功的支付记录，检查参数是否一致
              try {
                const responsePayload = typeof existingTx[0].response_payload === 'string' 
                  ? JSON.parse(existingTx[0].response_payload) 
                  : existingTx[0].response_payload;
                const requestPayload = typeof existingTx[0].request_payload === 'string'
                  ? JSON.parse(existingTx[0].request_payload)
                  : existingTx[0].request_payload;
                
                // 检查金额和收款账号是否一致
                const existingAmount = parseFloat(responsePayload.trans_amount || responsePayload.amount || requestPayload?.amount || 0);
                const existingAccount = responsePayload.payee_info?.identity || requestPayload?.account_info?.account_data?.account || requestPayload?.account_info?.account_data?.login_id;
                const currentAccount = payeeAccount;
                
                if (Math.abs(existingAmount - transferAmount) < 0.01 && existingAccount === currentAccount) {
                  // 参数一致，直接返回成功，不再次调用API
                  console.log('[发起支付] 已存在成功的支付记录且参数一致，直接返回成功');
                  paymentResult = {
                    success: true,
                    order_id: responsePayload.orderId || responsePayload.order_id,
                    orderId: responsePayload.orderId || responsePayload.order_id,
                    payFundOrderId: responsePayload.payFundOrderId,
                    out_biz_no: responsePayload.outBizNo || responsePayload.out_biz_no,
                    pay_date: responsePayload.transDate || responsePayload.pay_date,
                    status: 'SUCCESS',
                    message: '转账成功（已存在成功记录）',
                    response: responsePayload
                  };
                  console.log('[发起支付] 支付宝API返回结果（复用）:', JSON.stringify(paymentResult, null, 2));
                  // 跳过API调用，直接进入结果处理
                } else {
                  // 参数不一致，使用新的订单号
                  outBizNo = `ALIPAY_USER_${incomeMonthly.user_id}_${monthStr}_${Date.now()}`;
                  console.log('[发起支付] 参数不一致，使用新的唯一订单号:', outBizNo, {
                    existingAmount,
                    currentAmount: transferAmount,
                    existingAccount,
                    currentAccount
                  });
                }
              } catch (e) {
                console.warn('[发起支付] 解析已有支付记录失败，使用新订单号:', e.message);
                // 解析失败，使用新订单号
                outBizNo = `ALIPAY_USER_${incomeMonthly.user_id}_${monthStr}_${Date.now()}`;
              }
            } else if (payout && (payout.status === 'failed' || payout.status === 'cancelled')) {
              // 重试失败的支付，使用带时间戳的唯一订单号
              outBizNo = `ALIPAY_USER_${incomeMonthly.user_id}_${monthStr}_${Date.now()}`;
              console.log('[发起支付] 重试失败支付，使用新的唯一订单号:', outBizNo);
            } else {
              // 首次支付或正常支付，使用固定订单号（幂等性）
              console.log('[发起支付] 使用固定订单号（幂等性）:', outBizNo);
            }
          } else {
            // 首次支付，使用固定订单号
            console.log('[发起支付] 首次支付，使用固定订单号（幂等性）:', outBizNo);
          }
          
          // 如果 paymentResult 已经设置（复用成功记录），跳过API调用
          if (!paymentResult || !paymentResult.success) {
            // 调用支付宝API
            paymentResult = await alipayService.transferToAccount(
              payeeAccount,
              transferAmount,
              transferRemark,
              outBizNo,
              payeeRealName
            );
            
            console.log('[发起支付] 支付宝API返回结果:', JSON.stringify(paymentResult, null, 2));
          }
        } catch (alipayError) {
          console.error('[发起支付] 支付宝调用错误:', alipayError);
          paymentResult = {
            success: false,
            message: `支付宝支付失败: ${alipayError.message}`,
            error: alipayError
          };
        }
      } else if (method.toLowerCase() === 'wechat') {
        // TODO: 调用微信企业付款API
        // 目前先模拟成功
        paymentResult = {
          success: true,
          tx_id: `WECHAT_${Date.now()}`,
          message: '微信支付已发起（模拟）'
        };
      } else if (method.toLowerCase() === 'bank_transfer' || method.toLowerCase() === 'manual') {
        // 银行转账或手动支付，不自动发起
        await db.commit();
        return res.json({
          success: true,
          message: '支付订单已创建，请手动完成支付',
          data: {
            payout_id: payoutId,
            gateway_tx_id: gatewayTxId,
            base_amount_usd: baseAmountUsd,
            payout_currency: payoutCurrency,
            payout_amount: payoutAmount,
            fx_rate: fxRate,
            requires_manual_payment: true
          }
        });
      }
      
      // 9. 根据支付结果更新数据库
      if (paymentResult && paymentResult.success) {
        // 更新 gateway_transaction
        // 支付宝返回的字段：orderId, payFundOrderId, outBizNo
        // PayPal返回的字段：batch_id, payout_item_id, tx_id
        const providerTxId = paymentResult.order_id || paymentResult.orderId || 
                             paymentResult.payFundOrderId || paymentResult.tx_id || 
                             paymentResult.batch_id || paymentResult.payout_item_id || null;
        let dbStatus = 'processing';
        
        // PayPal状态处理
        if (method.toLowerCase() === 'paypal') {
          const paypalStatus = paymentResult.status || 'PENDING';
          if (paypalStatus === 'SUCCESS') {
            dbStatus = 'succeeded';
          } else if (paypalStatus === 'DENIED' || paypalStatus === 'FAILED') {
            dbStatus = 'failed';
          }
        } 
        // 支付宝状态处理（支付宝转账通常是即时到账，返回成功即表示成功）
        else if (method.toLowerCase() === 'alipay') {
          dbStatus = 'succeeded'; // 支付宝转账成功即表示已完成
        }
        
        await db.execute(
          `UPDATE payout_gateway_transaction
           SET provider_tx_id = ?,
               status = ?,
               response_payload = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [
            providerTxId || null, // 确保不是 undefined
            dbStatus,
            JSON.stringify(paymentResult),
            gatewayTxId
          ]
        );
        
        // 如果支付成功，更新支付单和收入记录
        if (dbStatus === 'succeeded') {
          await db.execute(
            `UPDATE user_payout
             SET status = 'paid',
                 paid_at = NOW(),
                 updated_at = NOW()
             WHERE id = ?`,
            [payoutId]
          );
          
          // 根据支付币种更新对应的支付金额字段
          if (payoutCurrency === 'CNY') {
            // 人民币支付，更新 paid_amount_rmb
            await db.execute(
              `UPDATE user_income_monthly
               SET payout_status = 'paid',
                   paid_amount_rmb = ?,
                   updated_at = NOW()
               WHERE id = ?`,
              [payoutAmount, incomeMonthlyId]
            );
          } else {
            // 美元支付，更新 paid_amount_usd
            await db.execute(
              `UPDATE user_income_monthly
               SET payout_status = 'paid',
                   paid_amount_usd = ?,
                   updated_at = NOW()
               WHERE id = ?`,
              [payoutAmount, incomeMonthlyId]
            );
          }
        }
      } else if (paymentResult && !paymentResult.success) {
        // 支付失败
        await db.execute(
          `UPDATE payout_gateway_transaction
           SET status = 'failed',
               error_message = ?,
               error_code = ?,
               response_payload = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [
            paymentResult.message || '支付失败',
            paymentResult.code || paymentResult.sub_code || null,
            JSON.stringify(paymentResult),
            gatewayTxId || null // 确保不是 undefined
          ]
        );
        
        await db.execute(
          `UPDATE user_payout
           SET status = 'failed',
               updated_at = NOW()
           WHERE id = ?`,
          [payoutId]
        );
        
        // user_income_monthly.payout_status 不支持 'failed'，支付失败时保持 'unpaid'
      }
      
      await db.commit();
      
      // 返回结果
      let successMessage = '支付订单已创建';
      if (paymentResult && paymentResult.success) {
        if (method.toLowerCase() === 'paypal') {
          successMessage = paymentResult.status === 'SUCCESS' 
            ? 'PayPal支付已成功完成' 
            : 'PayPal支付已发起，等待处理';
        } else if (method.toLowerCase() === 'alipay') {
          successMessage = '支付宝转账已成功完成';
        } else if (method.toLowerCase() === 'wechat') {
          successMessage = '微信支付已发起';
        }
      } else if (paymentResult && !paymentResult.success) {
        successMessage = paymentResult.message || '支付失败';
      }
      
      res.json({
        success: paymentResult ? paymentResult.success : true,
        message: successMessage,
        data: {
          payout_id: payoutId,
          gateway_tx_id: gatewayTxId,
          base_amount_usd: baseAmountUsd,
          payout_currency: payoutCurrency,
          payout_amount: payoutAmount,
          fx_rate: fxRate,
          provider_tx_id: paymentResult?.order_id || paymentResult?.tx_id || paymentResult?.batch_id || null
        }
      });
    } catch (error) {
      await db.rollback();
      throw error;
    }
  } catch (error) {
    console.error('发起支付错误:', error);
    res.status(500).json({
      success: false,
      message: '发起支付失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 同步PayPal支付状态（只查询，不新建支付）
router.post('/settlements/:incomeMonthlyId/sync-paypal', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const incomeMonthlyId = parseInt(req.params.incomeMonthlyId);
    
    if (isNaN(incomeMonthlyId)) {
      return res.status(400).json({
        success: false,
        message: '无效的收入记录ID'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    // 1. 查询 user_income_monthly
    const [incomeRows] = await db.execute(
      'SELECT * FROM user_income_monthly WHERE id = ?',
      [incomeMonthlyId]
    );
    
    if (incomeRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '收入记录不存在'
      });
    }
    
    const incomeMonthly = incomeRows[0];
    
    // 2. 检查是否有 payout_id
    if (!incomeMonthly.payout_id) {
      return res.status(400).json({
        success: false,
        message: '尚未发起支付，无法同步状态'
      });
    }
    
    // 3. 查询 user_payout
    const [payoutRows] = await db.execute(
      'SELECT * FROM user_payout WHERE id = ?',
      [incomeMonthly.payout_id]
    );
    
    if (payoutRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '支付单不存在'
      });
    }
    
    const payout = payoutRows[0];
    
    // 4. 检查支付方式
    if (payout.method.toLowerCase() !== 'paypal') {
      return res.status(400).json({
        success: false,
        message: '该支付单不是PayPal支付'
      });
    }
    
    // 5. 检查是否有 gateway_tx_id
    if (!payout.gateway_tx_id) {
      return res.status(400).json({
        success: false,
        message: '该支付单还没有网关交易记录'
      });
    }
    
    // 6. 查询 gateway_transaction
    const [gatewayRows] = await db.execute(
      'SELECT * FROM payout_gateway_transaction WHERE id = ?',
      [payout.gateway_tx_id]
    );
    
    if (gatewayRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '网关交易记录不存在'
      });
    }
    
    const gatewayTx = gatewayRows[0];
    
    // 7. 从 response_payload 或 provider_tx_id 获取 batch_id
    let batchId = null;
    if (gatewayTx.response_payload) {
      try {
        const responsePayload = typeof gatewayTx.response_payload === 'string'
          ? JSON.parse(gatewayTx.response_payload)
          : gatewayTx.response_payload;
        batchId = responsePayload.batch_id || gatewayTx.provider_tx_id;
      } catch (e) {
        batchId = gatewayTx.provider_tx_id;
      }
    } else {
      batchId = gatewayTx.provider_tx_id;
    }
    
    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: '未找到PayPal批次ID'
      });
    }
    
    // 8. 调用PayPal API查询状态
    const paypalStatus = await paypalService.getPayoutStatus(batchId);
    
    const batchStatus = paypalStatus.batch_header?.batch_status || 'UNKNOWN';
    
    // 9. 根据PayPal状态更新数据库
    let dbStatus = 'processing';
    if (batchStatus === 'SUCCESS') {
      dbStatus = 'succeeded';
    } else if (batchStatus === 'DENIED' || batchStatus === 'FAILED') {
      dbStatus = 'failed';
    }
    
    await db.beginTransaction();
    
    try {
      // 更新 gateway_transaction
      await db.execute(
        `UPDATE payout_gateway_transaction
         SET status = ?,
             response_payload = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [
          dbStatus,
          JSON.stringify({
            ...paypalStatus,
            synced_at: new Date().toISOString(),
            batch_status: batchStatus
          }),
          gatewayTx.id
        ]
      );
      
      // 如果PayPal状态为SUCCESS，更新user_payout和user_income_monthly
      if (batchStatus === 'SUCCESS') {
        await db.execute(
          `UPDATE user_payout
           SET status = 'paid',
               paid_at = NOW(),
               updated_at = NOW()
           WHERE id = ?`,
          [payout.id]
        );
        
        // 根据支付币种更新对应的支付金额字段
        if (payout.payout_currency === 'CNY') {
          // 人民币支付，更新 paid_amount_rmb
          await db.execute(
            `UPDATE user_income_monthly
             SET payout_status = 'paid',
                 paid_amount_rmb = ?,
                 updated_at = NOW()
             WHERE id = ?`,
            [payout.payout_amount, incomeMonthlyId]
          );
        } else {
          // 美元支付，更新 paid_amount_usd
          await db.execute(
            `UPDATE user_income_monthly
             SET payout_status = 'paid',
                 paid_amount_usd = ?,
                 updated_at = NOW()
             WHERE id = ?`,
            [payout.payout_amount, incomeMonthlyId]
          );
        }
      } else if (batchStatus === 'DENIED' || batchStatus === 'FAILED') {
        // 如果失败，更新user_payout状态
        await db.execute(
          `UPDATE user_payout
           SET status = 'failed',
               updated_at = NOW()
           WHERE id = ?`,
          [payout.id]
        );
        
        // user_income_monthly.payout_status 不支持 'failed'，支付失败时保持 'unpaid'
        // 不需要更新 payout_status，因为支付失败意味着还是未支付状态
      }
      
      await db.commit();
      
      // 10. 重新查询完整数据并返回
      const [updatedIncomeRows] = await db.execute(
        'SELECT * FROM user_income_monthly WHERE id = ?',
        [incomeMonthlyId]
      );
      
      const [updatedPayoutRows] = await db.execute(
        'SELECT * FROM user_payout WHERE id = ?',
        [payout.id]
      );
      
      const [updatedGatewayRows] = await db.execute(
        'SELECT * FROM payout_gateway_transaction WHERE id = ?',
        [gatewayTx.id]
      );
      
      const safeParseJSON = (value, defaultValue = null) => {
        if (!value) return defaultValue;
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch (e) {
            return defaultValue;
          }
        }
        if (typeof value === 'object') {
          return value;
        }
        return defaultValue;
      };
      
      const updatedIncomeMonthly = updatedIncomeRows[0];
      const updatedPayout = updatedPayoutRows[0];
      const updatedGatewayTx = updatedGatewayRows[0];
      
      res.json({
        success: true,
        message: `同步成功，当前状态: ${dbStatus === 'succeeded' ? '已支付' : dbStatus === 'failed' ? '支付失败' : '处理中'}`,
        data: {
          income_monthly: {
            id: updatedIncomeMonthly.id,
            user_id: updatedIncomeMonthly.user_id,
            month: updatedIncomeMonthly.month,
            author_base_income_usd: parseFloat(updatedIncomeMonthly.author_base_income_usd || 0),
            reader_referral_income_usd: parseFloat(updatedIncomeMonthly.reader_referral_income_usd || 0),
            author_referral_income_usd: parseFloat(updatedIncomeMonthly.author_referral_income_usd || 0),
            total_income_usd: parseFloat(updatedIncomeMonthly.total_income_usd || 0),
            paid_amount_usd: parseFloat(updatedIncomeMonthly.paid_amount_usd || 0),
            payout_status: updatedIncomeMonthly.payout_status,
            payout_id: updatedIncomeMonthly.payout_id || null,
            created_at: updatedIncomeMonthly.created_at,
            updated_at: updatedIncomeMonthly.updated_at
          },
          payout: {
            id: updatedPayout.id,
            user_id: updatedPayout.user_id,
            month: updatedPayout.month,
            income_monthly_id: updatedPayout.income_monthly_id,
            base_amount_usd: parseFloat(updatedPayout.base_amount_usd || 0),
            payout_currency: updatedPayout.payout_currency || 'USD',
            payout_amount: parseFloat(updatedPayout.payout_amount || 0),
            fx_rate: parseFloat(updatedPayout.fx_rate || (updatedPayout.payout_currency === 'USD' ? 1.0 : 0)),
            status: updatedPayout.status,
            method: updatedPayout.method,
            account_info: safeParseJSON(updatedPayout.account_info, null),
            requested_at: updatedPayout.requested_at,
            paid_at: updatedPayout.paid_at,
            admin_id: updatedPayout.admin_id || null,
            note: updatedPayout.note,
            gateway_tx_id: updatedPayout.gateway_tx_id || null,
            created_at: updatedPayout.created_at,
            updated_at: updatedPayout.updated_at
          },
          gateway_tx: {
            id: updatedGatewayTx.id,
            provider: updatedGatewayTx.provider,
            provider_tx_id: updatedGatewayTx.provider_tx_id,
            status: updatedGatewayTx.status,
            base_amount_usd: parseFloat(updatedGatewayTx.base_amount_usd || 0),
            payout_currency: updatedGatewayTx.payout_currency || 'USD',
            payout_amount: parseFloat(updatedGatewayTx.payout_amount || 0),
            fx_rate: parseFloat(updatedGatewayTx.fx_rate || 1.0),
            request_payload: safeParseJSON(updatedGatewayTx.request_payload, null),
            response_payload: safeParseJSON(updatedGatewayTx.response_payload, null),
            error_code: updatedGatewayTx.error_code,
            error_message: updatedGatewayTx.error_message,
            created_at: updatedGatewayTx.created_at,
            updated_at: updatedGatewayTx.updated_at
          }
        }
      });
    } catch (error) {
      await db.rollback();
      throw error;
    }
  } catch (error) {
    console.error('同步PayPal支付状态错误:', error);
    res.status(500).json({
      success: false,
      message: '同步失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取结算详情（根据incomeMonthlyId，包含user_income_monthly, user_payout, payout_gateway_transaction）
router.get('/settlements/:incomeMonthlyId/detail', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const incomeMonthlyId = parseInt(req.params.incomeMonthlyId);
    
    if (isNaN(incomeMonthlyId)) {
      return res.status(400).json({
        success: false,
        message: '无效的收入记录ID'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    // 1. 查询user_income_monthly
    const [incomeRows] = await db.execute(
      'SELECT * FROM user_income_monthly WHERE id = ?',
      [incomeMonthlyId]
    );
    
    if (incomeRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '收入记录不存在'
      });
    }
    
    const incomeMonthly = incomeRows[0];
    
    // 2. 获取用户基本信息
    const [users] = await db.execute(
      'SELECT id, username, pen_name, email, is_author, created_at FROM user WHERE id = ?',
      [incomeMonthly.user_id]
    );
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    const user = users[0];
    
    // 判断是否推广者
    const [promoterCheck] = await db.execute(
      'SELECT COUNT(*) as count FROM commission_transaction WHERE user_id = ? LIMIT 1',
      [user.id]
    );
    const isPromoter = parseInt(promoterCheck[0].count || 0) > 0;
    
    // 获取默认收款账户
    const [accounts] = await db.execute(
      'SELECT * FROM user_payout_account WHERE user_id = ? AND is_default = 1 LIMIT 1',
      [user.id]
    );
    const defaultAccount = accounts.length > 0 ? accounts[0] : null;
    
    // 3. 查询user_payout（通过payout_id）
    let payout = null;
    if (incomeMonthly.payout_id) {
      const [payoutRows] = await db.execute(
        'SELECT * FROM user_payout WHERE id = ?',
        [incomeMonthly.payout_id]
      );
      
      if (payoutRows.length > 0) {
        payout = payoutRows[0];
      }
    }
    
    // 4. 查询payout_gateway_transaction（通过gateway_tx_id）
    let gatewayTx = null;
    if (payout && payout.gateway_tx_id) {
      const [gatewayRows] = await db.execute(
        'SELECT * FROM payout_gateway_transaction WHERE id = ?',
        [payout.gateway_tx_id]
      );
      
      if (gatewayRows.length > 0) {
        gatewayTx = gatewayRows[0];
      }
    }
    
    // 安全解析JSON的辅助函数
    const safeParseJSON = (value, defaultValue = null) => {
      if (!value) return defaultValue;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch (e) {
          return defaultValue;
        }
      }
      if (typeof value === 'object') {
        return value;
      }
      return defaultValue;
    };
    
    // 构建返回数据
    const result = {
      user: {
        id: user.id,
        name: user.pen_name || user.username || `用户${user.id}`,
        username: user.username,
        pen_name: user.pen_name,
        email: user.email,
        is_author: user.is_author === 1,
        is_promoter: isPromoter,
        default_payout_account_label: defaultAccount 
          ? `${defaultAccount.account_label} (${defaultAccount.method})` 
          : null
      },
      income_monthly: {
        id: incomeMonthly.id,
        user_id: incomeMonthly.user_id,
        month: incomeMonthly.month,
        author_base_income_usd: parseFloat(incomeMonthly.author_base_income_usd || 0),
        reader_referral_income_usd: parseFloat(incomeMonthly.reader_referral_income_usd || 0),
        author_referral_income_usd: parseFloat(incomeMonthly.author_referral_income_usd || 0),
        total_income_usd: parseFloat(incomeMonthly.total_income_usd || 0),
        paid_amount_usd: parseFloat(incomeMonthly.paid_amount_usd || 0),
        payout_status: incomeMonthly.payout_status,
        payout_id: incomeMonthly.payout_id || null,
        created_at: incomeMonthly.created_at,
        updated_at: incomeMonthly.updated_at
      },
      payout: payout ? {
        id: payout.id,
        user_id: payout.user_id,
        month: payout.month,
        income_monthly_id: payout.income_monthly_id,
        base_amount_usd: parseFloat(payout.base_amount_usd || 0),
        payout_currency: payout.payout_currency || 'USD',
        payout_amount: parseFloat(payout.payout_amount || 0),
        fx_rate: parseFloat(payout.fx_rate || (payout.payout_currency === 'USD' ? 1.0 : 0)),
        status: payout.status,
        method: payout.method,
        account_info: safeParseJSON(payout.account_info, null),
        requested_at: payout.requested_at,
        paid_at: payout.paid_at,
        admin_id: payout.admin_id || null,
        note: payout.note,
        gateway_tx_id: payout.gateway_tx_id || null,
        created_at: payout.created_at,
        updated_at: payout.updated_at
      } : null,
      gateway_tx: gatewayTx ? {
        id: gatewayTx.id,
        provider: gatewayTx.provider,
        provider_tx_id: gatewayTx.provider_tx_id,
        status: gatewayTx.status,
        base_amount_usd: parseFloat(gatewayTx.base_amount_usd || 0),
        payout_currency: gatewayTx.payout_currency || 'USD',
        payout_amount: parseFloat(gatewayTx.payout_amount || 0),
        fx_rate: parseFloat(gatewayTx.fx_rate || 1.0),
        request_payload: safeParseJSON(gatewayTx.request_payload, null),
        response_payload: safeParseJSON(gatewayTx.response_payload, null),
        error_code: gatewayTx.error_code,
        error_message: gatewayTx.error_message,
        created_at: gatewayTx.created_at,
        updated_at: gatewayTx.updated_at
      } : null
    };
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('获取结算详情错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 手动同步PayPal支付结果
router.post('/payouts/:payoutId/sync-gateway', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const payoutId = parseInt(req.params.payoutId);
    
    if (isNaN(payoutId)) {
      return res.status(400).json({
        success: false,
        message: '无效的支付单ID'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    // 1. 查询user_payout
    const [payoutRows] = await db.execute(
      'SELECT * FROM user_payout WHERE id = ?',
      [payoutId]
    );
    
    if (payoutRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '支付单不存在'
      });
    }
    
    const payout = payoutRows[0];
    
    // 2. 检查支付方式
    if (payout.method.toLowerCase() !== 'paypal') {
      return res.status(400).json({
        success: false,
        message: '该支付单不是PayPal支付'
      });
    }
    
    // 3. 查询gateway_transaction
    if (!payout.gateway_tx_id) {
      return res.status(400).json({
        success: false,
        message: '该支付单没有网关交易记录'
      });
    }
    
    const [gatewayRows] = await db.execute(
      'SELECT * FROM payout_gateway_transaction WHERE id = ?',
      [payout.gateway_tx_id]
    );
    
    if (gatewayRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '网关交易记录不存在'
      });
    }
    
    const gatewayTx = gatewayRows[0];
    
    // 4. 从response_payload或provider_tx_id获取batch_id
    let batchId = null;
    if (gatewayTx.response_payload) {
      try {
        const responsePayload = typeof gatewayTx.response_payload === 'string' 
          ? JSON.parse(gatewayTx.response_payload) 
          : gatewayTx.response_payload;
        batchId = responsePayload.batch_id || gatewayTx.provider_tx_id;
      } catch (e) {
        batchId = gatewayTx.provider_tx_id;
      }
    } else {
      batchId = gatewayTx.provider_tx_id;
    }
    
    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: '未找到PayPal批次ID'
      });
    }
    
    // 5. 调用PayPal API查询状态
    const paypalStatus = await paypalService.getPayoutStatus(batchId);
    
    const batchStatus = paypalStatus.batch_header?.batch_status || 'UNKNOWN';
    const items = paypalStatus.items || [];
    
    // 6. 根据PayPal状态更新数据库
    let dbStatus = 'processing';
    if (batchStatus === 'SUCCESS') {
      dbStatus = 'succeeded';
    } else if (batchStatus === 'DENIED' || batchStatus === 'FAILED') {
      dbStatus = 'failed';
    }
    
    await db.beginTransaction();
    
    try {
      // 更新gateway_transaction
      await db.execute(
        `UPDATE payout_gateway_transaction 
         SET status = ?, 
             response_payload = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [
          dbStatus,
          JSON.stringify({
            ...paypalStatus,
            synced_at: new Date().toISOString(),
            batch_status: batchStatus
          }),
          gatewayTx.id
        ]
      );
      
      // 如果PayPal状态为SUCCESS，更新user_payout和user_income_monthly
      if (batchStatus === 'SUCCESS') {
        await db.execute(
          `UPDATE user_payout 
           SET status = 'paid', 
               paid_at = NOW(),
               updated_at = NOW()
           WHERE id = ?`,
          [payoutId]
        );
        
        if (payout.income_monthly_id) {
          // 根据支付币种更新对应的支付金额字段
          if (payout.payout_currency === 'CNY') {
            // 人民币支付，更新 paid_amount_rmb
            await db.execute(
              `UPDATE user_income_monthly
               SET payout_status = 'paid',
                   paid_amount_rmb = ?,
                   updated_at = NOW()
               WHERE id = ?`,
              [payout.payout_amount, payout.income_monthly_id]
            );
          } else {
            // 美元支付，更新 paid_amount_usd
            await db.execute(
              `UPDATE user_income_monthly
               SET payout_status = 'paid',
                   paid_amount_usd = total_income_usd,
                   updated_at = NOW()
               WHERE id = ?`,
              [payout.income_monthly_id]
            );
          }
        }
      } else if (batchStatus === 'DENIED' || batchStatus === 'FAILED') {
        // 如果失败，更新user_payout状态
        await db.execute(
          `UPDATE user_payout 
           SET status = 'failed',
               updated_at = NOW()
           WHERE id = ?`,
          [payoutId]
        );
      }
      
      await db.commit();
      
      // 7. 重新查询完整数据并返回
      const [updatedIncomeRows] = await db.execute(
        'SELECT * FROM user_income_monthly WHERE id = ?',
        [payout.income_monthly_id]
      );
      
      const [updatedPayoutRows] = await db.execute(
        'SELECT * FROM user_payout WHERE id = ?',
        [payoutId]
      );
      
      const [updatedGatewayRows] = await db.execute(
        'SELECT * FROM payout_gateway_transaction WHERE id = ?',
        [gatewayTx.id]
      );
      
      const safeParseJSON = (value, defaultValue = null) => {
        if (!value) return defaultValue;
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch (e) {
            return defaultValue;
          }
        }
        if (typeof value === 'object') {
          return value;
        }
        return defaultValue;
      };
      
      const updatedIncomeMonthly = updatedIncomeRows[0];
      const updatedPayout = updatedPayoutRows[0];
      const updatedGatewayTx = updatedGatewayRows[0];
      
      res.json({
        success: true,
        message: `同步成功，当前状态: ${dbStatus === 'succeeded' ? 'succeeded' : dbStatus}`,
        data: {
          income_monthly: {
            id: updatedIncomeMonthly.id,
            user_id: updatedIncomeMonthly.user_id,
            month: updatedIncomeMonthly.month,
            author_base_income_usd: parseFloat(updatedIncomeMonthly.author_base_income_usd || 0),
            reader_referral_income_usd: parseFloat(updatedIncomeMonthly.reader_referral_income_usd || 0),
            author_referral_income_usd: parseFloat(updatedIncomeMonthly.author_referral_income_usd || 0),
            total_income_usd: parseFloat(updatedIncomeMonthly.total_income_usd || 0),
            paid_amount_usd: parseFloat(updatedIncomeMonthly.paid_amount_usd || 0),
            payout_status: updatedIncomeMonthly.payout_status,
            payout_id: updatedIncomeMonthly.payout_id || null,
            created_at: updatedIncomeMonthly.created_at,
            updated_at: updatedIncomeMonthly.updated_at
          },
          payout: {
            id: updatedPayout.id,
            user_id: updatedPayout.user_id,
            month: updatedPayout.month,
            income_monthly_id: updatedPayout.income_monthly_id,
            base_amount_usd: parseFloat(updatedPayout.base_amount_usd || 0),
            payout_currency: updatedPayout.payout_currency || 'USD',
            payout_amount: parseFloat(updatedPayout.payout_amount || 0),
            fx_rate: parseFloat(updatedPayout.fx_rate || (updatedPayout.payout_currency === 'USD' ? 1.0 : 0)),
            status: updatedPayout.status,
            method: updatedPayout.method,
            account_info: safeParseJSON(updatedPayout.account_info, null),
            requested_at: updatedPayout.requested_at,
            paid_at: updatedPayout.paid_at,
            admin_id: updatedPayout.admin_id || null,
            note: updatedPayout.note,
            gateway_tx_id: updatedPayout.gateway_tx_id || null,
            created_at: updatedPayout.created_at,
            updated_at: updatedPayout.updated_at
          },
          gateway_tx: {
            id: updatedGatewayTx.id,
            provider: updatedGatewayTx.provider,
            provider_tx_id: updatedGatewayTx.provider_tx_id,
            status: updatedGatewayTx.status,
            base_amount_usd: parseFloat(updatedGatewayTx.base_amount_usd || 0),
            payout_currency: updatedGatewayTx.payout_currency || 'USD',
            payout_amount: parseFloat(updatedGatewayTx.payout_amount || 0),
            fx_rate: parseFloat(updatedGatewayTx.fx_rate || 1.0),
            request_payload: safeParseJSON(updatedGatewayTx.request_payload, null),
            response_payload: safeParseJSON(updatedGatewayTx.response_payload, null),
            error_code: updatedGatewayTx.error_code,
            error_message: updatedGatewayTx.error_message,
            created_at: updatedGatewayTx.created_at,
            updated_at: updatedGatewayTx.updated_at
          }
        }
      });
    } catch (error) {
      await db.rollback();
      throw error;
    }
  } catch (error) {
    console.error('同步PayPal支付状态错误:', error);
    res.status(500).json({
      success: false,
      message: '同步失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 生成月度收入汇总（从author_royalty和commission_transaction汇总，支持所有用户）
router.post('/user-settlement/generate-monthly', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { month } = req.body; // 格式：2025-10-01
    
    if (!month) {
      return res.status(400).json({
        success: false,
        message: '请指定月份'
      });
    }
    
    const monthStart = parseMonth(month);
    if (!monthStart) {
      return res.status(400).json({
        success: false,
        message: '月份格式错误'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    // 获取所有有收入的用户（包括作者和推广者）
    // 1. 从author_royalty获取所有作者
    const [authors] = await db.execute(
      `SELECT DISTINCT author_id as user_id FROM author_royalty WHERE settlement_month = ?`,
      [monthStart]
    );
    
    // 2. 从commission_transaction获取所有推广者
    const [promoters] = await db.execute(
      `SELECT DISTINCT user_id FROM commission_transaction WHERE settlement_month = ?`,
      [monthStart]
    );
    
    // 合并所有用户ID（去重）
    const userIds = new Set();
    authors.forEach(a => userIds.add(a.user_id));
    promoters.forEach(p => userIds.add(p.user_id));
    
    let processed = 0;
    let errors = [];
    
    for (const userId of userIds) {
      try {
        // 1. 基础作者收入
        const [baseResult] = await db.execute(
          `SELECT COALESCE(SUM(author_amount_usd), 0) as base_income
           FROM author_royalty
           WHERE author_id = ? AND settlement_month = ?`,
          [userId, monthStart]
        );
        const authorBaseIncome = parseFloat(baseResult[0].base_income || 0);
        
        // 2. 读者推广收入
        const [readerResult] = await db.execute(
          `SELECT COALESCE(SUM(commission_amount_usd), 0) as reader_referral_income
           FROM commission_transaction
           WHERE user_id = ? AND commission_type = 'reader_referral' AND settlement_month = ?`,
          [userId, monthStart]
        );
        const readerReferralIncome = parseFloat(readerResult[0].reader_referral_income || 0);
        
        // 3. 作者推广收入
        const [authorResult] = await db.execute(
          `SELECT COALESCE(SUM(commission_amount_usd), 0) as author_referral_income
           FROM commission_transaction
           WHERE user_id = ? AND commission_type = 'author_referral' AND settlement_month = ?`,
          [userId, monthStart]
        );
        const authorReferralIncome = parseFloat(authorResult[0].author_referral_income || 0);
        
        const totalIncome = authorBaseIncome + readerReferralIncome + authorReferralIncome;
        
        // 计算支付状态（一个用户一个月一笔支付单）
        let payoutStatus = 'unpaid';
        let payoutId = null;
        if (totalIncome > 0) {
          // 检查是否有已支付的支付单
          const [payoutResult] = await db.execute(
            `SELECT id, status FROM user_payout
             WHERE user_id = ? AND month = ? AND status = 'paid'
             LIMIT 1`,
            [userId, monthStart]
          );
          
          if (payoutResult.length > 0) {
            payoutStatus = 'paid';
            payoutId = payoutResult[0].id;
          }
        }
        
        // 插入或更新user_income_monthly（移除paid_amount_usd字段）
        await db.execute(
          `INSERT INTO user_income_monthly 
           (user_id, month, author_base_income_usd, reader_referral_income_usd, author_referral_income_usd, total_income_usd, payout_status, payout_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
           author_base_income_usd = VALUES(author_base_income_usd),
           reader_referral_income_usd = VALUES(reader_referral_income_usd),
           author_referral_income_usd = VALUES(author_referral_income_usd),
           total_income_usd = VALUES(total_income_usd),
           payout_status = VALUES(payout_status),
           payout_id = VALUES(payout_id),
           updated_at = CURRENT_TIMESTAMP`,
          [userId, monthStart, authorBaseIncome, readerReferralIncome, authorReferralIncome, totalIncome, payoutStatus, payoutId]
        );
        
        processed++;
      } catch (error) {
        errors.push({ user_id: userId, error: error.message });
      }
    }
    
    res.json({
      success: true,
      message: `已处理 ${processed} 位用户，${errors.length} 个错误`,
      data: {
        processed,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    console.error('生成月度收入汇总错误:', error);
    res.status(500).json({
      success: false,
      message: '生成失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 创建支付订单（一个用户一个月一笔支付单，支持汇率）
router.post('/user-settlement/create-payout', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { income_monthly_id, method, account_id, payout_currency, fx_rate, note } = req.body;
    
    if (!income_monthly_id || !method || !account_id || !payout_currency) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }
    
    const incomeMonthlyId = parseInt(income_monthly_id);
    const accountIdNum = parseInt(account_id);
    const payoutCurrency = String(payout_currency).toUpperCase();
    let fxRate = parseFloat(fx_rate);
    
    // 验证币种
    if (!['USD', 'CNY'].includes(payoutCurrency)) {
      return res.status(400).json({
        success: false,
        message: '支付币种必须是 USD 或 CNY'
      });
    }
    
    // USD 时汇率固定为 1.0
    if (payoutCurrency === 'USD') {
      fxRate = 1.0;
    } else if (isNaN(fxRate) || fxRate <= 0) {
      return res.status(400).json({
        success: false,
        message: 'CNY 支付需要提供有效的汇率'
      });
    }
    
    if (isNaN(incomeMonthlyId) || isNaN(accountIdNum)) {
      return res.status(400).json({
        success: false,
        message: '参数无效'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    await db.beginTransaction();
    
    try {
      // 1. 获取月度收入记录
      const [incomeRows] = await db.execute(
        'SELECT * FROM user_income_monthly WHERE id = ?',
        [incomeMonthlyId]
      );
      
      if (incomeRows.length === 0) {
        await db.rollback();
        return res.status(404).json({
          success: false,
          message: '月度收入记录不存在'
        });
      }
      
      const incomeMonthly = incomeRows[0];
      
      // 2. 检查是否已支付
      if (incomeMonthly.payout_status === 'paid') {
        await db.rollback();
        return res.status(400).json({
          success: false,
          message: '该月收入已支付'
        });
      }
      
      // 3. 检查是否已存在支付单（防止重复创建）
      const [existingPayouts] = await db.execute(
        'SELECT id FROM user_payout WHERE user_id = ? AND month = ? LIMIT 1',
        [incomeMonthly.user_id, incomeMonthly.month]
      );
      
      if (existingPayouts.length > 0) {
        await db.rollback();
        return res.json({
          success: true,
          data: {
            payout_id: existingPayouts[0].id,
            message: '该月已存在支付单',
            existing: true
          }
        });
      }
      
      // 4. 获取收款账户信息
      const [accounts] = await db.execute(
        'SELECT * FROM user_payout_account WHERE id = ? AND user_id = ?',
        [accountIdNum, incomeMonthly.user_id]
      );
      
      if (accounts.length === 0) {
        await db.rollback();
        return res.status(404).json({
          success: false,
          message: '收款账户不存在'
        });
      }
      
      const account = accounts[0];
      
      // 安全解析 JSON 的辅助函数
      const safeParseJSON = (value, defaultValue = {}) => {
        if (!value) return defaultValue;
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch (e) {
            console.warn('[WARN] JSON解析失败，使用默认值:', e.message);
            return defaultValue;
          }
        }
        if (typeof value === 'object') {
          return value;
        }
        return defaultValue;
      };
      
      const accountInfo = {
        account_id: account.id,
        method: account.method,
        account_label: account.account_label,
        account_data: safeParseJSON(account.account_data)
      };
      
      // 5. 计算实际支付金额
      const baseAmountUsd = parseFloat(incomeMonthly.total_income_usd || 0);
      const payoutAmount = Math.round(baseAmountUsd * fxRate * 100) / 100; // 保留2位小数
      
      // 6. 创建 user_payout
      const [result] = await db.execute(
        `INSERT INTO user_payout (
          user_id, month, income_monthly_id,
          base_amount_usd, payout_currency, payout_amount, fx_rate,
          status, method, account_info, requested_at, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, NOW(), ?)`,
        [
          incomeMonthly.user_id,
          incomeMonthly.month,
          incomeMonthlyId,
          baseAmountUsd,
          payoutCurrency,
          payoutAmount,
          fxRate,
          method,
          JSON.stringify(accountInfo),
          note || null
        ]
      );
      
      const payoutId = result.insertId;
      
      // 7. 更新 user_income_monthly 的 payout_id（但不更新 payout_status，等支付成功后再更新）
      await db.execute(
        `UPDATE user_income_monthly
         SET payout_id = ?, updated_at = NOW()
         WHERE id = ?`,
        [payoutId, incomeMonthlyId]
      );
      
      console.log(`[创建支付订单] 支付单ID: ${payoutId}, 用户ID: ${incomeMonthly.user_id}, 月份: ${incomeMonthly.month}, 已更新user_income_monthly.payout_id`);
      
      await db.commit();
      
      res.json({
        success: true,
        data: {
          payout_id: payoutId,
          base_amount_usd: baseAmountUsd,
          payout_currency: payoutCurrency,
          payout_amount: payoutAmount,
          fx_rate: fxRate,
          message: '支付订单已创建（待支付）'
        }
      });
    } catch (error) {
      await db.rollback();
      throw error;
    }
  } catch (error) {
    console.error('创建支付订单错误:', error);
    res.status(500).json({
      success: false,
      message: '创建失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 标记支付成功（一个用户一个月一笔支付单，支持汇率）
router.post('/user-settlement/mark-paid', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { payout_id, provider, provider_tx_id } = req.body;
    
    if (!payout_id || !provider || !provider_tx_id) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数：payout_id, provider, provider_tx_id'
      });
    }
    
    const payoutIdNum = parseInt(payout_id);
    if (isNaN(payoutIdNum)) {
      return res.status(400).json({
        success: false,
        message: '支付单ID无效'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    await db.beginTransaction();
    
    try {
      // 1. 获取支付单信息
      const [payouts] = await db.execute(
        'SELECT * FROM user_payout WHERE id = ? FOR UPDATE',
        [payoutIdNum]
      );
      
      if (payouts.length === 0) {
        await db.rollback();
        return res.status(404).json({
          success: false,
          message: '支付单不存在'
        });
      }
      
      const payout = payouts[0];
      
      if (payout.status === 'paid') {
        await db.rollback();
        return res.status(400).json({
          success: false,
          message: '该支付单已经标记为已支付'
        });
      }
      
      if (!['pending', 'processing'].includes(payout.status)) {
        await db.rollback();
        return res.status(400).json({
          success: false,
          message: `支付单状态为 ${payout.status}，无法标记为已支付`
        });
      }
      
      // 2. 写入 payout_gateway_transaction（记录汇率信息）
      const baseAmountUsd = parseFloat(payout.base_amount_usd || 0);
      const payoutCurrency = payout.payout_currency || 'USD';
      const payoutAmount = parseFloat(payout.payout_amount || 0);
      const fxRate = parseFloat(payout.fx_rate || (payoutCurrency === 'USD' ? 1.0 : 0));
      
      const [gatewayResult] = await db.execute(
        `INSERT INTO payout_gateway_transaction (
          provider, provider_tx_id, status,
          base_amount_usd, payout_currency, payout_amount, fx_rate,
          request_payload, response_payload, error_code, error_message, created_at
        ) VALUES (?, ?, 'succeeded', ?, ?, ?, ?, NULL, NULL, NULL, NULL, NOW())`,
        [
          provider,
          provider_tx_id,
          baseAmountUsd,
          payoutCurrency,
          payoutAmount,
          fxRate
        ]
      );
      
      const gatewayTxId = gatewayResult.insertId;
      
      // 3. 更新 user_payout 状态和 gateway_tx_id
      await db.execute(
        `UPDATE user_payout
         SET status = 'paid', paid_at = NOW(), gateway_tx_id = ?
         WHERE id = ?`,
        [gatewayTxId, payoutIdNum]
      );
      
      // 4. 更新 user_income_monthly（一个用户一个月一笔支付单）
      if (payout.income_monthly_id) {
        await db.execute(
          `UPDATE user_income_monthly
           SET payout_status = 'paid', payout_id = ?, updated_at = NOW()
           WHERE id = ?`,
          [payoutIdNum, payout.income_monthly_id]
        );
      }
      
      await db.commit();
      
      res.json({
        success: true,
        data: {
          payout_id: payoutIdNum,
          gateway_tx_id: gatewayTxId,
          base_amount_usd: baseAmountUsd,
          payout_currency: payoutCurrency,
          payout_amount: payoutAmount,
          fx_rate: fxRate,
          message: '支付已成功标记'
        }
      });
    } catch (error) {
      await db.rollback();
      throw error;
    }
  } catch (error) {
    console.error('标记支付成功错误:', error);
    res.status(500).json({
      success: false,
      message: '标记失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 自动发起支付（PayPal/支付宝/微信）
router.post('/payouts/:id/pay', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const payoutId = parseInt(req.params.id);
    
    if (isNaN(payoutId)) {
      return res.status(400).json({
        success: false,
        message: '支付单ID无效'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    await db.beginTransaction();
    
    try {
      // 1. 获取支付单信息
      const [payouts] = await db.execute(
        'SELECT * FROM user_payout WHERE id = ? FOR UPDATE',
        [payoutId]
      );
      
      if (payouts.length === 0) {
        await db.rollback();
        return res.status(404).json({
          success: false,
          message: '支付单不存在'
        });
      }
      
      const payout = payouts[0];
      
      if (payout.status === 'paid') {
        await db.rollback();
        return res.status(400).json({
          success: false,
          message: '该支付单已经支付完成'
        });
      }
      
      if (!['pending', 'processing'].includes(payout.status)) {
        await db.rollback();
        return res.status(400).json({
          success: false,
          message: `支付单状态为 ${payout.status}，无法发起支付`
        });
      }
      
      // 2. 解析账户信息
      let accountInfo = {};
      try {
        accountInfo = typeof payout.account_info === 'string' 
          ? JSON.parse(payout.account_info) 
          : payout.account_info || {};
      } catch (e) {
        console.warn('[WARN] 解析account_info失败:', e.message);
      }
      
      const accountData = accountInfo.account_data || {};
      const method = payout.method.toLowerCase();
      const payoutCurrency = payout.payout_currency || 'USD';
      const payoutAmount = parseFloat(payout.payout_amount || 0);
      const baseAmountUsd = parseFloat(payout.base_amount_usd || 0);
      const fxRate = parseFloat(payout.fx_rate || 1.0);
      
      // 3. 更新状态为 processing
      await db.execute(
        'UPDATE user_payout SET status = \'processing\', updated_at = NOW() WHERE id = ?',
        [payoutId]
      );
      
      // 4. 创建 gateway_transaction 记录
      let provider = 'bank_manual';
      if (method === 'paypal') {
        provider = 'paypal';
      } else if (method === 'alipay') {
        provider = 'alipay';
      } else if (method === 'wechat') {
        provider = 'wechat';
      }
      
      const [gatewayResult] = await db.execute(
        `INSERT INTO payout_gateway_transaction (
          provider, status,
          base_amount_usd, payout_currency, payout_amount, fx_rate,
          request_payload, created_at
        ) VALUES (?, 'processing', ?, ?, ?, ?, ?, NOW())`,
        [
          provider,
          baseAmountUsd,
          payoutCurrency,
          payoutAmount,
          fxRate,
          JSON.stringify({
            payout_id: payoutId,
            method: method,
            account_info: accountInfo,
            amount: payoutAmount,
            currency: payoutCurrency
          })
        ]
      );
      
      const gatewayTxId = gatewayResult.insertId;
      
      // 5. 更新 user_payout 的 gateway_tx_id
      await db.execute(
        'UPDATE user_payout SET gateway_tx_id = ? WHERE id = ?',
        [gatewayTxId, payoutId]
      );
      
      // 6. 根据支付方式调用相应的支付API（这里先模拟，实际需要集成真实的支付网关）
      let paymentResult = {
        success: false,
        tx_id: null,
        message: ''
      };
      
      if (method === 'paypal') {
        // 调用 PayPal Payouts API
        console.log('[支付流程] 开始调用PayPal Payouts API');
        console.log('[支付流程] 账户信息:', JSON.stringify(accountData, null, 2));
        console.log('[支付流程] 支付金额:', payoutAmount, payoutCurrency);
        
        try {
          const email = accountData.email;
          if (!email) {
            throw new Error('PayPal账户信息中缺少email字段');
          }
          
          console.log('[支付流程] PayPal Email:', email);
          console.log('[支付流程] 准备调用 paypalService.createPayout()');
          
          const payoutNote = `Payout for ${payout.month} - User ID: ${payout.user_id}`;
          const paypalResult = await paypalService.createPayout(
            email, 
            payoutAmount, 
            payoutCurrency,
            payoutNote
          );
          
          console.log('[支付流程] PayPal API返回结果:', JSON.stringify(paypalResult, null, 2));
          
          if (paypalResult.success) {
            paymentResult = {
              success: true,
              tx_id: paypalResult.payout_item_id || paypalResult.batch_id,
              batch_id: paypalResult.batch_id,
              status: paypalResult.status,
              message: `PayPal支付已发起，批次ID: ${paypalResult.batch_id}`
            };
            console.log('[支付流程] PayPal支付成功，paymentResult:', JSON.stringify(paymentResult, null, 2));
          } else {
            throw new Error('PayPal Payout创建失败');
          }
        } catch (paypalError) {
          console.error('[PayPal Payout错误] 详细错误信息:', paypalError);
          console.error('[PayPal Payout错误] 错误堆栈:', paypalError.stack);
          paymentResult = {
            success: false,
            tx_id: null,
            message: `PayPal支付失败: ${paypalError.message}`
          };
          console.log('[支付流程] PayPal支付失败，paymentResult:', JSON.stringify(paymentResult, null, 2));
        }
      } else if (method === 'alipay') {
        // TODO: 调用支付宝转账API
        // 示例：const alipayResult = await alipayService.transfer(accountData.account, payoutAmount);
        // 目前先模拟成功
        paymentResult = {
          success: true,
          tx_id: `ALIPAY_${Date.now()}`,
          message: '支付宝转账已发起'
        };
      } else if (method === 'wechat') {
        // TODO: 调用微信企业付款API
        // 示例：const wechatResult = await wechatService.transfer(accountData.openid, payoutAmount);
        // 目前先模拟成功
        paymentResult = {
          success: true,
          tx_id: `WECHAT_${Date.now()}`,
          message: '微信支付已发起'
        };
      } else {
        // 银行转账或手动支付，不自动发起
        await db.commit();
        return res.json({
          success: true,
          data: {
            payout_id: payoutId,
            gateway_tx_id: gatewayTxId,
            message: '支付订单已创建，请手动完成支付',
            requires_manual_payment: true
          }
        });
      }
      
      // 7. 更新 gateway_transaction 和 user_payout 状态
      if (paymentResult.success) {
        // 构建响应payload，包含PayPal返回的信息
        const responsePayload = {
          success: true,
          provider_tx_id: paymentResult.tx_id,
          batch_id: paymentResult.batch_id || null,
          status: paymentResult.status || 'PENDING',
          message: paymentResult.message
        };
        
        // PayPal Payouts的状态处理：
        // - PENDING: 已创建，等待处理（Sandbox环境通常很快完成）
        // - PROCESSING: 处理中
        // - SUCCESS: 成功完成
        // - DENIED: 被拒绝
        // - FAILED: 失败
        const paypalStatus = paymentResult.status || 'PENDING';
        
        // 根据PayPal状态决定数据库状态
        let dbStatus = 'processing'; // 默认设为processing，等待PayPal处理完成
        if (paypalStatus === 'SUCCESS') {
          dbStatus = 'succeeded';
        } else if (paypalStatus === 'DENIED' || paypalStatus === 'FAILED') {
          dbStatus = 'failed';
        }
        
        console.log(`[支付流程] PayPal批次状态: ${paypalStatus}, 数据库状态: ${dbStatus}`);
        
        await db.execute(
          `UPDATE payout_gateway_transaction 
           SET status = ?, 
               provider_tx_id = ?,
               response_payload = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [
            dbStatus,
            paymentResult.tx_id,
            JSON.stringify(responsePayload),
            gatewayTxId
          ]
        );
        
        // 只有当PayPal状态为SUCCESS时才标记为paid
        if (paypalStatus === 'SUCCESS') {
          await db.execute(
            `UPDATE user_payout 
             SET status = 'paid', 
                 paid_at = NOW(),
                 updated_at = NOW()
             WHERE id = ?`,
            [payoutId]
          );
          
          // 更新 user_income_monthly
          if (payout.income_monthly_id) {
            await db.execute(
              `UPDATE user_income_monthly
               SET payout_status = 'paid', payout_id = ?, updated_at = NOW()
               WHERE id = ?`,
              [payoutId, payout.income_monthly_id]
            );
          }
        } else {
          // PENDING状态：保持processing，等待后续状态更新
          await db.execute(
            `UPDATE user_payout 
             SET status = 'processing', 
                 updated_at = NOW()
             WHERE id = ?`,
            [payoutId]
          );
          
          console.log(`[支付流程] PayPal批次状态为${paypalStatus}，已创建批次但尚未完成。批次ID: ${paymentResult.batch_id}`);
        }
        
        await db.commit();
        
        // 根据PayPal状态返回不同的消息（paypalStatus已在上面声明）
        let responseMessage = paymentResult.message || '支付已发起';
        
        if (paypalStatus === 'PENDING') {
          responseMessage = `PayPal支付已创建，批次ID: ${paymentResult.batch_id}，状态: PENDING（等待PayPal处理中）`;
        } else if (paypalStatus === 'SUCCESS') {
          responseMessage = `PayPal支付已成功完成，批次ID: ${paymentResult.batch_id}`;
        } else {
          responseMessage = `PayPal支付状态: ${paypalStatus}，批次ID: ${paymentResult.batch_id}`;
        }
        
        res.json({
          success: true,
          data: {
            payout_id: payoutId,
            gateway_tx_id: gatewayTxId,
            provider_tx_id: paymentResult.tx_id,
            batch_id: paymentResult.batch_id,
            paypal_status: paypalStatus,
            base_amount_usd: baseAmountUsd,
            payout_currency: payoutCurrency,
            payout_amount: payoutAmount,
            fx_rate: fxRate,
            message: responseMessage
          }
        });
      } else {
        // 支付失败
        await db.execute(
          `UPDATE payout_gateway_transaction 
           SET status = 'failed', 
               error_message = ?,
               response_payload = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [
            paymentResult.message || '支付失败',
            JSON.stringify({ success: false, error: paymentResult.message }),
            gatewayTxId
          ]
        );
        
        await db.execute(
          `UPDATE user_payout 
           SET status = 'failed',
               updated_at = NOW()
           WHERE id = ?`,
          [payoutId]
        );
        
        await db.commit();
        
        res.status(500).json({
          success: false,
          message: paymentResult.message || '支付失败',
          data: {
            payout_id: payoutId,
            gateway_tx_id: gatewayTxId
          }
        });
      }
    } catch (error) {
      await db.rollback();
      throw error;
    }
  } catch (error) {
    console.error('自动发起支付错误:', error);
    res.status(500).json({
      success: false,
      message: '发起支付失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 查询PayPal批次状态
router.get('/payouts/:id/status', authenticateAdmin, async (req, res) => {
  let db;
  try {
    console.log(`[状态查询接口] ========== 收到状态查询请求 ==========`);
    console.log(`[状态查询接口] 时间: ${new Date().toISOString()}`);
    console.log(`[状态查询接口] 支付单ID: ${req.params.id}`);
    
    const payoutId = parseInt(req.params.id);
    
    if (isNaN(payoutId)) {
      console.error(`[状态查询接口] 错误：支付单ID无效: ${req.params.id}`);
      return res.status(400).json({
        success: false,
        message: '支付单ID无效'
      });
    }
    
    console.log(`[状态查询接口] 解析后的支付单ID: ${payoutId}`);
    
    db = await mysql.createConnection(dbConfig);
    console.log(`[状态查询接口] 数据库连接成功`);
    
    // 获取支付单信息
    console.log(`[状态查询接口] 查询支付单信息，ID: ${payoutId}`);
    const [payouts] = await db.execute(
      'SELECT * FROM user_payout WHERE id = ?',
      [payoutId]
    );
    
    if (payouts.length === 0) {
      console.error(`[状态查询接口] 错误：支付单不存在，ID: ${payoutId}`);
      return res.status(404).json({
        success: false,
        message: '支付单不存在'
      });
    }
    
    const payout = payouts[0];
    console.log(`[状态查询接口] 找到支付单:`, {
      id: payout.id,
      user_id: payout.user_id,
      method: payout.method,
      status: payout.status,
      gateway_tx_id: payout.gateway_tx_id
    });
    
    // 检查是否有PayPal批次ID
    if (payout.method.toLowerCase() !== 'paypal') {
      console.error(`[状态查询接口] 错误：该支付单不是PayPal支付，method: ${payout.method}`);
      return res.status(400).json({
        success: false,
        message: '该支付单不是PayPal支付'
      });
    }
    
    // 从gateway_transaction获取batch_id
    let batchId = null;
    if (payout.gateway_tx_id) {
      console.log(`[状态查询接口] 查询gateway_transaction，ID: ${payout.gateway_tx_id}`);
      const [gatewayTxs] = await db.execute(
        'SELECT response_payload FROM payout_gateway_transaction WHERE id = ?',
        [payout.gateway_tx_id]
      );
      
      if (gatewayTxs.length > 0) {
        try {
          const responsePayload = typeof gatewayTxs[0].response_payload === 'string' 
            ? JSON.parse(gatewayTxs[0].response_payload) 
            : gatewayTxs[0].response_payload;
          batchId = responsePayload.batch_id;
          console.log(`[状态查询接口] 从response_payload提取批次ID: ${batchId}`);
        } catch (e) {
          console.warn('[状态查询接口] 解析response_payload失败:', e.message);
        }
      } else {
        console.warn(`[状态查询接口] 警告：未找到gateway_transaction记录，ID: ${payout.gateway_tx_id}`);
      }
    } else {
      console.warn(`[状态查询接口] 警告：支付单没有gateway_tx_id`);
    }
    
    if (!batchId) {
      console.error(`[状态查询接口] 错误：未找到PayPal批次ID`);
      return res.status(400).json({
        success: false,
        message: '未找到PayPal批次ID'
      });
    }
    
    // 查询PayPal批次状态
    console.log(`[状态查询接口] ========== 调用PayPal API查询批次状态 ==========`);
    console.log(`[状态查询接口] 批次ID: ${batchId}`);
    const paypalStatus = await paypalService.getPayoutStatus(batchId);
    console.log(`[状态查询接口] PayPal API返回:`, JSON.stringify(paypalStatus, null, 2));
    
    const batchStatus = paypalStatus.batch_header?.batch_status || 'UNKNOWN';
    const items = paypalStatus.items || [];
    
    console.log(`[状态查询接口] PayPal批次状态: ${batchStatus}`);
    console.log(`[状态查询接口] 支付项目数量: ${items.length}`);
    
    // 更新数据库状态
    let dbStatus = 'processing';
    if (batchStatus === 'SUCCESS') {
      dbStatus = 'succeeded';
    } else if (batchStatus === 'DENIED' || batchStatus === 'FAILED') {
      dbStatus = 'failed';
    }
    
    console.log(`[状态查询接口] 数据库状态: ${dbStatus}`);
    
    // 更新gateway_transaction状态
    if (payout.gateway_tx_id) {
      console.log(`[状态查询接口] 更新gateway_transaction，ID: ${payout.gateway_tx_id}, 状态: ${dbStatus}`);
      await db.execute(
        `UPDATE payout_gateway_transaction 
         SET status = ?, 
             response_payload = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [
          dbStatus,
          JSON.stringify(paypalStatus),
          payout.gateway_tx_id
        ]
      );
      console.log(`[状态查询接口] gateway_transaction更新完成`);
    }
    
    // 如果状态为SUCCESS，更新user_payout和user_income_monthly
    if (batchStatus === 'SUCCESS') {
      console.log(`[状态查询接口] ========== 支付成功，更新数据库 ==========`);
      console.log(`[状态查询接口] 更新user_payout，ID: ${payoutId}, 状态: paid`);
      await db.execute(
        `UPDATE user_payout 
         SET status = 'paid', 
             paid_at = NOW(),
             updated_at = NOW()
         WHERE id = ?`,
        [payoutId]
      );
      
      if (payout.income_monthly_id) {
        console.log(`[状态查询接口] 更新user_income_monthly，ID: ${payout.income_monthly_id}, payout_id: ${payoutId}`);
        await db.execute(
          `UPDATE user_income_monthly
           SET payout_status = 'paid', payout_id = ?, updated_at = NOW()
           WHERE id = ?`,
          [payoutId, payout.income_monthly_id]
        );
        console.log(`[状态查询接口] user_income_monthly更新完成`);
      } else {
        console.warn(`[状态查询接口] 警告：支付单没有income_monthly_id`);
      }
    } else if (batchStatus === 'DENIED' || batchStatus === 'FAILED') {
      console.log(`[状态查询接口] ========== 支付失败，更新数据库 ==========`);
      console.log(`[状态查询接口] 更新user_payout，ID: ${payoutId}, 状态: failed`);
      await db.execute(
        `UPDATE user_payout 
         SET status = 'failed',
             updated_at = NOW()
         WHERE id = ?`,
        [payoutId]
      );
    } else {
      console.log(`[状态查询接口] PayPal状态为 ${batchStatus}，保持processing状态`);
    }
    
    console.log(`[状态查询接口] ========== 状态查询完成 ==========`);
    console.log(`[状态查询接口] 返回结果:`, {
      payout_id: payoutId,
      batch_id: batchId,
      paypal_status: batchStatus,
      db_status: dbStatus
    });
    
    res.json({
      success: true,
      data: {
        payout_id: payoutId,
        batch_id: batchId,
        paypal_status: batchStatus,
        db_status: dbStatus,
        items: items,
        paypal_response: paypalStatus
      }
    });
    
  } catch (error) {
    console.error(`[状态查询接口] ========== 发生错误 ==========`);
    console.error(`[状态查询接口] 错误类型: ${error.constructor.name}`);
    console.error(`[状态查询接口] 错误消息: ${error.message}`);
    console.error(`[状态查询接口] 错误堆栈:`, error.stack);
    res.status(500).json({
      success: false,
      message: '查询状态失败: ' + error.message
    });
  } finally {
    if (db) {
      await db.end();
      console.log(`[状态查询接口] 数据库连接已关闭`);
    }
  }
});

// PayPal Webhook处理
router.post('/webhooks/paypal', express.raw({ type: 'application/json' }), async (req, res) => {
  let db;
  try {
    console.log(`[PayPal Webhook] ========== 收到Webhook请求 ==========`);
    console.log(`[PayPal Webhook] 时间: ${new Date().toISOString()}`);
    console.log(`[PayPal Webhook] 请求方法: ${req.method}`);
    console.log(`[PayPal Webhook] 请求URL: ${req.url}`);
    console.log(`[PayPal Webhook] 请求头:`, JSON.stringify(req.headers, null, 2));
    
    // 处理请求体：可能是Buffer或字符串
    let webhookBody;
    if (Buffer.isBuffer(req.body)) {
      webhookBody = req.body.toString('utf8');
    } else if (typeof req.body === 'string') {
      webhookBody = req.body;
    } else {
      webhookBody = JSON.stringify(req.body);
    }
    
    console.log('[PayPal Webhook] 请求体类型:', typeof req.body);
    console.log('[PayPal Webhook] 请求体长度:', webhookBody.length);
    console.log('[PayPal Webhook] 请求体前500字符:', webhookBody.substring(0, 500));
    
    let webhookData;
    try {
      webhookData = JSON.parse(webhookBody);
    } catch (e) {
      console.error('[PayPal Webhook] JSON解析失败:', e.message);
      console.error('[PayPal Webhook] 原始请求体:', webhookBody);
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON: ' + e.message
      });
    }
    
    console.log('[PayPal Webhook] 解析后的数据:', JSON.stringify(webhookData, null, 2));
    
    // PayPal Webhook事件类型
    const eventType = webhookData.event_type;
    const resource = webhookData.resource || {};
    
    console.log(`[PayPal Webhook] ========== 事件类型: ${eventType} ==========`);
    console.log(`[PayPal Webhook] resource对象:`, JSON.stringify(resource, null, 2));
    
    // 处理批次级别的事件（PAYMENT.PAYOUTSBATCH.*）
    const batchEventTypes = [
      'PAYMENT.PAYOUTSBATCH.SUCCESS',
      'PAYMENT.PAYOUTSBATCH.DENIED',
      'PAYMENT.PAYOUTSBATCH.PROCESSING',
      'PAYMENT.PAYOUTSBATCH.PENDING'
    ];
    
    // 处理项目级别的事件（PAYMENT.PAYOUTSITEM.*）
    // 注意：PayPal可能使用 PAYMENT.PAYOUTS-ITEM.* 或 PAYMENT.PAYOUTSITEM.*
    const itemEventTypes = [
      'PAYMENT.PAYOUTSITEM.SUCCEEDED',
      'PAYMENT.PAYOUTS-ITEM.SUCCEEDED',  // PayPal测试工具使用的格式
      'PAYMENT.PAYOUTSITEM.FAILED',
      'PAYMENT.PAYOUTS-ITEM.FAILED',
      'PAYMENT.PAYOUTSITEM.RETURNED',
      'PAYMENT.PAYOUTS-ITEM.RETURNED',
      'PAYMENT.PAYOUTSITEM.HELD',
      'PAYMENT.PAYOUTS-ITEM.HELD',
      'PAYMENT.PAYOUTSITEM.REFUNDED',
      'PAYMENT.PAYOUTS-ITEM.REFUNDED',
      'PAYMENT.PAYOUTSITEM.UNCLAIMED',
      'PAYMENT.PAYOUTS-ITEM.UNCLAIMED'
    ];
    
    console.log(`[PayPal Webhook] 检查事件类型匹配:`);
    console.log(`[PayPal Webhook] - 是否为批次事件: ${batchEventTypes.includes(eventType)}`);
    console.log(`[PayPal Webhook] - 是否为项目事件: ${itemEventTypes.includes(eventType)}`);
    
    // 处理批次级别事件
    if (batchEventTypes.includes(eventType)) {
      console.log(`[PayPal Webhook] ========== 处理批次级别事件 ==========`);
      const batchId = resource.batch_header?.payout_batch_id;
      
      if (!batchId) {
        console.warn('[PayPal Webhook] 未找到批次ID');
        return res.status(400).json({
          success: false,
          message: 'Missing batch_id'
        });
      }
      
      console.log(`[PayPal Webhook] 处理批次: ${batchId}, 事件类型: ${eventType}`);
      
      db = await mysql.createConnection(dbConfig);
      await db.beginTransaction();
      
      try {
        // 查找对应的gateway_transaction记录（通过batch_id）
        const [gatewayTxs] = await db.execute(
          `SELECT id, response_payload 
           FROM payout_gateway_transaction 
           WHERE provider = 'paypal' 
           AND JSON_EXTRACT(response_payload, '$.batch_id') = ?`,
          [batchId]
        );
        
        if (gatewayTxs.length === 0) {
          console.warn(`[PayPal Webhook] 未找到批次ID ${batchId} 对应的记录`);
          console.warn(`[PayPal Webhook] 这可能是PayPal测试事件（模拟数据），批次ID: ${batchId}`);
          
          // 如果是测试事件（批次ID不存在），返回成功但不更新数据库
          // PayPal测试工具发送的是模拟数据，不会在数据库中找到对应的记录
          await db.rollback();
          return res.json({
            success: true,
            message: 'Test webhook received (batch not found in database, this is expected for test events)',
            event_type: eventType,
            batch_id: batchId,
            is_test_event: true
          });
        }
        
        const gatewayTx = gatewayTxs[0];
        
        // 从user_payout表中查找对应的payout_id（通过gateway_tx_id）
        const [payouts] = await db.execute(
          'SELECT id FROM user_payout WHERE gateway_tx_id = ?',
          [gatewayTx.id]
        );
        
        if (payouts.length === 0) {
          console.warn(`[PayPal Webhook] 未找到gateway_tx_id ${gatewayTx.id} 对应的支付单`);
          await db.rollback();
          return res.status(404).json({
            success: false,
            message: 'Payout not found'
          });
        }
        
        const payoutId = payouts[0].id;
        
        // 获取PayPal最新状态
        const paypalStatus = await paypalService.getPayoutStatus(batchId);
        const batchStatus = paypalStatus.batch_header?.batch_status || 'UNKNOWN';
        
        console.log(`[PayPal Webhook] 批次状态: ${batchStatus}`);
        
        // 更新gateway_transaction
        let dbStatus = 'processing';
        if (batchStatus === 'SUCCESS') {
          dbStatus = 'succeeded';
        } else if (batchStatus === 'DENIED' || batchStatus === 'FAILED') {
          dbStatus = 'failed';
        }
        
        await db.execute(
          `UPDATE payout_gateway_transaction 
           SET status = ?, 
               response_payload = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [
            dbStatus,
            JSON.stringify(paypalStatus),
            gatewayTx.id
          ]
        );
        
        // 更新user_payout
        if (batchStatus === 'SUCCESS') {
          await db.execute(
            `UPDATE user_payout 
             SET status = 'paid', 
                 paid_at = NOW(),
                 updated_at = NOW()
             WHERE id = ?`,
            [payoutId]
          );
          
          // 更新user_income_monthly
          const [payouts] = await db.execute(
            'SELECT income_monthly_id FROM user_payout WHERE id = ?',
            [payoutId]
          );
          
          if (payouts.length > 0 && payouts[0].income_monthly_id) {
            await db.execute(
              `UPDATE user_income_monthly
               SET payout_status = 'paid', payout_id = ?, updated_at = NOW()
               WHERE id = ?`,
              [payoutId, payouts[0].income_monthly_id]
            );
          }
          
          console.log(`[PayPal Webhook] 支付单 ${payoutId} 已标记为paid`);
        } else if (batchStatus === 'DENIED' || batchStatus === 'FAILED') {
          await db.execute(
            `UPDATE user_payout 
             SET status = 'failed',
                 updated_at = NOW()
             WHERE id = ?`,
            [payoutId]
          );
          
          console.log(`[PayPal Webhook] 支付单 ${payoutId} 已标记为failed`);
        }
        
        await db.commit();
        
        res.json({
          success: true,
          message: 'Webhook processed successfully'
        });
        
      } catch (error) {
        await db.rollback();
        throw error;
      }
    } 
    // 处理项目级别事件（PAYMENT.PAYOUTSITEM.*）
    else if (itemEventTypes.includes(eventType)) {
      console.log(`[PayPal Webhook] ========== 处理项目级别事件 ==========`);
      console.log(`[PayPal Webhook] resource.payout_item_id: ${resource.payout_item_id}`);
      console.log(`[PayPal Webhook] resource.payout_batch_id: ${resource.payout_batch_id}`);
      
      const payoutItemId = resource.payout_item_id;
      const batchId = resource.payout_batch_id;
      
      if (!batchId) {
        console.warn('[PayPal Webhook] ========== 错误：未找到批次ID ==========');
        console.warn('[PayPal Webhook] resource完整内容:', JSON.stringify(resource, null, 2));
        return res.status(400).json({
          success: false,
          message: 'Missing batch_id in resource'
        });
      }
      
      console.log(`[PayPal Webhook] ========== 处理支付项目事件 ==========`);
      console.log(`[PayPal Webhook] 批次ID: ${batchId}, 项目ID: ${payoutItemId}, 事件类型: ${eventType}`);
      
      db = await mysql.createConnection(dbConfig);
      await db.beginTransaction();
      
      try {
        // 查找对应的gateway_transaction记录（通过batch_id）
        console.log(`[PayPal Webhook] 开始查询批次ID: ${batchId}`);
        
        // 方法1: 通过JSON_EXTRACT查询response_payload中的batch_id
        const [gatewayTxs1] = await db.execute(
          `SELECT id, provider_tx_id, status, response_payload 
           FROM payout_gateway_transaction 
           WHERE provider = 'paypal' 
           AND JSON_EXTRACT(response_payload, '$.batch_id') = ?`,
          [batchId]
        );
        
        console.log(`[PayPal Webhook] 方法1 - 通过JSON_EXTRACT查询结果数量: ${gatewayTxs1.length}`);
        if (gatewayTxs1.length > 0) {
          console.log(`[PayPal Webhook] 方法1找到记录:`, {
            id: gatewayTxs1[0].id,
            provider_tx_id: gatewayTxs1[0].provider_tx_id,
            status: gatewayTxs1[0].status
          });
        }
        
        // 方法2: 通过provider_tx_id查询（因为batch_id通常存储在provider_tx_id中）
        let gatewayTxs = gatewayTxs1;
        if (gatewayTxs.length === 0) {
          console.log(`[PayPal Webhook] 方法2 - 尝试通过provider_tx_id查询: ${batchId}`);
          const [gatewayTxs2] = await db.execute(
            `SELECT id, provider_tx_id, status, response_payload 
             FROM payout_gateway_transaction 
             WHERE provider = 'paypal' 
             AND provider_tx_id = ?`,
            [batchId]
          );
          gatewayTxs = gatewayTxs2;
          console.log(`[PayPal Webhook] 方法2查询结果数量: ${gatewayTxs.length}`);
          if (gatewayTxs.length > 0) {
            console.log(`[PayPal Webhook] 方法2找到记录:`, {
              id: gatewayTxs[0].id,
              provider_tx_id: gatewayTxs[0].provider_tx_id,
              status: gatewayTxs[0].status
            });
          }
        }
        
        if (gatewayTxs.length === 0) {
          console.warn(`[PayPal Webhook] ========== 未找到批次ID ${batchId} 对应的记录 ==========`);
          console.warn(`[PayPal Webhook] 查询所有PayPal gateway_transaction记录:`);
          const [allTxs] = await db.execute(
            `SELECT id, provider_tx_id, status, response_payload 
             FROM payout_gateway_transaction 
             WHERE provider = 'paypal' 
             ORDER BY created_at DESC 
             LIMIT 10`
          );
          console.warn(`[PayPal Webhook] 最近10条PayPal记录:`);
          allTxs.forEach((tx, index) => {
            try {
              const payload = tx.response_payload ? (typeof tx.response_payload === 'string' ? JSON.parse(tx.response_payload) : tx.response_payload) : null;
              console.warn(`[PayPal Webhook] 记录${index + 1}:`, {
                id: tx.id,
                provider_tx_id: tx.provider_tx_id,
                status: tx.status,
                response_payload_batch_id: payload?.batch_id || null
              });
            } catch (e) {
              console.warn(`[PayPal Webhook] 记录${index + 1}解析失败:`, e.message);
            }
          });
          console.warn(`[PayPal Webhook] 这可能是PayPal测试事件（模拟数据），批次ID: ${batchId}`);
          
          // 如果是测试事件（批次ID不存在），返回成功但不更新数据库
          // PayPal测试工具发送的是模拟数据，不会在数据库中找到对应的记录
          await db.rollback();
          return res.json({
            success: true,
            message: 'Test webhook received (batch not found in database, this is expected for test events)',
            event_type: eventType,
            batch_id: batchId,
            is_test_event: true
          });
        }
        
        const gatewayTx = gatewayTxs[0];
        console.log(`[PayPal Webhook] 找到gateway_transaction记录:`, {
          id: gatewayTx.id,
          provider_tx_id: gatewayTx.provider_tx_id,
          status: gatewayTx.status
        });
        
        // 从user_payout表中查找对应的payout_id（通过gateway_tx_id）
        console.log(`[PayPal Webhook] 查询user_payout，gateway_tx_id: ${gatewayTx.id}`);
        const [payouts] = await db.execute(
          'SELECT id, user_id, month, income_monthly_id, status FROM user_payout WHERE gateway_tx_id = ?',
          [gatewayTx.id]
        );
        
        console.log(`[PayPal Webhook] user_payout查询结果数量: ${payouts.length}`);
        if (payouts.length > 0) {
          console.log(`[PayPal Webhook] user_payout详情:`, JSON.stringify(payouts[0], null, 2));
        }
        
        if (payouts.length === 0) {
          console.warn(`[PayPal Webhook] ========== 未找到gateway_tx_id ${gatewayTx.id} 对应的支付单 ==========`);
          console.warn(`[PayPal Webhook] 查询所有user_payout记录（gateway_tx_id不为NULL）:`);
          const [allPayouts] = await db.execute(
            `SELECT id, user_id, month, gateway_tx_id, status 
             FROM user_payout 
             WHERE gateway_tx_id IS NOT NULL 
             ORDER BY created_at DESC 
             LIMIT 10`
          );
          console.warn(`[PayPal Webhook] 最近10条有gateway_tx_id的payout记录:`, JSON.stringify(allPayouts, null, 2));
          await db.rollback();
          return res.status(404).json({
            success: false,
            message: `Payout not found for gateway_tx_id: ${gatewayTx.id}`
          });
        }
        
        const payoutId = payouts[0].id;
        console.log(`[PayPal Webhook] 找到支付单ID: ${payoutId}`);
        
        // 获取PayPal最新状态
        console.log(`[PayPal Webhook] 调用PayPal API查询批次状态，批次ID: ${batchId}`);
        const paypalStatus = await paypalService.getPayoutStatus(batchId);
        const batchStatus = paypalStatus.batch_header?.batch_status || 'UNKNOWN';
        console.log(`[PayPal Webhook] PayPal API返回状态: ${batchStatus}`);
        console.log(`[PayPal Webhook] PayPal API完整响应:`, JSON.stringify(paypalStatus, null, 2));
        
        // 根据事件类型确定状态（支持两种格式：PAYMENT.PAYOUTSITEM.* 和 PAYMENT.PAYOUTS-ITEM.*）
        let dbStatus = 'processing';
        let payoutStatus = 'processing';
        
        // 标准化事件类型（统一处理连字符）
        const normalizedEventType = eventType.replace('PAYOUTS-ITEM', 'PAYOUTSITEM');
        console.log(`[PayPal Webhook] 原始事件类型: ${eventType}`);
        console.log(`[PayPal Webhook] 标准化后事件类型: ${normalizedEventType}`);
        
        if (normalizedEventType === 'PAYMENT.PAYOUTSITEM.SUCCEEDED') {
          dbStatus = 'succeeded';
          payoutStatus = 'paid';
          console.log(`[PayPal Webhook] ✓ 事件类型匹配: SUCCEEDED -> dbStatus=succeeded, payoutStatus=paid`);
        } else if (normalizedEventType === 'PAYMENT.PAYOUTSITEM.FAILED' || normalizedEventType === 'PAYMENT.PAYOUTSITEM.RETURNED') {
          dbStatus = 'failed';
          payoutStatus = 'failed';
          console.log(`[PayPal Webhook] ✓ 事件类型匹配: FAILED/RETURNED -> dbStatus=failed, payoutStatus=failed`);
        } else if (normalizedEventType === 'PAYMENT.PAYOUTSITEM.HELD') {
          dbStatus = 'processing';
          payoutStatus = 'processing';
          console.log(`[PayPal Webhook] ✓ 事件类型匹配: HELD -> dbStatus=processing, payoutStatus=processing`);
        } else {
          console.warn(`[PayPal Webhook] ⚠ 警告：未知的事件类型: ${normalizedEventType}`);
        }
        
        console.log(`[PayPal Webhook] 最终状态 - 批次状态: ${batchStatus}, 数据库状态: ${dbStatus}, 支付单状态: ${payoutStatus}`);
        
        // 更新gateway_transaction
        await db.execute(
          `UPDATE payout_gateway_transaction 
           SET status = ?, 
               response_payload = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [
            dbStatus,
            JSON.stringify({
              ...paypalStatus,
              webhook_event: eventType,
              payout_item_id: payoutItemId,
              received_at: new Date().toISOString()
            }),
            gatewayTx.id
          ]
        );
        
        // 更新user_payout
        if (payoutStatus === 'paid') {
          await db.execute(
            `UPDATE user_payout 
             SET status = 'paid', 
                 paid_at = NOW(),
                 updated_at = NOW()
             WHERE id = ?`,
            [payoutId]
          );
          
          // 更新user_income_monthly
          console.log(`[PayPal Webhook] 查询user_payout的income_monthly_id，payout_id: ${payoutId}`);
          const [payoutRecords] = await db.execute(
            'SELECT income_monthly_id FROM user_payout WHERE id = ?',
            [payoutId]
          );
          
          console.log(`[PayPal Webhook] income_monthly_id查询结果:`, JSON.stringify(payoutRecords, null, 2));
          
          if (payoutRecords.length > 0 && payoutRecords[0].income_monthly_id) {
            const incomeMonthlyId = payoutRecords[0].income_monthly_id;
            console.log(`[PayPal Webhook] 更新user_income_monthly，id: ${incomeMonthlyId}, payout_id: ${payoutId}`);
            
            const [updateResult] = await db.execute(
              `UPDATE user_income_monthly
               SET payout_status = 'paid', payout_id = ?, updated_at = NOW()
               WHERE id = ?`,
              [payoutId, incomeMonthlyId]
            );
            
            console.log(`[PayPal Webhook] user_income_monthly更新结果:`, {
              affectedRows: updateResult.affectedRows,
              changedRows: updateResult.changedRows
            });
            
            // 验证更新结果
            const [verifyResult] = await db.execute(
              'SELECT id, payout_status, payout_id FROM user_income_monthly WHERE id = ?',
              [incomeMonthlyId]
            );
            console.log(`[PayPal Webhook] 验证user_income_monthly更新后状态:`, JSON.stringify(verifyResult[0], null, 2));
          } else {
            console.warn(`[PayPal Webhook] 警告：支付单 ${payoutId} 没有关联的income_monthly_id，跳过更新user_income_monthly`);
          }
          
          console.log(`[PayPal Webhook] ========== 支付单 ${payoutId} 已标记为paid（通过${eventType}事件） ==========`);
        } else if (payoutStatus === 'failed') {
          await db.execute(
            `UPDATE user_payout 
             SET status = 'failed',
                 updated_at = NOW()
             WHERE id = ?`,
            [payoutId]
          );
          
          console.log(`[PayPal Webhook] 支付单 ${payoutId} 已标记为failed（通过${eventType}事件）`);
        }
        
        await db.commit();
        
        res.json({
          success: true,
          message: 'Webhook processed successfully',
          event_type: eventType,
          payout_item_id: payoutItemId,
          batch_id: batchId
        });
        
      } catch (error) {
        await db.rollback();
        throw error;
      }
    } else {
      console.log(`[PayPal Webhook] 未处理的事件类型: ${eventType}`);
      res.json({
        success: true,
        message: 'Event type not handled'
      });
    }
    
  } catch (error) {
    console.error('[PayPal Webhook] 处理错误:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed: ' + error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// ==================== 运营端章节单价管理接口 ====================

// 获取小说的定价配置（包含unlockprice和促销活动）
router.get('/novels/:novelId/pricing-config', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { novelId } = req.params;
    db = await mysql.createConnection(dbConfig);
    
    // 获取unlockprice配置
    const [configs] = await db.execute(
      'SELECT * FROM unlockprice WHERE novel_id = ? LIMIT 1',
      [novelId]
    );
    
    // 获取该小说的所有促销活动
    const [promotions] = await db.execute(
      `SELECT * FROM pricing_promotion 
       WHERE novel_id = ? 
       ORDER BY created_at DESC`,
      [novelId]
    );
    
    res.json({
      success: true,
      data: {
        unlockprice: configs.length > 0 ? configs[0] : null,
        promotions: promotions
      }
    });
  } catch (error) {
    console.error('获取定价配置失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// 更新unlockprice配置
router.put('/novels/:novelId/unlockprice', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { novelId } = req.params;
    const { karma_per_1000, min_karma, max_karma, default_free_chapters } = req.body;
    
    if (!karma_per_1000 || !min_karma || !max_karma || default_free_chapters === undefined) {
      return res.status(400).json({ success: false, message: '参数不完整' });
    }
    
    if (min_karma > max_karma) {
      return res.status(400).json({ success: false, message: '最低价格不能大于最高价格' });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    // 检查是否存在
    const [existing] = await db.execute(
      'SELECT id FROM unlockprice WHERE novel_id = ?',
      [novelId]
    );
    
    if (existing.length > 0) {
      // 更新
      await db.execute(
        `UPDATE unlockprice 
         SET karma_per_1000 = ?, min_karma = ?, max_karma = ?, default_free_chapters = ?, updated_at = NOW()
         WHERE novel_id = ?`,
        [karma_per_1000, min_karma, max_karma, default_free_chapters, novelId]
      );
    } else {
      // 创建（需要user_id，从novel表获取）（使用ON DUPLICATE KEY UPDATE防止重复插入）
      const [novels] = await db.execute('SELECT user_id FROM novel WHERE id = ?', [novelId]);
      if (novels.length === 0) {
        return res.status(404).json({ success: false, message: '小说不存在' });
      }
      
      await db.execute(
        `INSERT INTO unlockprice (user_id, novel_id, karma_per_1000, min_karma, max_karma, default_free_chapters, pricing_style)
         VALUES (?, ?, ?, ?, ?, ?, 'per_word')
         ON DUPLICATE KEY UPDATE 
           karma_per_1000 = VALUES(karma_per_1000),
           min_karma = VALUES(min_karma),
           max_karma = VALUES(max_karma),
           default_free_chapters = VALUES(default_free_chapters),
           pricing_style = VALUES(pricing_style),
           updated_at = NOW()`,
        [novels[0].user_id, novelId, karma_per_1000, min_karma, max_karma, default_free_chapters]
      );
    }
    
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新unlockprice失败:', error);
    res.status(500).json({ success: false, message: '更新失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// 批量重新计算章节价格
router.post('/novels/:novelId/recalc-chapter-prices', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { novelId } = req.params;
    const { apply_from_chapter_number } = req.body;
    
    db = await mysql.createConnection(dbConfig);
    
    // 获取unlockprice配置
    const [configs] = await db.execute(
      'SELECT karma_per_1000, min_karma, max_karma, default_free_chapters FROM unlockprice WHERE novel_id = ?',
      [novelId]
    );
    
    if (configs.length === 0) {
      return res.status(404).json({ success: false, message: '未找到价格配置' });
    }
    
    const config = configs[0];
    const startChapter = apply_from_chapter_number || (config.default_free_chapters + 1);
    
    // 获取需要更新的章节
    const [chapters] = await db.execute(
      `SELECT id, chapter_number, 
              CASE 
                WHEN word_count IS NULL OR word_count = 0 THEN LENGTH(REPLACE(COALESCE(content, ''), ' ', ''))
                ELSE word_count
              END as word_count
       FROM chapter 
       WHERE novel_id = ? AND chapter_number >= ?
       ORDER BY chapter_number ASC`,
      [novelId, startChapter]
    );
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const chapter of chapters) {
      try {
        let basePrice = 0;
        
        // 前N章免费
        if (chapter.chapter_number <= config.default_free_chapters) {
          basePrice = 0;
        } else {
          const words = chapter.word_count || 0;
          if (words <= 0) {
            basePrice = config.min_karma;
          } else {
            basePrice = Math.ceil((words / 1000) * config.karma_per_1000);
            basePrice = Math.max(basePrice, config.min_karma);
            basePrice = Math.min(basePrice, config.max_karma);
          }
        }
        
        // 更新章节价格（只更新基础价格，不叠加促销）
        await db.execute(
          'UPDATE chapter SET unlock_price = ?, word_count = ? WHERE id = ?',
          [basePrice, chapter.word_count || 0, chapter.id]
        );
        
        updatedCount++;
      } catch (err) {
        console.error(`更新章节 ${chapter.id} 失败:`, err);
        errorCount++;
      }
    }
    
    res.json({
      success: true,
      message: `成功更新 ${updatedCount} 个章节，失败 ${errorCount} 个`,
      data: { updated: updatedCount, failed: errorCount }
    });
  } catch (error) {
    console.error('批量重新计算价格失败:', error);
    res.status(500).json({ success: false, message: '计算失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// 获取unlockprice列表（支持查询、排序、分页）
router.get('/unlockprice/list', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { 
      page = 1, 
      limit = 20, 
      novel_id, 
      user_id,
      sort_by = 'id',
      sort_order = 'DESC'
    } = req.query;
    
    db = await mysql.createConnection(dbConfig);
    
    // 构建查询条件
    const conditions = [];
    const params = [];
    
    if (novel_id) {
      conditions.push('u.novel_id = ?');
      params.push(parseInt(novel_id));
    }
    
    if (user_id) {
      conditions.push('u.user_id = ?');
      params.push(parseInt(user_id));
    }
    
    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    
    // 验证排序字段
    const allowedSortFields = ['id', 'novel_id', 'user_id', 'karma_per_1000', 'min_karma', 'max_karma', 'default_free_chapters', 'created_at', 'updated_at'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'id';
    const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    // 获取总数
    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total 
       FROM unlockprice u
       ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    
    // 获取分页数据（关联小说和用户信息）
    const offset = (parseInt(page) - 1) * parseInt(limit);
    // 使用 query 而不是 execute，因为排序字段名不能使用占位符
    // sortField 已经通过白名单验证，不会有SQL注入风险
    const [results] = await db.query(
      `SELECT 
         u.id,
         u.user_id,
         u.novel_id,
         u.karma_per_1000,
         u.min_karma,
         u.max_karma,
         u.default_free_chapters,
         u.pricing_style,
         u.created_at,
         u.updated_at,
         n.title as novel_title,
         n.author as novel_author,
         us.username as user_username,
         us.pen_name as user_pen_name
       FROM unlockprice u
       LEFT JOIN novel n ON u.novel_id = n.id
       LEFT JOIN user us ON u.user_id = us.id
       ${whereClause}
       ORDER BY u.${sortField} ${sortDirection}
       LIMIT ${parseInt(limit)} OFFSET ${offset}`,
      params
    );
    
    res.json({
      success: true,
      data: results,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('获取unlockprice列表失败:', error);
    res.status(500).json({ success: false, message: '获取列表失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// 获取待审核的促销活动列表
router.get('/pricing-promotions', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { status, novel_id } = req.query;
    db = await mysql.createConnection(dbConfig);
    
    let query = `
      SELECT pp.*, n.title as novel_title, u.username as author_username, u.pen_name as author_pen_name
      FROM pricing_promotion pp
      LEFT JOIN novel n ON pp.novel_id = n.id
      LEFT JOIN user u ON pp.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (status) {
      query += ' AND pp.status = ?';
      params.push(status);
    }
    
    if (novel_id) {
      query += ' AND pp.novel_id = ?';
      params.push(novel_id);
    }
    
    query += ' ORDER BY pp.created_at DESC';
    
    const [promotions] = await db.execute(query, params);
    
    res.json({ success: true, data: promotions });
  } catch (error) {
    console.error('获取促销活动列表失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// 审核/修改促销活动
router.put('/pricing-promotions/:id', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { id } = req.params;
    const { discount_value, start_at, end_at, status, remark, review_note } = req.body;
    const adminId = req.admin.adminId;
    
    db = await mysql.createConnection(dbConfig);
    
    // 获取原活动信息
    const [promotions] = await db.execute('SELECT * FROM pricing_promotion WHERE id = ?', [id]);
    if (promotions.length === 0) {
      return res.status(404).json({ success: false, message: '活动不存在' });
    }
    
    const promotion = promotions[0];
    
    // 构建更新字段
    const updateFields = [];
    const updateValues = [];
    
    if (discount_value !== undefined) {
      updateFields.push('discount_value = ?');
      updateValues.push(discount_value);
    }
    
    if (start_at !== undefined) {
      updateFields.push('start_at = ?');
      updateValues.push(start_at);
    }
    
    if (end_at !== undefined) {
      updateFields.push('end_at = ?');
      updateValues.push(end_at);
    }
    
    if (status !== undefined) {
      // 根据状态和时间自动设置正确的状态
      let finalStatus = status;
      const now = new Date();
      const startTime = start_at ? new Date(start_at) : null;
      const endTime = end_at ? new Date(end_at) : null;
      
      // 如果审核通过，根据时间设置状态
      if (status === 'approved') {
        if (startTime && startTime <= now && endTime && endTime >= now) {
          finalStatus = 'active'; // 活动已开始且未结束
        } else if (startTime && startTime > now) {
          finalStatus = 'scheduled'; // 活动未开始
        } else if (endTime && endTime < now) {
          finalStatus = 'expired'; // 活动已过期
        } else {
          finalStatus = 'approved'; // 保持approved状态
        }
        
        // 设置审核信息
        updateFields.push('approved_by = ?');
        updateFields.push('approved_at = NOW()');
        updateValues.push(adminId);
      } else if (status === 'rejected') {
        // 拒绝时也记录审核信息
        updateFields.push('approved_by = ?');
        updateFields.push('approved_at = NOW()');
        updateValues.push(adminId);
      }
      
      updateFields.push('status = ?');
      updateValues.push(finalStatus);
    }
    
    if (remark !== undefined) {
      updateFields.push('remark = ?');
      updateValues.push(remark);
    }
    
    if (review_note !== undefined) {
      updateFields.push('review_note = ?');
      updateValues.push(review_note);
    }
    
    updateFields.push('updated_at = NOW()');
    updateValues.push(id);
    
    await db.execute(
      `UPDATE pricing_promotion SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );
    
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新促销活动失败:', error);
    res.status(500).json({ success: false, message: '更新失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// 创建平台促销活动
router.post('/pricing-promotions', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { novel_id, promotion_type, discount_value, start_at, end_at, remark } = req.body;
    const adminId = req.admin.adminId;
    
    if (!novel_id || !promotion_type || discount_value === undefined || !start_at || !end_at) {
      return res.status(400).json({ success: false, message: '参数不完整' });
    }
    
    // 验证折扣值
    if (discount_value < 0 || discount_value > 1) {
      return res.status(400).json({ success: false, message: '折扣值必须在0-1之间' });
    }
    
    // 验证时间
    const startTime = new Date(start_at);
    const endTime = new Date(end_at);
    const now = new Date();
    
    let status = 'scheduled';
    if (startTime <= now && endTime >= now) {
      status = 'active';
    }
    
    db = await mysql.createConnection(dbConfig);
    
    // 插入促销活动
    const [result] = await db.execute(
      `INSERT INTO pricing_promotion 
       (novel_id, promotion_type, discount_value, start_at, end_at, status, created_by, created_role, approved_by, approved_at, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'admin', ?, NOW(), ?)`,
      [novel_id, promotion_type, discount_value, start_at, end_at, status, adminId, adminId, remark || null]
    );
    
    res.json({
      success: true,
      message: '创建成功',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('创建促销活动失败:', error);
    res.status(500).json({ success: false, message: '创建失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

module.exports = router;

