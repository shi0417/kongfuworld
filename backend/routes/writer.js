const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();
const QRCode = require('qrcode');
const crypto = require('crypto');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

// 工具函数：解析月份格式
function parseMonth(month) {
  if (!month) return null;
  // 如果已经是 YYYY-MM-DD 格式，直接返回
  if (month.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return month;
  }
  // 如果是 YYYY-MM 格式，补全为 YYYY-MM-01
  if (month.match(/^\d{4}-\d{2}$/)) {
    return `${month}-01`;
  }
  // 如果已经是 YYYY-MM-01 格式（前端可能已经加了 -01），直接返回
  return month;
}

// 中间件：验证作者身份
const authenticateAuthor = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ success: false, message: '请先登录' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, 'your-secret-key');
    const userId = decoded.userId || decoded.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: '请先登录' });
    }

    // 检查用户是否是作者
    const db = await mysql.createConnection(dbConfig);
    const [users] = await db.execute(
      'SELECT is_author FROM user WHERE id = ?',
      [userId]
    );
    await db.end();

    if (users.length === 0 || !users[0].is_author) {
      return res.status(403).json({ success: false, message: '您不是作者，无权访问' });
    }

    req.authorId = userId;
    req.userId = userId;
    next();
  } catch (error) {
    console.error('验证作者身份失败:', error);
    res.status(500).json({ success: false, message: '验证失败' });
  }
};

// ==================== 作者收入相关接口 ====================

// 获取作者收入汇总
router.get('/income/summary', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const { month, novel_id } = req.query;
    const authorId = req.authorId;
    
    if (!month) {
      return res.status(400).json({
        success: false,
        message: '请指定月份（格式：2025-10-01）'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    // 解析月份格式
    const monthStart = parseMonth(month);
    if (!monthStart) {
      return res.status(400).json({
        success: false,
        message: '月份格式错误，应为 YYYY-MM 或 YYYY-MM-DD'
      });
    }
    
    console.log(`[收入汇总] authorId=${authorId}, month=${month}, monthStart=${monthStart}`);
    
    // 1. 基础作者收入
    let baseIncomeQuery = `
      SELECT COALESCE(SUM(ar.author_amount_usd), 0) as base_income
      FROM author_royalty ar
      WHERE ar.author_id = ? AND ar.settlement_month = ?
    `;
    const baseParams = [authorId, monthStart];
    
    if (novel_id && novel_id !== 'all') {
      baseIncomeQuery += ' AND ar.novel_id = ?';
      baseParams.push(parseInt(novel_id));
    }
    
    const [baseResult] = await db.execute(baseIncomeQuery, baseParams);
    const authorBaseIncome = parseFloat(baseResult[0].base_income || 0);
    
    // 2. 读者推广收入
    let readerReferralQuery = `
      SELECT COALESCE(SUM(ct.commission_amount_usd), 0) as reader_referral_income
      FROM commission_transaction ct
      WHERE ct.user_id = ? 
        AND ct.commission_type = 'reader_referral'
        AND ct.settlement_month = ?
    `;
    const readerParams = [authorId, monthStart];
    
    if (novel_id && novel_id !== 'all') {
      readerReferralQuery += ' AND ct.novel_id = ?';
      readerParams.push(parseInt(novel_id));
    }
    
    const [readerResult] = await db.execute(readerReferralQuery, readerParams);
    const readerReferralIncome = parseFloat(readerResult[0].reader_referral_income || 0);
    
    // 3. 作者推广收入
    let authorReferralQuery = `
      SELECT COALESCE(SUM(ct.commission_amount_usd), 0) as author_referral_income
      FROM commission_transaction ct
      WHERE ct.user_id = ? 
        AND ct.commission_type = 'author_referral'
        AND ct.settlement_month = ?
    `;
    const authorParams = [authorId, monthStart];
    
    if (novel_id && novel_id !== 'all') {
      authorReferralQuery += ' AND ct.novel_id = ?';
      authorParams.push(parseInt(novel_id));
    }
    
    const [authorResult] = await db.execute(authorReferralQuery, authorParams);
    const authorReferralIncome = parseFloat(authorResult[0].author_referral_income || 0);
    
    const totalIncome = authorBaseIncome + readerReferralIncome + authorReferralIncome;
    
    res.json({
      success: true,
      data: {
        month: monthStart,
        author_base_income: authorBaseIncome.toFixed(8),
        reader_referral_income: readerReferralIncome.toFixed(8),
        author_referral_income: authorReferralIncome.toFixed(8),
        total_income: totalIncome.toFixed(8)
      }
    });
  } catch (error) {
    console.error('获取作者收入汇总错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 按作品汇总收入
router.get('/income/by-novel', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const { month } = req.query;
    const authorId = req.authorId;
    
    if (!month) {
      return res.status(400).json({
        success: false,
        message: '请指定月份（格式：2025-10-01）'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    const monthStart = parseMonth(month);
    if (!monthStart) {
      return res.status(400).json({
        success: false,
        message: '月份格式错误'
      });
    }
    
    // 获取作者的所有作品
    const [novels] = await db.execute(
      'SELECT id, title FROM novel WHERE user_id = ?',
      [authorId]
    );
    
    const result = await Promise.all(novels.map(async (novel) => {
      // 基础收入（只统计该作品的基础收入）
      const [baseResult] = await db.execute(
        `SELECT COALESCE(SUM(author_amount_usd), 0) as base_income
         FROM author_royalty
         WHERE author_id = ? AND novel_id = ? AND settlement_month = ?`,
        [authorId, novel.id, monthStart]
      );
      const authorBaseIncome = parseFloat(baseResult[0].base_income || 0);
      
      // 注意：读者推广收入和作者推广收入不按作品统计
      // 因为推广收入可能来自其他作品，不应该归属到特定作品
      
      return {
        novel_id: novel.id,
        novel_title: novel.title,
        author_base_income: authorBaseIncome.toFixed(8),
        reader_referral_income: '0.00000000', // 不按作品统计
        author_referral_income: '0.00000000', // 不按作品统计
        total_income: authorBaseIncome.toFixed(8) // 只显示基础收入
      };
    }));
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('获取按作品汇总收入错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取基础收入明细
router.get('/income/details/base', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const { month, novel_id, page = 1, pageSize = 20 } = req.query;
    const authorId = req.authorId;
    
    if (!month) {
      return res.status(400).json({
        success: false,
        message: '请指定月份'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    const monthStart = parseMonth(month);
    if (!monthStart) {
      return res.status(400).json({
        success: false,
        message: '月份格式错误'
      });
    }
    const pageNum = parseInt(page) || 1;
    const pageSizeNum = parseInt(pageSize) || 20;
    const offset = (pageNum - 1) * pageSizeNum;
    
    let query = `
      SELECT 
        ar.id,
        ar.created_at as time,
        n.title as novel_title,
        rs.source_type,
        u.username as reader_username,
        rs.amount_usd as consumer_amount,
        ar.author_amount_usd
      FROM author_royalty ar
      LEFT JOIN reader_spending rs ON ar.source_spend_id = rs.id
      LEFT JOIN novel n ON ar.novel_id = n.id
      LEFT JOIN user u ON rs.user_id = u.id
      WHERE ar.author_id = ? AND ar.settlement_month = ?
    `;
    const params = [authorId, monthStart];
    
    if (novel_id && novel_id !== 'all') {
      query += ' AND ar.novel_id = ?';
      params.push(parseInt(novel_id));
    }
    
    // LIMIT 和 OFFSET 使用字符串插值，因为它们是安全的数字值
    query += ` ORDER BY ar.created_at DESC LIMIT ${pageSizeNum} OFFSET ${offset}`;
    
    const [details] = await db.execute(query, params);
    
    // 获取总数
    let countQuery = `
      SELECT COUNT(*) as total
      FROM author_royalty ar
      WHERE ar.author_id = ? AND ar.settlement_month = ?
    `;
    const countParams = [authorId, monthStart];
    if (novel_id && novel_id !== 'all') {
      countQuery += ' AND ar.novel_id = ?';
      countParams.push(parseInt(novel_id));
    }
    const [countResult] = await db.execute(countQuery, countParams);
    const total = countResult[0].total;
    
    res.json({
      success: true,
      data: details.map(d => ({
        id: d.id,
        time: d.time,
        novel_title: d.novel_title,
        source_type: d.source_type === 'chapter_unlock' ? '章节解锁' : '订阅',
        reader_username: d.reader_username,
        consumer_amount: parseFloat(d.consumer_amount || 0).toFixed(8),
        author_amount: parseFloat(d.author_amount_usd || 0).toFixed(8)
      })),
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: total,
        totalPages: Math.ceil(total / parseInt(pageSize))
      }
    });
  } catch (error) {
    console.error('获取基础收入明细错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取读者推广收入明细
router.get('/income/details/reader-referral', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const { month, novel_id, page = 1, pageSize = 20 } = req.query;
    const authorId = req.authorId;
    
    if (!month) {
      return res.status(400).json({
        success: false,
        message: '请指定月份'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    const monthStart = parseMonth(month);
    if (!monthStart) {
      return res.status(400).json({
        success: false,
        message: '月份格式错误'
      });
    }
    const pageNum = parseInt(page) || 1;
    const pageSizeNum = parseInt(pageSize) || 20;
    const offset = (pageNum - 1) * pageSizeNum;
    
    let query = `
      SELECT 
        ct.id,
        ct.created_at as time,
        u.username as reader_username,
        n.title as novel_title,
        ct.level,
        cpl.percent,
        ct.base_amount_usd,
        ct.commission_amount_usd
      FROM commission_transaction ct
      LEFT JOIN user u ON ct.source_user_id = u.id
      LEFT JOIN novel n ON ct.novel_id = n.id
      LEFT JOIN commission_plan_level cpl ON ct.plan_id = cpl.plan_id AND ct.level = cpl.level
      WHERE ct.user_id = ? 
        AND ct.commission_type = 'reader_referral'
        AND ct.settlement_month = ?
    `;
    const params = [authorId, monthStart];
    
    if (novel_id && novel_id !== 'all') {
      query += ' AND ct.novel_id = ?';
      params.push(parseInt(novel_id));
    }
    
    // LIMIT 和 OFFSET 使用字符串插值，因为它们是安全的数字值
    query += ` ORDER BY ct.created_at DESC LIMIT ${pageSizeNum} OFFSET ${offset}`;
    
    const [details] = await db.execute(query, params);
    
    // 获取总数
    let countQuery = `
      SELECT COUNT(*) as total
      FROM commission_transaction ct
      WHERE ct.user_id = ? 
        AND ct.commission_type = 'reader_referral'
        AND ct.settlement_month = ?
    `;
    const countParams = [authorId, monthStart];
    if (novel_id && novel_id !== 'all') {
      countQuery += ' AND ct.novel_id = ?';
      countParams.push(parseInt(novel_id));
    }
    const [countResult] = await db.execute(countQuery, countParams);
    const total = countResult[0].total;
    
    res.json({
      success: true,
      data: details.map(d => ({
        id: d.id,
        time: d.time,
        reader_username: d.reader_username,
        novel_title: d.novel_title,
        level: d.level,
        percent: d.percent ? (parseFloat(d.percent) * 100).toFixed(2) + '%' : '-',
        base_amount: parseFloat(d.base_amount_usd || 0).toFixed(8),
        commission_amount: parseFloat(d.commission_amount_usd || 0).toFixed(8)
      })),
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: total,
        totalPages: Math.ceil(total / parseInt(pageSize))
      }
    });
  } catch (error) {
    console.error('获取读者推广收入明细错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取作者推广收入明细
router.get('/income/details/author-referral', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const { month, novel_id, page = 1, pageSize = 20 } = req.query;
    const authorId = req.authorId;
    
    if (!month) {
      return res.status(400).json({
        success: false,
        message: '请指定月份'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    const monthStart = parseMonth(month);
    if (!monthStart) {
      return res.status(400).json({
        success: false,
        message: '月份格式错误'
      });
    }
    const pageNum = parseInt(page) || 1;
    const pageSizeNum = parseInt(pageSize) || 20;
    const offset = (pageNum - 1) * pageSizeNum;
    
    let query = `
      SELECT 
        ct.id,
        ct.created_at as time,
        u.username as author_username,
        u.pen_name as author_pen_name,
        n.title as novel_title,
        ct.level,
        cpl.percent,
        ct.base_amount_usd,
        ct.commission_amount_usd
      FROM commission_transaction ct
      LEFT JOIN user u ON ct.source_author_id = u.id
      LEFT JOIN novel n ON ct.novel_id = n.id
      LEFT JOIN commission_plan_level cpl ON ct.plan_id = cpl.plan_id AND ct.level = cpl.level
      WHERE ct.user_id = ? 
        AND ct.commission_type = 'author_referral'
        AND ct.settlement_month = ?
    `;
    const params = [authorId, monthStart];
    
    if (novel_id && novel_id !== 'all') {
      query += ' AND ct.novel_id = ?';
      params.push(parseInt(novel_id));
    }
    
    // LIMIT 和 OFFSET 使用字符串插值，因为它们是安全的数字值
    query += ` ORDER BY ct.created_at DESC LIMIT ${pageSizeNum} OFFSET ${offset}`;
    
    const [details] = await db.execute(query, params);
    
    // 获取总数
    let countQuery = `
      SELECT COUNT(*) as total
      FROM commission_transaction ct
      WHERE ct.user_id = ? 
        AND ct.commission_type = 'author_referral'
        AND ct.settlement_month = ?
    `;
    const countParams = [authorId, monthStart];
    if (novel_id && novel_id !== 'all') {
      countQuery += ' AND ct.novel_id = ?';
      countParams.push(parseInt(novel_id));
    }
    const [countResult] = await db.execute(countQuery, countParams);
    const total = countResult[0].total;
    
    res.json({
      success: true,
      data: details.map(d => ({
        id: d.id,
        time: d.time,
        author_username: d.author_username,
        author_pen_name: d.author_pen_name,
        novel_title: d.novel_title,
        level: d.level,
        percent: d.percent ? (parseFloat(d.percent) * 100).toFixed(2) + '%' : '-',
        base_amount: parseFloat(d.base_amount_usd || 0).toFixed(8),
        commission_amount: parseFloat(d.commission_amount_usd || 0).toFixed(8)
      })),
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: total,
        totalPages: Math.ceil(total / parseInt(pageSize))
      }
    });
  } catch (error) {
    console.error('获取作者推广收入明细错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// ==================== 推广链接相关接口 ====================

// 生成推广码
function generateReferralCode(userId, linkType) {
  // 使用用户ID + 类型 + 随机字符串生成唯一码
  const randomStr = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${linkType.toUpperCase().substring(0, 1)}${userId}${randomStr}`;
}

// 获取或生成推广码
router.post('/referral-code/generate', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const { link_type = 'reader' } = req.body;
    const userId = req.userId;
    
    if (!['reader', 'author'].includes(link_type)) {
      return res.status(400).json({
        success: false,
        message: 'link_type 必须是 reader 或 author'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    // 检查是否已存在
    const [existing] = await db.execute(
      'SELECT * FROM user_referral_code WHERE user_id = ? AND link_type = ?',
      [userId, link_type]
    );
    
    if (existing.length > 0) {
      // 已存在，直接返回
      const code = existing[0];
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const referralUrl = link_type === 'reader' 
        ? `${baseUrl}/signup?ref=${code.code}&type=reader`
        : `${baseUrl}/writers-zone/signup?ref=${code.code}&type=author`;
      
      return res.json({
        success: true,
        data: {
          code: code.code,
          link_type: code.link_type,
          referral_url: referralUrl,
          created_at: code.created_at
        }
      });
    }
    
    // 生成新码
    let code;
    let attempts = 0;
    while (attempts < 10) {
      code = generateReferralCode(userId, link_type);
      const [duplicate] = await db.execute(
        'SELECT id FROM user_referral_code WHERE code = ?',
        [code]
      );
      if (duplicate.length === 0) {
        break;
      }
      attempts++;
    }
    
    if (attempts >= 10) {
      return res.status(500).json({
        success: false,
        message: '生成推广码失败，请重试'
      });
    }
    
    // 插入数据库
    const [result] = await db.execute(
      'INSERT INTO user_referral_code (user_id, code, link_type) VALUES (?, ?, ?)',
      [userId, code, link_type]
    );
    
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const referralUrl = link_type === 'reader' 
      ? `${baseUrl}/signup?ref=${code}&type=reader`
      : `${baseUrl}/writers-zone/signup?ref=${code}&type=author`;
    
    res.json({
      success: true,
      data: {
        code: code,
        link_type: link_type,
        referral_url: referralUrl,
        created_at: new Date()
      }
    });
  } catch (error) {
    console.error('生成推广码错误:', error);
    res.status(500).json({
      success: false,
      message: '生成失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取推广码信息
router.get('/referral-code', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const { link_type = 'reader' } = req.query;
    const userId = req.userId;
    
    db = await mysql.createConnection(dbConfig);
    
    const [codes] = await db.execute(
      'SELECT * FROM user_referral_code WHERE user_id = ? AND link_type = ?',
      [userId, link_type]
    );
    
    if (codes.length === 0) {
      return res.json({
        success: true,
        data: null
      });
    }
    
    const code = codes[0];
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const referralUrl = link_type === 'reader' 
      ? `${baseUrl}/signup?ref=${code.code}&type=reader`
      : `${baseUrl}/writers-zone/signup?ref=${code.code}&type=author`;
    
    res.json({
      success: true,
      data: {
        code: code.code,
        link_type: code.link_type,
        referral_url: referralUrl,
        created_at: code.created_at
      }
    });
  } catch (error) {
    console.error('获取推广码错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 生成二维码
router.get('/referral-code/qrcode', authenticateAuthor, async (req, res) => {
  try {
    const { link_type = 'reader' } = req.query;
    const userId = req.userId;
    
    // 获取推广码
    const db = await mysql.createConnection(dbConfig);
    const [codes] = await db.execute(
      'SELECT * FROM user_referral_code WHERE user_id = ? AND link_type = ?',
      [userId, link_type]
    );
    await db.end();
    
    if (codes.length === 0) {
      return res.status(404).json({
        success: false,
        message: '推广码不存在，请先生成'
      });
    }
    
    const code = codes[0];
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const referralUrl = link_type === 'reader' 
      ? `${baseUrl}/signup?ref=${code.code}&type=reader`
      : `${baseUrl}/writers-zone/signup?ref=${code.code}&type=author`;
    
    // 生成二维码
    const qrCodeDataURL = await QRCode.toDataURL(referralUrl, {
      width: 300,
      margin: 2
    });
    
    res.json({
      success: true,
      data: {
        qrcode: qrCodeDataURL,
        url: referralUrl
      }
    });
  } catch (error) {
    console.error('生成二维码错误:', error);
    res.status(500).json({
      success: false,
      message: '生成失败',
      error: error.message
    });
  }
});

// 获取推广统计
router.get('/referral/stats', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const { month } = req.query;
    const userId = req.userId;
    
    db = await mysql.createConnection(dbConfig);
    
    // 1. 累计推广注册用户数
    const [referredUsers] = await db.execute(
      'SELECT COUNT(*) as count FROM referrals WHERE referrer_id = ?',
      [userId]
    );
    const totalReferredUsers = referredUsers[0].count;
    
    // 2. 累计推广付费用户数（有消费的下级）
    const [payingUsers] = await db.execute(
      `SELECT COUNT(DISTINCT r.user_id) as count
       FROM referrals r
       INNER JOIN reader_spending rs ON r.user_id = rs.user_id
       WHERE r.referrer_id = ?`,
      [userId]
    );
    const totalPayingUsers = payingUsers[0].count;
    
    // 3. 读者推广收入
    let readerIncome = 0;
    if (month) {
      const monthStart = parseMonth(month);
      if (monthStart) {
        const [readerResult] = await db.execute(
          `SELECT COALESCE(SUM(commission_amount_usd), 0) as income
           FROM commission_transaction
           WHERE user_id = ? AND commission_type = 'reader_referral' AND settlement_month = ?`,
          [userId, monthStart]
        );
        readerIncome = parseFloat(readerResult[0].income || 0);
      }
    } else {
      const [readerResult] = await db.execute(
        `SELECT COALESCE(SUM(commission_amount_usd), 0) as income
         FROM commission_transaction
         WHERE user_id = ? AND commission_type = 'reader_referral'`,
        [userId]
      );
      readerIncome = parseFloat(readerResult[0].income || 0);
    }
    
    // 4. 作者推广收入
    let authorIncome = 0;
    if (month) {
      const monthStart = parseMonth(month);
      if (monthStart) {
        const [authorResult] = await db.execute(
          `SELECT COALESCE(SUM(commission_amount_usd), 0) as income
           FROM commission_transaction
           WHERE user_id = ? AND commission_type = 'author_referral' AND settlement_month = ?`,
          [userId, monthStart]
        );
        authorIncome = parseFloat(authorResult[0].income || 0);
      }
    } else {
      const [authorResult] = await db.execute(
        `SELECT COALESCE(SUM(commission_amount_usd), 0) as income
         FROM commission_transaction
         WHERE user_id = ? AND commission_type = 'author_referral'`,
        [userId]
      );
      authorIncome = parseFloat(authorResult[0].income || 0);
    }
    
    // 5. 最近30天每日数据（可选）
    const daily = [];
    if (month) {
      const monthStart = parseMonth(month);
      if (monthStart) {
      // 获取该月每日新增推广用户数
      const [dailyReferrals] = await db.execute(
        `SELECT 
          DATE(created_at) as date,
          COUNT(*) as new_referred_users
         FROM referrals
         WHERE referrer_id = ? AND DATE(created_at) >= ? AND DATE(created_at) < DATE_ADD(?, INTERVAL 1 MONTH)
         GROUP BY DATE(created_at)
         ORDER BY date DESC`,
        [userId, monthStart, monthStart]
      );
      
      // 获取该月每日推广收入
      const [dailyIncome] = await db.execute(
        `SELECT 
          DATE(created_at) as date,
          COALESCE(SUM(commission_amount_usd), 0) as referral_income
         FROM commission_transaction
         WHERE user_id = ? AND settlement_month = ?
         GROUP BY DATE(created_at)
         ORDER BY date DESC`,
        [userId, monthStart]
      );
      
      // 合并数据
      const dailyMap = new Map();
      dailyReferrals.forEach(row => {
        const dateStr = row.date instanceof Date 
          ? row.date.toISOString().split('T')[0] 
          : (typeof row.date === 'string' ? row.date.split('T')[0] : row.date);
        dailyMap.set(dateStr, {
          date: dateStr,
          new_referred_users: parseInt(row.new_referred_users || 0),
          referral_income: 0
        });
      });
      
      dailyIncome.forEach(row => {
        const dateStr = row.date instanceof Date 
          ? row.date.toISOString().split('T')[0] 
          : (typeof row.date === 'string' ? row.date.split('T')[0] : row.date);
        if (dailyMap.has(dateStr)) {
          dailyMap.get(dateStr).referral_income = parseFloat(row.referral_income || 0).toFixed(8);
        } else {
          dailyMap.set(dateStr, {
            date: dateStr,
            new_referred_users: 0,
            referral_income: parseFloat(row.referral_income || 0).toFixed(8)
          });
        }
      });
      
      daily.push(...Array.from(dailyMap.values()).slice(0, 30));
      }
    }
    
    res.json({
      success: true,
      data: {
        month: month || null,
        total_referred_users: totalReferredUsers,
        total_paying_users: totalPayingUsers,
        reader_referral_income: readerIncome.toFixed(8),
        author_referral_income: authorIncome.toFixed(8),
        total_referral_income: (readerIncome + authorIncome).toFixed(8),
        daily: daily
      }
    });
  } catch (error) {
    console.error('获取推广统计错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取当前推广方案
router.get('/referral/plans', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const userId = req.userId;
    db = await mysql.createConnection(dbConfig);
    
    // 获取当前用户的专属读者推广方案（优先）
    let [customReaderPlans] = await db.execute(
      `SELECT cp.*, 
       GROUP_CONCAT(CONCAT(cpl.level, ':', cpl.percent) ORDER BY cpl.level SEPARATOR '/') as levels
       FROM commission_plan cp
       LEFT JOIN commission_plan_level cpl ON cp.id = cpl.plan_id
       WHERE cp.plan_type = 'reader_promoter' 
         AND cp.is_custom = 1
         AND cp.owner_user_id = ?
         AND cp.start_date <= NOW()
         AND (cp.end_date IS NULL OR cp.end_date >= NOW())
       GROUP BY cp.id
       ORDER BY cp.start_date DESC
       LIMIT 1`,
      [userId]
    );
    
    // 如果没有专属方案，获取通用读者推广方案
    let readerPlans = customReaderPlans;
    if (!readerPlans || readerPlans.length === 0) {
      [readerPlans] = await db.execute(
        `SELECT cp.*, 
         GROUP_CONCAT(CONCAT(cpl.level, ':', cpl.percent) ORDER BY cpl.level SEPARATOR '/') as levels
         FROM commission_plan cp
         LEFT JOIN commission_plan_level cpl ON cp.id = cpl.plan_id
         WHERE cp.plan_type = 'reader_promoter' 
           AND cp.is_custom = 0
           AND cp.owner_user_id IS NULL
           AND cp.start_date <= NOW()
           AND (cp.end_date IS NULL OR cp.end_date >= NOW())
         GROUP BY cp.id
         ORDER BY cp.start_date DESC
         LIMIT 1`
      );
    }
    
    // 获取当前用户的专属作者推广方案（优先）
    let [customAuthorPlans] = await db.execute(
      `SELECT cp.*, 
       GROUP_CONCAT(CONCAT(cpl.level, ':', cpl.percent) ORDER BY cpl.level SEPARATOR '/') as levels
       FROM commission_plan cp
       LEFT JOIN commission_plan_level cpl ON cp.id = cpl.plan_id
       WHERE cp.plan_type = 'author_promoter' 
         AND cp.is_custom = 1
         AND cp.owner_user_id = ?
         AND cp.start_date <= NOW()
         AND (cp.end_date IS NULL OR cp.end_date >= NOW())
       GROUP BY cp.id
       ORDER BY cp.start_date DESC
       LIMIT 1`,
      [userId]
    );
    
    // 如果没有专属方案，获取通用作者推广方案
    let authorPlans = customAuthorPlans;
    if (!authorPlans || authorPlans.length === 0) {
      [authorPlans] = await db.execute(
        `SELECT cp.*, 
         GROUP_CONCAT(CONCAT(cpl.level, ':', cpl.percent) ORDER BY cpl.level SEPARATOR '/') as levels
         FROM commission_plan cp
         LEFT JOIN commission_plan_level cpl ON cp.id = cpl.plan_id
         WHERE cp.plan_type = 'author_promoter' 
           AND cp.is_custom = 0
           AND cp.owner_user_id IS NULL
           AND cp.start_date <= NOW()
           AND (cp.end_date IS NULL OR cp.end_date >= NOW())
         GROUP BY cp.id
         ORDER BY cp.start_date DESC
         LIMIT 1`
      );
    }
    
    // 格式化方案信息
    const formatPlan = (plan) => {
      if (!plan || plan.length === 0) return null;
      const p = plan[0];
      const levels = p.levels ? p.levels.split('/').map(l => {
        const [level, percent] = l.split(':');
        return {
          level: parseInt(level),
          percent: parseFloat(percent),
          percent_display: (parseFloat(percent) * 100).toFixed(2) + '%'
        };
      }) : [];
      
      return {
        id: p.id,
        name: p.name,
        max_level: p.max_level,
        is_custom: p.is_custom === 1,
        levels: levels
      };
    };
    
    res.json({
      success: true,
      data: {
        reader_plan: formatPlan(readerPlans),
        author_plan: formatPlan(authorPlans)
      }
    });
  } catch (error) {
    console.error('获取推广方案错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取下级列表
router.get('/referral/subordinates', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const userId = req.userId;
    const pageNum = parseInt(page) || 1;
    const pageSizeNum = parseInt(pageSize) || 20;
    const offset = (pageNum - 1) * pageSizeNum;
    
    db = await mysql.createConnection(dbConfig);
    
    const [subordinates] = await db.execute(
      `SELECT 
        r.user_id,
        u.username,
        u.pen_name,
        r.created_at as register_time,
        CASE 
          WHEN u.is_author = 1 THEN '作者'
          ELSE '读者'
        END as user_type,
        COALESCE(SUM(rs.amount_usd), 0) as total_consumption,
        COALESCE(SUM(ct.commission_amount_usd), 0) as total_commission
       FROM referrals r
       LEFT JOIN user u ON r.user_id = u.id
       LEFT JOIN reader_spending rs ON r.user_id = rs.user_id
       LEFT JOIN commission_transaction ct ON ct.user_id = ? AND (
         (ct.commission_type = 'reader_referral' AND ct.source_user_id = r.user_id) OR
         (ct.commission_type = 'author_referral' AND ct.source_author_id = r.user_id)
       )
       WHERE r.referrer_id = ?
       GROUP BY r.user_id, u.username, u.pen_name, r.created_at, u.is_author
       ORDER BY r.created_at DESC
       LIMIT ${pageSizeNum} OFFSET ${offset}`,
      [userId, userId]
    );
    
    // 获取总数
    const [countResult] = await db.execute(
      'SELECT COUNT(*) as total FROM referrals WHERE referrer_id = ?',
      [userId]
    );
    const total = countResult[0].total;
    
    res.json({
      success: true,
      data: subordinates.map(s => ({
        user_id: s.user_id,
        username: s.username,
        pen_name: s.pen_name,
        register_time: s.register_time,
        user_type: s.user_type,
        total_consumption: parseFloat(s.total_consumption || 0).toFixed(8),
        total_commission: parseFloat(s.total_commission || 0).toFixed(8)
      })),
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: total,
        totalPages: Math.ceil(total / parseInt(pageSize))
      }
    });
  } catch (error) {
    console.error('获取下级列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// ==================== 结算管理相关接口 ====================

// 获取用户月度收入列表（用于结算管理）
router.get('/income/monthly', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const userId = req.authorId;
    const { limit = 12 } = req.query; // 默认显示最近12个月
    
    const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 12));
    
    db = await mysql.createConnection(dbConfig);
    
    const [rows] = await db.query(
      `SELECT 
        uim.month,
        uim.author_base_income_usd,
        uim.reader_referral_income_usd,
        uim.author_referral_income_usd,
        uim.total_income_usd,
        uim.paid_amount_usd,
        uim.paid_amount_rmb,
        uim.payout_status,
        uim.payout_id,
        up.payout_currency,
        up.payout_amount,
        -- 计算未支付金额：如果有支付记录，根据币种计算
        CASE 
          WHEN uim.payout_status = 'paid' THEN 0
          ELSE uim.total_income_usd
        END as unpaid_amount
       FROM user_income_monthly uim
       LEFT JOIN user_payout up ON uim.payout_id = up.id
       WHERE uim.user_id = ?
       ORDER BY uim.month DESC
       LIMIT ${limitNum}`,
      [userId]
    );
    
    res.json({
      success: true,
      data: rows.map(row => ({
        month: row.month,
        author_base_income_usd: parseFloat(row.author_base_income_usd || 0),
        reader_referral_income_usd: parseFloat(row.reader_referral_income_usd || 0),
        author_referral_income_usd: parseFloat(row.author_referral_income_usd || 0),
        total_income_usd: parseFloat(row.total_income_usd || 0),
        paid_amount_usd: parseFloat(row.paid_amount_usd || 0),
        paid_amount_rmb: parseFloat(row.paid_amount_rmb || 0),
        payout_status: row.payout_status,
        payout_currency: row.payout_currency || null, // 支付币种
        payout_amount: row.payout_amount ? parseFloat(row.payout_amount) : null, // 实际支付金额
        unpaid_amount: parseFloat(row.unpaid_amount || 0)
      }))
    });
  } catch (error) {
    console.error('获取月度收入列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取支付记录列表
router.get('/payout/list', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const userId = req.authorId;
    const { page = 1, pageSize = 20 } = req.query;
    
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSizeNum = Math.max(1, Math.min(100, parseInt(pageSize) || 20));
    const offset = (pageNum - 1) * pageSizeNum;
    
    db = await mysql.createConnection(dbConfig);
    
    // 注意：LIMIT 和 OFFSET 不能使用参数绑定，需要使用字符串拼接（但已确保 pageSizeNum 和 offset 是数字）
    const [payouts] = await db.query(
      `SELECT 
        up.*,
        uim.total_income_usd,
        pgt.provider_tx_id,
        pgt.provider as gateway_provider
       FROM user_payout up
       LEFT JOIN user_income_monthly uim ON up.income_monthly_id = uim.id
       LEFT JOIN payout_gateway_transaction pgt ON up.gateway_tx_id = pgt.id
       WHERE up.user_id = ?
       ORDER BY up.month DESC, up.created_at DESC
       LIMIT ${pageSizeNum} OFFSET ${offset}`,
      [userId]
    );
    
    const [countResult] = await db.execute(
      'SELECT COUNT(*) as total FROM user_payout WHERE user_id = ?',
      [userId]
    );
    const total = countResult[0].total;
    
    res.json({
      success: true,
      data: payouts.map(row => {
        // 解析 account_info JSON
        let accountInfo = null;
        try {
          accountInfo = typeof row.account_info === 'string' 
            ? JSON.parse(row.account_info) 
            : row.account_info;
        } catch (e) {
          accountInfo = null;
        }
        
        // 提取收款账号信息
        let accountLabel = '';
        let accountData = '';
        if (accountInfo) {
          accountLabel = accountInfo.account_label || '';
          if (accountInfo.account_data) {
            const accountDataObj = typeof accountInfo.account_data === 'string'
              ? JSON.parse(accountInfo.account_data)
              : accountInfo.account_data;
            if (accountDataObj.email) {
              accountData = accountDataObj.email;
            } else if (accountDataObj.account) {
              accountData = accountDataObj.account;
            } else if (accountDataObj.login_id) {
              accountData = accountDataObj.login_id;
            }
          }
        }
        
        return {
          id: row.id,
          month: row.month,
          income_monthly_id: row.income_monthly_id,
          total_income_usd: parseFloat(row.total_income_usd || 0), // 当月收入的美金金额
          base_amount_usd: parseFloat(row.base_amount_usd || 0),
          payout_currency: row.payout_currency || 'USD', // 支付币种
          payout_amount: parseFloat(row.payout_amount || 0), // 支付金额
          method: row.method, // 支付方式
          account_label: accountLabel, // 收款账号标签
          account_data: accountData, // 收款账号数据（邮箱/账号）
          provider_tx_id: row.provider_tx_id || null, // 网关交易ID
          gateway_provider: row.gateway_provider || null,
          status: row.status,
          requested_at: row.requested_at,
          paid_at: row.paid_at,
          created_at: row.created_at,
          fx_rate: parseFloat(row.fx_rate || 1.0),
          note: row.note
        };
      }),
      pagination: {
        page: pageNum,
        pageSize: pageSizeNum,
        total: total,
        totalPages: Math.ceil(total / pageSizeNum)
      }
    });
  } catch (error) {
    console.error('获取支付记录列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取支付记录详情
router.get('/payout/detail/:payoutId', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const userId = req.authorId;
    const payoutId = parseInt(req.params.payoutId);
    
    if (isNaN(payoutId)) {
      return res.status(400).json({
        success: false,
        message: '支付单ID无效'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    // 获取支付单基本信息
    const [payouts] = await db.execute(
      'SELECT * FROM user_payout WHERE id = ? AND user_id = ?',
      [payoutId, userId]
    );
    
    if (payouts.length === 0) {
      return res.status(404).json({
        success: false,
        message: '支付单不存在'
      });
    }
    
    const payout = payouts[0];
    
    // 获取网关交易信息
    let gatewayTx = null;
    if (payout.gateway_tx_id) {
      const [gatewayRows] = await db.execute(
        'SELECT * FROM payout_gateway_transaction WHERE id = ?',
        [payout.gateway_tx_id]
      );
      if (gatewayRows.length > 0) {
        gatewayTx = gatewayRows[0];
      }
    }
    
    res.json({
      success: true,
      data: {
        payout: {
          id: payout.id,
          month: payout.month,
          income_monthly_id: payout.income_monthly_id,
          base_amount_usd: parseFloat(payout.base_amount_usd || 0),
          payout_currency: payout.payout_currency || 'USD',
          payout_amount: parseFloat(payout.payout_amount || 0),
          fx_rate: parseFloat(payout.fx_rate || 1.0),
          status: payout.status,
          method: payout.method,
          account_info: payout.account_info ? JSON.parse(payout.account_info) : null,
          requested_at: payout.requested_at,
          paid_at: payout.paid_at,
          note: payout.note
        },
        gateway_transaction: gatewayTx ? {
          provider: gatewayTx.provider,
          provider_tx_id: gatewayTx.provider_tx_id,
          status: gatewayTx.status,
          base_amount_usd: parseFloat(gatewayTx.base_amount_usd || 0),
          payout_currency: gatewayTx.payout_currency || 'USD',
          payout_amount: parseFloat(gatewayTx.payout_amount || 0),
          fx_rate: parseFloat(gatewayTx.fx_rate || 1.0),
          request_payload: gatewayTx.request_payload ? JSON.parse(gatewayTx.request_payload) : null,
          response_payload: gatewayTx.response_payload ? JSON.parse(gatewayTx.response_payload) : null,
          error_code: gatewayTx.error_code,
          error_message: gatewayTx.error_message,
          created_at: gatewayTx.created_at,
          updated_at: gatewayTx.updated_at
        } : null
      }
    });
  } catch (error) {
    console.error('获取支付记录详情错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// ==================== 收款账户相关接口 ====================

// 获取用户收款账户列表
router.get('/payout-account/list', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const userId = req.authorId;
    
    db = await mysql.createConnection(dbConfig);
    
    const [accounts] = await db.execute(
      'SELECT * FROM user_payout_account WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
      [userId]
    );
    
    res.json({
      success: true,
      data: accounts.map(acc => {
        // account_data 在数据库中已经是 JSON 类型，MySQL 会自动解析为对象
        let accountData = acc.account_data;
        if (typeof accountData === 'string') {
          try {
            accountData = JSON.parse(accountData);
          } catch (e) {
            accountData = {};
          }
        }
        return {
          id: acc.id,
          method: acc.method,
          account_label: acc.account_label,
          account_data: accountData || {},
          is_default: acc.is_default === 1,
          created_at: acc.created_at,
          updated_at: acc.updated_at
        };
      })
    });
  } catch (error) {
    console.error('获取收款账户列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 创建或更新收款账户
router.post('/payout-account/save', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const userId = req.authorId;
    const { id, method, account_label, account_data, is_default } = req.body;
    
    if (!method || !account_label || !account_data) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    await db.beginTransaction();
    
    try {
      // 如果设置为默认账户，先取消其他默认账户
      if (is_default) {
        await db.execute(
          'UPDATE user_payout_account SET is_default = 0 WHERE user_id = ?',
          [userId]
        );
      }
      
      if (id) {
        // 更新现有账户
        await db.execute(
          `UPDATE user_payout_account 
           SET method = ?, account_label = ?, account_data = ?, is_default = ?, updated_at = NOW()
           WHERE id = ? AND user_id = ?`,
          [method, account_label, JSON.stringify(account_data), is_default ? 1 : 0, id, userId]
        );
        
        await db.commit();
        
        res.json({
          success: true,
          data: { id },
          message: '收款账户已更新'
        });
      } else {
        // 创建新账户
        const [result] = await db.execute(
          `INSERT INTO user_payout_account (user_id, method, account_label, account_data, is_default, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
          [userId, method, account_label, JSON.stringify(account_data), is_default ? 1 : 0]
        );
        
        await db.commit();
        
        res.json({
          success: true,
          data: { id: result.insertId },
          message: '收款账户已创建'
        });
      }
    } catch (error) {
      await db.rollback();
      throw error;
    }
  } catch (error) {
    console.error('保存收款账户错误:', error);
    res.status(500).json({
      success: false,
      message: '保存失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 删除收款账户
router.delete('/payout-account/:accountId', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const userId = req.authorId;
    const accountId = parseInt(req.params.accountId);
    
    if (isNaN(accountId)) {
      return res.status(400).json({
        success: false,
        message: '账户ID无效'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    // 检查是否是唯一的默认账户
    const [account] = await db.execute(
      'SELECT is_default FROM user_payout_account WHERE id = ? AND user_id = ?',
      [accountId, userId]
    );
    
    if (account.length === 0) {
      return res.status(404).json({
        success: false,
        message: '账户不存在'
      });
    }
    
    if (account[0].is_default === 1) {
      // 检查是否还有其他账户
      const [otherAccounts] = await db.execute(
        'SELECT COUNT(*) as count FROM user_payout_account WHERE user_id = ? AND id != ?',
        [userId, accountId]
      );
      
      if (otherAccounts[0].count === 0) {
        return res.status(400).json({
          success: false,
          message: '不能删除唯一的默认账户，请先添加其他账户'
        });
      }
    }
    
    const [result] = await db.execute(
      'DELETE FROM user_payout_account WHERE id = ? AND user_id = ?',
      [accountId, userId]
    );
    
    res.json({
      success: true,
      message: '收款账户已删除'
    });
  } catch (error) {
    console.error('删除收款账户错误:', error);
    res.status(500).json({
      success: false,
      message: '删除失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 设置默认收款账户
router.post('/payout-account/:accountId/set-default', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const userId = req.authorId;
    const accountId = parseInt(req.params.accountId);
    
    if (isNaN(accountId)) {
      return res.status(400).json({
        success: false,
        message: '账户ID无效'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    await db.beginTransaction();
    
    try {
      // 先取消所有默认账户
      await db.execute(
        'UPDATE user_payout_account SET is_default = 0 WHERE user_id = ?',
        [userId]
      );
      
      // 设置当前账户为默认
      const [result] = await db.execute(
        'UPDATE user_payout_account SET is_default = 1 WHERE id = ? AND user_id = ?',
        [accountId, userId]
      );
      
      if (result.affectedRows === 0) {
        await db.rollback();
        return res.status(404).json({
          success: false,
          message: '账户不存在'
        });
      }
      
      await db.commit();
      
      res.json({
        success: true,
        message: '已设置为默认收款账户'
      });
    } catch (error) {
      await db.rollback();
      throw error;
    }
  } catch (error) {
    console.error('设置默认收款账户错误:', error);
    res.status(500).json({
      success: false,
      message: '设置失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取小说的字数统计（非草稿章节）
router.get('/novel/:novelId/word-count', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const { novelId } = req.params;
    const userId = req.authorId;

    // 验证小说是否属于当前用户
    db = await mysql.createConnection(dbConfig);
    const [novels] = await db.execute(
      'SELECT id, user_id FROM novel WHERE id = ?',
      [novelId]
    );

    if (novels.length === 0) {
      return res.status(404).json({
        success: false,
        message: '小说不存在'
      });
    }

    if (novels[0].user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: '无权访问该小说'
      });
    }

    // 统计非草稿章节的字数
    const [result] = await db.execute(
      `SELECT COALESCE(SUM(word_count), 0) AS total_word_count
       FROM chapter
       WHERE novel_id = ? AND review_status <> 'draft'`,
      [novelId]
    );

    const totalWordCount = parseInt(result[0].total_word_count || 0);
    const canContract = totalWordCount >= 20000;

    res.json({
      success: true,
      data: {
        total_word_count: totalWordCount,
        can_contract: canContract,
        required_word_count: 20000
      }
    });
  } catch (error) {
    console.error('获取字数统计错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取小说的签约状态和可用的分成方案
router.get('/novel/:novelId/contract-status', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const { novelId } = req.params;
    const userId = req.authorId;

    db = await mysql.createConnection(dbConfig);

    // 验证小说是否属于当前用户
    const [novels] = await db.execute(
      'SELECT id, user_id, review_status FROM novel WHERE id = ?',
      [novelId]
    );

    if (novels.length === 0) {
      return res.status(404).json({
        success: false,
        message: '小说不存在'
      });
    }

    if (novels[0].user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: '无权访问该小说'
      });
    }

    // 统计字数
    const [wordCountResult] = await db.execute(
      `SELECT COALESCE(SUM(word_count), 0) AS total_word_count
       FROM chapter
       WHERE novel_id = ? AND review_status <> 'draft'`,
      [novelId]
    );

    const totalWordCount = parseInt(wordCountResult[0].total_word_count || 0);
    const canContract = totalWordCount >= 20000;

    // 查询是否已有签约合同
    const [contracts] = await db.execute(
      `SELECT nrc.*, arp.name as plan_name, arp.royalty_percent
       FROM novel_royalty_contract nrc
       LEFT JOIN author_royalty_plan arp ON nrc.plan_id = arp.id
       WHERE nrc.novel_id = ? AND nrc.effective_to IS NULL
       ORDER BY nrc.effective_from DESC
       LIMIT 1`,
      [novelId]
    );

    const hasContract = contracts.length > 0;
    let availablePlans = [];

    if (canContract && !hasContract) {
      // 查询专属方案
      const [customPlans] = await db.execute(
        `SELECT *
         FROM author_royalty_plan
         WHERE owner_user_id = ?
           AND start_date <= NOW()
           AND (end_date IS NULL OR end_date >= NOW())
         ORDER BY start_date DESC`,
        [userId]
      );

      // 查询默认方案
      const [defaultPlans] = await db.execute(
        `SELECT *
         FROM author_royalty_plan
         WHERE is_default = 1
           AND owner_user_id IS NULL
           AND start_date <= NOW()
           AND (end_date IS NULL OR end_date >= NOW())
         ORDER BY start_date DESC`,
        []
      );

      // 合并方案列表（专属方案在前）
      availablePlans = [
        ...customPlans.map(plan => ({
          ...plan,
          is_custom: true,
          royalty_percent: parseFloat(plan.royalty_percent)
        })),
        ...defaultPlans.map(plan => ({
          ...plan,
          is_custom: false,
          royalty_percent: parseFloat(plan.royalty_percent)
        }))
      ];
    }

    res.json({
      success: true,
      data: {
        total_word_count: totalWordCount,
        can_contract: canContract,
        required_word_count: 20000,
        has_contract: hasContract,
        current_contract: hasContract ? {
          plan_id: contracts[0].plan_id,
          plan_name: contracts[0].plan_name,
          royalty_percent: parseFloat(contracts[0].royalty_percent),
          effective_from: contracts[0].effective_from
        } : null,
        available_plans: availablePlans,
        novel_status: novels[0].review_status
      }
    });
  } catch (error) {
    console.error('获取签约状态错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 提交签约申请
router.post('/novel/:novelId/contract', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const { novelId } = req.params;
    const { plan_id, agree_terms } = req.body;
    const userId = req.authorId;

    if (!plan_id) {
      return res.status(400).json({
        success: false,
        message: '请选择分成方案'
      });
    }

    if (!agree_terms) {
      return res.status(400).json({
        success: false,
        message: '请先阅读并同意《作者签约协议》'
      });
    }

    db = await mysql.createConnection(dbConfig);
    await db.beginTransaction();

    try {
      // 验证小说是否属于当前用户
      const [novels] = await db.execute(
        'SELECT id, user_id FROM novel WHERE id = ?',
        [novelId]
      );

      if (novels.length === 0) {
        await db.rollback();
        return res.status(404).json({
          success: false,
          message: '小说不存在'
        });
      }

      if (novels[0].user_id !== userId) {
        await db.rollback();
        return res.status(403).json({
          success: false,
          message: '无权操作该小说'
        });
      }

      // 验证字数要求
      const [wordCountResult] = await db.execute(
        `SELECT COALESCE(SUM(word_count), 0) AS total_word_count
         FROM chapter
         WHERE novel_id = ? AND review_status <> 'draft'`,
        [novelId]
      );

      const totalWordCount = parseInt(wordCountResult[0].total_word_count || 0);
      if (totalWordCount < 20000) {
        await db.rollback();
        return res.status(400).json({
          success: false,
          message: '作品字数不足，至少需要20,000字才能签约'
        });
      }

      // 验证方案是否存在
      const [plans] = await db.execute(
        `SELECT * FROM author_royalty_plan
         WHERE id = ?
           AND start_date <= NOW()
           AND (end_date IS NULL OR end_date >= NOW())`,
        [plan_id]
      );

      if (plans.length === 0) {
        await db.rollback();
        return res.status(400).json({
          success: false,
          message: '所选分成方案无效或已过期'
        });
      }

      // 检查是否已有生效的合同
      const [existingContracts] = await db.execute(
        'SELECT id FROM novel_royalty_contract WHERE novel_id = ? AND effective_to IS NULL',
        [novelId]
      );

      if (existingContracts.length > 0) {
        await db.rollback();
        return res.status(400).json({
          success: false,
          message: '该作品已完成签约'
        });
      }

      // 插入签约合同
      await db.execute(
        `INSERT INTO novel_royalty_contract
         (novel_id, author_id, plan_id, effective_from, effective_to, created_at)
         VALUES (?, ?, ?, NOW(), NULL, NOW())`,
        [novelId, userId, plan_id]
      );

      // 更新小说状态为 submitted（提交审核）
      await db.execute(
        'UPDATE novel SET review_status = ? WHERE id = ?',
        ['submitted', novelId]
      );

      // 检查并创建unlockprice记录（如果不存在）
      // 使用 INSERT ... ON DUPLICATE KEY UPDATE 确保唯一性，防止重复插入
      // 如果记录已存在，则更新updated_at时间戳
      await db.execute(
        `INSERT INTO unlockprice 
         (user_id, novel_id, karma_per_1000, min_karma, max_karma, default_free_chapters, pricing_style, created_at, updated_at)
         VALUES (?, ?, 6, 5, 30, 50, 'per_word', NOW(), NOW())
         ON DUPLICATE KEY UPDATE updated_at = NOW()`,
        [userId, novelId]
      );

      await db.commit();

      res.json({
        success: true,
        message: '签约申请已提交，等待审核',
        data: {
          novel_id: novelId,
          plan_id: plan_id,
          review_status: 'submitted'
        }
      });
    } catch (error) {
      await db.rollback();
      throw error;
    }
  } catch (error) {
    console.error('提交签约申请错误:', error);
    res.status(500).json({
      success: false,
      message: '提交失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 作品上架
router.post('/novel/:novelId/publish', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const { novelId } = req.params;
    const userId = req.authorId;

    db = await mysql.createConnection(dbConfig);

    // 验证小说是否属于当前用户
    const [novels] = await db.execute(
      'SELECT id, user_id, review_status FROM novel WHERE id = ?',
      [novelId]
    );

    if (novels.length === 0) {
      return res.status(404).json({
        success: false,
        message: '小说不存在'
      });
    }

    if (novels[0].user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: '无权操作该小说'
      });
    }

    // 检查当前状态是否为 approved
    if (novels[0].review_status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: '作品尚未通过审核，无法上架',
        current_status: novels[0].review_status
      });
    }

    // 更新状态为 published
    await db.execute(
      'UPDATE novel SET review_status = ? WHERE id = ?',
      ['published', novelId]
    );

    res.json({
      success: true,
      message: '作品已成功上架',
      data: {
        novel_id: novelId,
        review_status: 'published'
      }
    });
  } catch (error) {
    console.error('作品上架错误:', error);
    res.status(500).json({
      success: false,
      message: '上架失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取作者更新日历统计
router.get('/calendar', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const { year, month, userId, novelId } = req.query;
    const loginUserId = req.authorId;
    const authorId = userId || loginUserId;

    if (!authorId || !year || !month) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required params: year, month, authorId' 
      });
    }

    const yearInt = parseInt(year, 10);
    const monthInt = parseInt(month, 10);

    if (isNaN(yearInt) || isNaN(monthInt) || monthInt < 1 || monthInt > 12) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid year or month' 
      });
    }

    const startDate = `${yearInt}-${String(monthInt).padStart(2, '0')}-01`;
    const endMonth = monthInt === 12 ? 1 : monthInt + 1;
    const endYear = monthInt === 12 ? yearInt + 1 : yearInt;
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

    db = await mysql.createConnection(dbConfig);

    const params = [authorId, startDate, endDate];
    let sql = `
      SELECT date,
             SUM(word_delta) AS word_count,
             COUNT(*) AS change_count
      FROM author_daily_word_count
      WHERE author_id = ?
        AND date >= ?
        AND date < ?
    `;

    if (novelId) {
      sql += ' AND novel_id = ?';
      params.push(parseInt(novelId));
    }

    sql += ' GROUP BY date ORDER BY date ASC';

    const [rows] = await db.execute(sql, params);

    // 调试日志：查看原始数据
    console.log('[Calendar API] Raw rows from DB:', JSON.stringify(rows, null, 2));
    console.log('[Calendar API] First row date type:', typeof rows[0]?.date, 'value:', rows[0]?.date);

    const processedDays = rows.map(r => {
      // 确保日期是字符串格式 YYYY-MM-DD
      let dateStr;
      if (r.date instanceof Date) {
        // 如果是 Date 对象，使用本地时区格式化
        const year = r.date.getFullYear();
        const month = String(r.date.getMonth() + 1).padStart(2, '0');
        const day = String(r.date.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
        console.log('[Calendar API] Date object converted:', r.date, '->', dateStr);
      } else if (typeof r.date === 'string') {
        // 如果已经是字符串，直接使用（可能是 YYYY-MM-DD 或带时间的格式）
        dateStr = r.date.split(' ')[0]; // 提取日期部分
        console.log('[Calendar API] String date processed:', r.date, '->', dateStr);
      } else {
        // 其他情况，尝试转换
        const dateObj = new Date(r.date);
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
        console.log('[Calendar API] Other type converted:', r.date, '->', dateStr);
      }
      
      return {
        date: dateStr,                         // YYYY-MM-DD
        word_count: Number(r.word_count) || 0, // 当天总增量
        change_count: Number(r.change_count) || 0, // 当天发布/修改次数
      };
    });

    console.log('[Calendar API] Processed days:', JSON.stringify(processedDays, null, 2));

    res.json({
      success: true,
      year: yearInt,
      month: monthInt,
      days: processedDays,
    });
  } catch (err) {
    console.error('Error in /api/writer/calendar', err);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: err.message 
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取作者统计数据（入驻天数、累计收入、累计字数）
router.get('/stats', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const userId = req.userId;
    
    db = await mysql.createConnection(dbConfig);
    
    // 1. 获取用户创建时间，计算入驻天数
    const [userRows] = await db.execute(
      'SELECT created_at FROM user WHERE id = ?',
      [userId]
    );
    
    let daysJoined = 0;
    if (userRows.length > 0 && userRows[0].created_at) {
      const createdDate = new Date(userRows[0].created_at);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - createdDate.getTime());
      daysJoined = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }
    
    // 2. 获取累计收入：user_income_monthly 表中该用户的 total_income_usd 总和
    const [incomeRows] = await db.execute(
      'SELECT COALESCE(SUM(total_income_usd), 0) as total_income FROM user_income_monthly WHERE user_id = ?',
      [userId]
    );
    const cumulativeIncome = parseFloat(incomeRows[0]?.total_income || 0);
    
    // 3. 获取累计字数：该用户所有小说的章节字数总和
    const [wordCountRows] = await db.execute(
      `SELECT COALESCE(SUM(c.word_count), 0) as total_word_count
       FROM chapter c
       INNER JOIN novel n ON c.novel_id = n.id
       WHERE n.user_id = ?`,
      [userId]
    );
    const cumulativeWordCount = parseInt(wordCountRows[0]?.total_word_count || 0);
    
    // 4. 获取作品数量
    const [worksRows] = await db.execute(
      'SELECT COUNT(*) as count FROM novel WHERE user_id = ?',
      [userId]
    );
    const worksCount = parseInt(worksRows[0]?.count || 0);
    
    res.json({
      success: true,
      data: {
        worksCount,
        daysJoined,
        cumulativeIncome,
        cumulativeWordCount
      }
    });
  } catch (error) {
    console.error('获取作者统计数据失败:', error);
    res.status(500).json({
      success: false,
      message: '获取统计数据失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

module.exports = router;

