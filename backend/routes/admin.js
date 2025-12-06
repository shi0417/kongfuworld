const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Decimal = require('decimal.js');
const PayPalService = require('../services/paypalService');
const AlipayService = require('../services/alipayService');
const ChapterReviewController = require('../controllers/chapterReviewController');
const EditorIncomeService = require('../services/editorIncomeService');
const AdminUserController = require('../controllers/adminUserController');
const EditorContractService = require('../services/editorContractService');
const EditorApplicationService = require('../services/editorApplicationService');
const NovelContractApprovalService = require('../services/novelContractApprovalService');
const AdminMenuPermissionService = require('../services/adminMenuPermissionService');
// 导入权限中间件：小说审批权限基于 novel_editor_contract，有效合同才能审核，与章节审批保持一致
const { getNovelPermissionFilter, checkNovelPermission, computeChapterCanReview } = require('../middleware/permissionMiddleware');
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

// 初始化章节审核控制器
const chapterReviewController = new ChapterReviewController(dbConfig);

// 初始化编辑收入服务
const editorIncomeService = new EditorIncomeService(dbConfig);

// 初始化管理员用户控制器
const adminUserController = new AdminUserController(dbConfig);

// 初始化编辑合同服务
const editorContractService = new EditorContractService(dbConfig);
const editorApplicationService = new EditorApplicationService(dbConfig);
const novelContractApprovalService = new NovelContractApprovalService(dbConfig);

// JWT验证中间件（管理员）
const authenticateAdmin = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ success: false, message: '请先登录' });
  }

  try {
    const decoded = jwt.verify(token, 'admin-secret-key');
    
    // 从数据库获取最新的admin信息（包括role、status）
    const db = await mysql.createConnection(dbConfig);
    const [admins] = await db.execute(
      'SELECT id, name, level, role, status FROM admin WHERE id = ?',
      [decoded.adminId]
    );
    await db.end();
    
    if (admins.length === 0) {
      return res.status(403).json({ success: false, message: '管理员不存在' });
    }
    
    const admin = admins[0];
    
    // 检查账号状态
    if (admin.status === 0) {
      return res.status(403).json({ success: false, message: '账号已被禁用' });
    }
    
    req.admin = {
      ...decoded,
      role: admin.role || 'editor',
      status: admin.status
    };
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Token无效或已过期' });
  }
};

// 基于角色的权限控制中间件
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ success: false, message: '请先登录' });
    }
    
    // super_admin拥有所有权限
    if (req.admin.role === 'super_admin') {
      return next();
    }
    
    // 检查是否有权限
    if (!allowedRoles.includes(req.admin.role)) {
      return res.status(403).json({ 
        success: false, 
        message: '权限不足，无法访问此功能' 
      });
    }
    
    next();
  };
};

// 注意：权限过滤函数已移至 permissionMiddleware.js，统一基于 novel_editor_contract 表进行权限控制
// 小说审批权限基于 novel_editor_contract，有效合同才能审核，与章节审批保持一致

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
      `SELECT * FROM admin WHERE name = ?`,
      [name]
    );

    if (admins.length === 0) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    const admin = admins[0];
    
    // 检查账号状态
    if (admin.status === 0) {
      return res.status(403).json({
        success: false,
        message: '账号已被禁用'
      });
    }
    
    // 验证密码（支持bcrypt哈希和明文兼容）
    let passwordMatch = false;
    
    // 检查密码是否是bcrypt哈希格式（长度60，以$2开头）
    const isHashed = admin.password && admin.password.length === 60 && admin.password.startsWith('$2');
    
    if (isHashed) {
      // 使用bcrypt比较
      passwordMatch = await bcrypt.compare(password, admin.password);
    } else {
      // 兼容旧明文密码（迁移期间）
      passwordMatch = admin.password === password;
      
      // 如果是明文且匹配，自动升级为哈希
      if (passwordMatch) {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.execute('UPDATE admin SET password = ? WHERE id = ?', [hashedPassword, admin.id]);
        console.log(`管理员 ${admin.name} 密码已自动升级为哈希`);
      }
    }
    
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    // 生成JWT token（包含role信息）
    const token = jwt.sign(
      { 
        adminId: admin.id, 
        name: admin.name, 
        level: admin.level,
        role: admin.role || 'editor'
      },
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
        role: admin.role || 'editor',
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
    
    // 应用权限过滤
    const permissionFilter = await getNovelPermissionFilter(
      db, 
      req.admin.adminId, 
      req.admin.role
    );
    
    // 查询待审批的小说（created, submitted, reviewing状态），包含标签和主角信息
    const [novels] = await db.execute(
      `SELECT 
        n.*, 
        MAX(u.username) as author_name, 
        MAX(u.pen_name) as pen_name,
        GROUP_CONCAT(DISTINCT g.chinese_name ORDER BY g.id SEPARATOR ',') as genre_names,
        GROUP_CONCAT(DISTINCT p.name ORDER BY p.created_at SEPARATOR ',') as protagonist_names
       FROM novel n
       LEFT JOIN user u ON (n.author = u.pen_name OR n.author = u.username)
       LEFT JOIN novel_genre_relation ngr ON n.id = ngr.novel_id
       LEFT JOIN genre g ON (ngr.genre_id_1 = g.id OR ngr.genre_id_2 = g.id)
       LEFT JOIN protagonist p ON n.id = p.novel_id
       WHERE n.review_status IN ('created', 'submitted', 'reviewing') ${permissionFilter.where}
       GROUP BY n.id
       ORDER BY n.id DESC`,
      permissionFilter.params
    );

    // 处理标签和主角数据
    const processedNovels = novels.map(novel => {
      const genres = novel.genre_names ? novel.genre_names.split(',').filter(g => g && g !== 'null') : [];
      const protagonists = novel.protagonist_names ? novel.protagonist_names.split(',').filter(p => p) : [];
      
      return {
        ...novel,
        genres: genres,
        protagonists: protagonists
      };
    });

    // 计算 can_review 字段：小说审批权限基于 novel_editor_contract，有效合同才能审核
    const { adminId, role } = req.admin;
    let novelIds = processedNovels.map(n => n.id);
    let contractMap = {};

    // super_admin 需要查询是否有合同
    if (role === 'super_admin' && novelIds.length > 0) {
      const placeholders = novelIds.map(() => '?').join(',');
      const [contracts] = await db.execute(
        `SELECT novel_id 
         FROM novel_editor_contract 
         WHERE editor_admin_id = ? 
           AND status = 'active' 
           AND start_date <= NOW()
           AND (end_date IS NULL OR end_date >= NOW())
           AND novel_id IN (${placeholders})`,
        [adminId, ...novelIds]
      );
      contractMap = Object.fromEntries(contracts.map(c => [c.novel_id, true]));
    }

    // 为每本小说添加 can_review 字段
    const result = processedNovels.map(novel => {
      let can_review = false;
      if (role === 'editor' || role === 'chief_editor') {
        // 能看到就说明有合同（已通过 getNovelPermissionFilter 过滤）
        can_review = true;
      } else if (role === 'super_admin') {
        can_review = !!contractMap[novel.id];
      }
      return {
        ...novel,
        can_review
      };
    });

    res.json({
      success: true,
      data: result
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
    const { adminId, role } = req.admin;
    
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

    // 角色基础校验：只有编辑、主编或超级管理员可以审核小说
    if (!['editor', 'chief_editor', 'super_admin'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: '只有编辑、主编或超级管理员可以审核小说'
      });
    }

    db = await mysql.createConnection(dbConfig);
    
    // 检查小说是否存在
    const [rows] = await db.execute(
      'SELECT id FROM novel WHERE id = ?',
      [novelId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '小说不存在'
      });
    }

    // 权限检查：小说审批权限基于 novel_editor_contract，有效合同才能审核，与章节审批保持一致
    const hasPermission = await checkNovelPermission(db, adminId, role, novelId);
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: '无权限审核此小说（需要与该小说有有效合同）'
      });
    }
    
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

// 更新小说状态（用于下架、归档、锁定等操作）
router.put('/novel/:id/status', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { id } = req.params;
    const { review_status, reason } = req.body;
    
    if (!review_status) {
      return res.status(400).json({
        success: false,
        message: '状态参数不能为空'
      });
    }

    // 验证状态值是否有效
    const validStatuses = ['created', 'submitted', 'reviewing', 'approved', 'published', 'unlisted', 'archived', 'locked'];
    if (!validStatuses.includes(review_status)) {
      return res.status(400).json({
        success: false,
        message: '无效的状态值'
      });
    }

    db = await mysql.createConnection(dbConfig);
    
    // 检查小说是否存在
    const [novels] = await db.execute('SELECT id FROM novel WHERE id = ?', [id]);
    if (novels.length === 0) {
      return res.status(404).json({
        success: false,
        message: '小说不存在'
      });
    }
    
    // 更新小说状态
    await db.execute(
      'UPDATE novel SET review_status = ? WHERE id = ?',
      [review_status, id]
    );

    res.json({
      success: true,
      message: '状态更新成功',
      data: {
        novelId: parseInt(id),
        review_status
      }
    });

  } catch (error) {
    console.error('更新小说状态错误:', error);
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
    
    // 应用权限过滤
    const permissionFilter = await getNovelPermissionFilter(
      db, 
      req.admin.adminId, 
      req.admin.role
    );
    
    // 确保参数类型正确
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offsetNum = (pageNum - 1) * limitNum;
    
    let query = `SELECT 
                   n.*, 
                   MAX(u.username) as author_name, 
                   MAX(u.pen_name) as pen_name,
                   GROUP_CONCAT(DISTINCT g.chinese_name ORDER BY g.id SEPARATOR ',') as genre_names,
                   GROUP_CONCAT(DISTINCT p.name ORDER BY p.created_at SEPARATOR ',') as protagonist_names
                 FROM novel n
                 LEFT JOIN user u ON (n.author = u.pen_name OR n.author = u.username)
                 LEFT JOIN novel_genre_relation ngr ON n.id = ngr.novel_id
                 LEFT JOIN genre g ON (ngr.genre_id_1 = g.id OR ngr.genre_id_2 = g.id)
                 LEFT JOIN protagonist p ON n.id = p.novel_id`;
    const params = [];
    
    if (status) {
      query += ' WHERE n.review_status = ?';
      params.push(status);
    } else {
      query += ' WHERE 1=1';
    }
    
    // 添加权限过滤条件
    query += ` ${permissionFilter.where}`;
    params.push(...permissionFilter.params);
    
    // LIMIT 和 OFFSET 需要直接插入数值，不能使用占位符
    query += ` GROUP BY n.id ORDER BY n.id DESC LIMIT ${limitNum} OFFSET ${offsetNum}`;
    
    const [novels] = await db.execute(query, params);
    
    // 处理标签和主角数据
    const processedNovels = novels.map(novel => {
      const genres = novel.genre_names ? novel.genre_names.split(',').filter(g => g && g !== 'null') : [];
      const protagonists = novel.protagonist_names ? novel.protagonist_names.split(',').filter(p => p) : [];
      
      return {
        ...novel,
        genres: genres,
        protagonists: protagonists
      };
    });
    
    // 获取总数（需要应用相同的权限过滤）
    let countQuery = 'SELECT COUNT(*) as total FROM novel n';
    const countParams = [];
    if (status) {
      countQuery += ' WHERE n.review_status = ?';
      countParams.push(status);
    } else {
      countQuery += ' WHERE 1=1';
    }
    countQuery += ` ${permissionFilter.where}`;
    countParams.push(...permissionFilter.params);
    const [countResult] = await db.execute(countQuery, countParams);
    const total = countResult[0].total;

    // 计算 can_review 字段：小说审批权限基于 novel_editor_contract，有效合同才能审核
    const { adminId, role } = req.admin;
    let novelIds = processedNovels.map(n => n.id);
    let contractMap = {};

    // super_admin 需要查询是否有合同
    if (role === 'super_admin' && novelIds.length > 0) {
      const placeholders = novelIds.map(() => '?').join(',');
      const [contracts] = await db.execute(
        `SELECT novel_id 
         FROM novel_editor_contract 
         WHERE editor_admin_id = ? 
           AND status = 'active' 
           AND start_date <= NOW()
           AND (end_date IS NULL OR end_date >= NOW())
           AND novel_id IN (${placeholders})`,
        [adminId, ...novelIds]
      );
      contractMap = Object.fromEntries(contracts.map(c => [c.novel_id, true]));
    }

    // 为每本小说添加 can_review 字段
    const result = processedNovels.map(novel => {
      let can_review = false;
      if (role === 'editor' || role === 'chief_editor') {
        // 能看到就说明有合同（已通过 getNovelPermissionFilter 过滤）
        can_review = true;
      } else if (role === 'super_admin') {
        can_review = !!contractMap[novel.id];
      }
      return {
        ...novel,
        can_review
      };
    });

    res.json({
      success: true,
      data: result,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        totalPages: Math.ceil(total / limitNum)
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
    
    // 应用权限过滤
    const permissionFilter = await getNovelPermissionFilter(
      db, 
      req.admin.adminId, 
      req.admin.role
    );
    
    // 获取小说基本信息，包含标签、主角和编辑信息
    const queryParams = [id, ...permissionFilter.params];
    const [novels] = await db.execute(
      `SELECT 
        n.*, 
        MAX(u.username) as author_name, 
        MAX(u.pen_name) as pen_name, 
        MAX(u.email) as author_email,
        MAX(a.id) as editor_admin_id,
        MAX(a.name) as editor_name,
        GROUP_CONCAT(DISTINCT g.id ORDER BY g.id) as genre_ids,
        GROUP_CONCAT(DISTINCT g.name ORDER BY g.id SEPARATOR ',') as genre_names,
        GROUP_CONCAT(DISTINCT g.chinese_name ORDER BY g.id SEPARATOR ',') as genre_chinese_names,
        GROUP_CONCAT(DISTINCT p.name ORDER BY p.created_at SEPARATOR ',') as protagonist_names
       FROM novel n
       LEFT JOIN user u ON (n.author = u.pen_name OR n.author = u.username)
       LEFT JOIN admin a ON n.current_editor_admin_id = a.id
       LEFT JOIN novel_genre_relation ngr ON n.id = ngr.novel_id
       LEFT JOIN genre g ON (ngr.genre_id_1 = g.id OR ngr.genre_id_2 = g.id)
       LEFT JOIN protagonist p ON n.id = p.novel_id
       WHERE n.id = ? ${permissionFilter.where}
       GROUP BY n.id`,
      queryParams
    );

    if (novels.length === 0) {
      return res.status(404).json({
        success: false,
        message: '小说不存在或无权限访问'
      });
    }

    const novel = novels[0];
    
    // 处理标签数据
    const genres = [];
    if (novel.genre_ids && novel.genre_chinese_names) {
      const genreIds = novel.genre_ids.split(',').filter(id => id && id !== 'null');
      const genreNames = novel.genre_names ? novel.genre_names.split(',').filter(name => name) : [];
      const genreChineseNames = novel.genre_chinese_names.split(',').filter(name => name);
      
      genreIds.forEach((genreId, index) => {
        if (genreId && genreChineseNames[index]) {
          genres.push({
            id: parseInt(genreId),
            name: genreNames[index] || '',
            chinese_name: genreChineseNames[index]
          });
        }
      });
    }
    
    // 处理主角数据
    const protagonists = novel.protagonist_names ? novel.protagonist_names.split(',').filter(p => p) : [];

    res.json({
      success: true,
      data: {
        ...novel,
        genres: genres,
        protagonists: protagonists,
        current_editor_admin_id: novel.current_editor_admin_id || null,
        editor_name: novel.editor_name || null
      }
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
          subscription_duration_days: item.subscription_duration_days,
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
// 
// 【历史问题修复说明】
// 2025-01-XX: 修复了 Champion 订阅拆分金额不匹配的问题
// 
// 问题原因：
// 1. 时区处理不一致：月份边界使用本地时间字符串解析，导致 UTC 时间计算错误（GMT+8 时区会提前8小时）
//    例如：本地时间 "2025-11-01 00:00:00" 转换为 UTC 后变成 "2025-10-31T16:00:00.000Z"
//    正确应该是 UTC "2025-11-01T00:00:00.000Z"
// 2. 服务总天数计算：之前使用 subscription_duration_days（整数30），但实际日期差可能是30.5天
//    导致比例计算错误
// 
// 修复方案：
// 1. 使用 UTC 时间创建月份边界：new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0, 0))
// 2. 始终使用实际日期差（毫秒精度）计算总天数，subscription_duration_days 只作为验证参考
// 3. 使用毫秒精度拆分金额：ratio = overlapMs / totalMs，避免浮点数精度损失
// 
// 工具函数：将日期时间归一化到 UTC 00:00:00（只按日期算，忽略时间部分）
function normalizeToUTCDate(dateTimeStr) {
  const d = new Date(dateTimeStr);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

// 工具函数：计算两个日期之间的自然日数差（整数）
// 使用半开区间 [startDate, endDate)，即 endDate 当天不算在服务期内
// 例如：[2025-11-01, 2025-11-02) = 1 天（只有 11月1日）
function diffDays(startDate, endDate) {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY);
}

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
    // ⚠️ 修复：使用 UTC 时间创建月份边界，避免时区问题
    // 问题：之前使用本地时间字符串解析，导致月份边界计算错误（GMT+8 时区会提前8小时）
    const [year, monthNum] = month.split('-').map(Number);
    const monthStartDate = new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0, 0)); // UTC 时间
    const nextMonthDate = new Date(Date.UTC(year, monthNum, 1, 0, 0, 0, 0)); // UTC 时间（下个月1日）
    const monthStart = monthStartDate.toISOString().slice(0, 19).replace('T', ' ');
    const monthEnd = nextMonthDate.toISOString().slice(0, 19).replace('T', ' ');
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
         (user_id, novel_id, karma_amount, amount_usd, source_type, source_id, spend_time, settlement_month, days)
         VALUES (?, ?, ?, ?, 'chapter_unlock', ?, ?, ?, 0)`,
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
    // reader_spending 的 Champion 部分是按服务期拆分到自然月
    // 按服务期筛选记录：只选和当前结算月份有交集的订阅服务期
    const [subscriptions] = await db.execute(
      `SELECT
         id,
         user_id,
         novel_id,
         payment_amount,
         start_date,
         end_date,
         subscription_duration_days,
         created_at
       FROM user_champion_subscription_record
       WHERE payment_status = 'completed'
         AND payment_amount > 0
         AND end_date > ?
         AND start_date < ?
       ORDER BY start_date`,
      [monthStart, monthEnd]
    );
    
    // 计算月份的开始和结束时间（Date 对象，UTC 时间）
    // 月份区间使用半开区间：[monthStartDate, nextMonthDate)
    // 注意：monthStartDate 和 nextMonthDate 已经在上面声明了，直接使用即可
    
    // 调试：需要详细分析的订阅记录ID
    const debugRecordIds = [21, 22, 23, 27];
    const debugLogs = [];
    
    // 用于记录每个订阅的拆分汇总（用于最后一个月兜底和校验）
    const subscriptionSplits = new Map(); // key: subscription_id, value: { totalDays, allocatedDays, allocatedAmount, months }
    
    for (const row of subscriptions) {
      // 【日期归一化：去掉时间部分，只按日期算】
      // 订阅服务期使用半开区间：[serviceStart, serviceEnd)
      // start_date 当天算在服务期内，end_date 当天不算在服务期内
      const serviceStart = normalizeToUTCDate(row.start_date);
      const serviceEnd = normalizeToUTCDate(row.end_date);
      
      // 【服务总天数 totalDays 的算法】
      // 使用半开区间 [serviceStart, serviceEnd)，计算自然日数（整数）
      // 例如：[2025-11-01, 2025-12-01) = 30 天（11月1日~11月30日）
      const totalDays = diffDays(serviceStart, serviceEnd);
      
      // 可选：如果 subscription_duration_days 与实际日期差差异很大，记录警告
      if (row.subscription_duration_days && Math.abs(row.subscription_duration_days - totalDays) > 0.5) {
        console.warn(`[generate-reader-spending] 订阅记录 ${row.id} 的 subscription_duration_days (${row.subscription_duration_days}) 与实际日期差 (${totalDays}) 差异较大`);
      }
      
      // 安全兜底：如果某条记录 totalDays 特别大（比如 > 40），可以在日志里 console.warn 一下
      if (totalDays > 40) {
        console.warn(`[generate-reader-spending] 订阅记录 ${row.id} 的服务期异常：${totalDays} 天，start_date: ${row.start_date}, end_date: ${row.end_date}`);
      }
      
      // 【每个月 overlapDays 的算法 - 按自然日计算】
      // 月份区间也是半开区间：[monthStartDate, nextMonthDate)
      // 计算重叠区间：[overlapStart, overlapEnd)
      const overlapStart = serviceStart > monthStartDate ? serviceStart : monthStartDate;
      const overlapEnd = serviceEnd < nextMonthDate ? serviceEnd : nextMonthDate;
      
      // 计算重叠天数（整数，自然日）
      let overlapDays = 0;
      if (overlapEnd > overlapStart) {
        overlapDays = diffDays(overlapStart, overlapEnd);
      }
      
      // 跳过没有重叠或总天数为0的记录
      if (overlapDays <= 0 || totalDays <= 0) continue;
      
      // 【金额拆分比例：使用整数天数做比例】
      // 先查询该订阅已经拆分到哪些月份（用于判断是否是最后一个月份和计算已分配金额）
      const [existingSplits] = await db.execute(
        `SELECT settlement_month, days, amount_usd
         FROM reader_spending
         WHERE source_type = 'subscription' AND source_id = ?
         ORDER BY settlement_month`,
        [row.id]
      );
      
      // 计算已分配的天数和金额
      let totalAllocatedDays = 0;
      let totalAllocatedAmount = new Decimal(0);
      const allocatedMonths = new Set();
      
      for (const split of existingSplits) {
        totalAllocatedDays += split.days || 0;
        totalAllocatedAmount = totalAllocatedAmount.plus(split.amount_usd || 0);
        allocatedMonths.add(split.settlement_month);
      }
      
      // 如果当前月份已经处理过，跳过
      if (allocatedMonths.has(settlementMonth)) {
        continue;
      }
      
      // 计算该订阅会拆分到哪些月份（用于判断是否是最后一个月份）
      const serviceStartYear = serviceStart.getUTCFullYear();
      const serviceStartMonth = serviceStart.getUTCMonth();
      const serviceEndYear = serviceEnd.getUTCFullYear();
      const serviceEndMonth = serviceEnd.getUTCMonth();
      
      // 生成所有相关月份
      const allMonths = [];
      let currentYear = serviceStartYear;
      let currentMonth = serviceStartMonth;
      
      while (currentYear < serviceEndYear || (currentYear === serviceEndYear && currentMonth < serviceEndMonth)) {
        const monthStartUTC = new Date(Date.UTC(currentYear, currentMonth, 1, 0, 0, 0, 0));
        const nextMonthUTC = new Date(Date.UTC(currentYear, currentMonth + 1, 1, 0, 0, 0, 0));
        
        // 计算该月份的重叠天数
        const monthOverlapStart = serviceStart > monthStartUTC ? serviceStart : monthStartUTC;
        const monthOverlapEnd = serviceEnd < nextMonthUTC ? serviceEnd : nextMonthUTC;
        const monthOverlapDays = monthOverlapEnd > monthOverlapStart ? diffDays(monthOverlapStart, monthOverlapEnd) : 0;
        
        if (monthOverlapDays > 0) {
          const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
          allMonths.push({
            month: monthStr,
            overlapDays: monthOverlapDays,
            monthStartUTC,
            nextMonthUTC
          });
        }
        
        currentMonth++;
        if (currentMonth > 11) {
          currentMonth = 0;
          currentYear++;
        }
      }
      
      // 判断当前月份是否是最后一个月份
      const isLastMonth = allMonths.length > 0 && 
                          allMonths[allMonths.length - 1].month === settlementMonth;
      
      // 计算当前月份的天数和金额
      let finalDays = overlapDays;
      let finalAmount;
      
      if (isLastMonth && allMonths.length > 1) {
        // 最后一个月份：使用兜底逻辑，确保总天数和总金额严格匹配
        // 计算已分配的天数（不包括当前月份）
        let allocatedDaysBeforeCurrent = 0;
        for (const split of existingSplits) {
          allocatedDaysBeforeCurrent += split.days || 0;
        }
        
        finalDays = totalDays - allocatedDaysBeforeCurrent;
        const remainingAmount = new Decimal(row.payment_amount).minus(totalAllocatedAmount);
        finalAmount = remainingAmount;
        
        // 验证：如果计算出的天数与重叠天数差异很大，记录警告
        if (Math.abs(finalDays - overlapDays) > 1) {
          console.warn(`[generate-reader-spending] 订阅记录 ${row.id} 最后一个月天数差异较大：计算=${finalDays}, 重叠=${overlapDays}, totalDays=${totalDays}, allocatedDaysBeforeCurrent=${allocatedDaysBeforeCurrent}`);
        }
      } else {
        // 非最后一个月：按比例计算
        const ratio = new Decimal(overlapDays).div(totalDays);
        finalAmount = new Decimal(row.payment_amount).mul(ratio);
      }
      
      // 调试日志：针对特定记录打印详细拆分过程
      if (debugRecordIds.includes(row.id)) {
        const debugInfo = {
          recordId: row.id,
          userId: row.user_id,
          novelId: row.novel_id,
          paymentAmount: parseFloat(row.payment_amount),
          startDate: row.start_date,
          endDate: row.end_date,
          subscriptionDurationDays: row.subscription_duration_days,
          totalDays: totalDays,
          settlementMonth: settlementMonth,
          monthStartUTC: monthStartDate.toISOString(),
          nextMonthUTC: nextMonthDate.toISOString(),
          serviceStart: serviceStart.toISOString(),
          serviceEnd: serviceEnd.toISOString(),
          overlapStart: overlapStart.toISOString(),
          overlapEnd: overlapEnd.toISOString(),
          overlapDays: overlapDays,
          finalDays: finalDays,
          isLastMonth: isLastMonth,
          totalAllocatedDays: totalAllocatedDays,
          totalAllocatedAmount: totalAllocatedAmount.toNumber(),
          finalAmount: finalAmount.toNumber(),
          finalAmountPrecise: finalAmount.toString()
        };
        debugLogs.push(debugInfo);
        console.log(`\n[调试] 订阅记录 ${row.id} 拆分详情:`, JSON.stringify(debugInfo, null, 2));
      }
      
      // 插入 reader_spending
      // spend_time 使用 overlapStart（重叠开始时间）
      await db.execute(
        `INSERT INTO reader_spending 
         (user_id, novel_id, karma_amount, amount_usd, source_type, source_id, spend_time, settlement_month, days)
         VALUES (?, ?, 0, ?, 'subscription', ?, ?, ?, ?)`,
        [
          row.user_id,
          row.novel_id,
          finalAmount.toNumber(), // 转换为数字，保留完整精度
          row.id,
          overlapStart, // 使用重叠开始时间
          settlementMonth,
          finalDays // 保存自然日数
        ]
      );
      generatedCount++;
      
      // 记录拆分汇总（用于后续校验）
      if (!subscriptionSplits.has(row.id)) {
        subscriptionSplits.set(row.id, {
          totalDays,
          allocatedDays: 0,
          allocatedAmount: new Decimal(0),
          months: []
        });
      }
      const splitInfo = subscriptionSplits.get(row.id);
      splitInfo.allocatedDays += finalDays;
      splitInfo.allocatedAmount = splitInfo.allocatedAmount.plus(finalAmount);
      splitInfo.months.push(settlementMonth);
    }
    
    // 输出校验日志：检查每个订阅的拆分是否正确
    // 注意：由于是按月份循环处理，这里只能校验当前月份处理后的部分结果
    // 完整的校验需要在所有月份处理完成后进行
    for (const [subscriptionId, splitInfo] of subscriptionSplits.entries()) {
      const daysDiff = splitInfo.totalDays - splitInfo.allocatedDays;
      
      // 查询原始 payment_amount
      const [subRow] = subscriptions.filter(s => s.id === subscriptionId);
      if (subRow) {
        const paymentAmount = new Decimal(subRow.payment_amount);
        const amountDiff = paymentAmount.minus(splitInfo.allocatedAmount);
        
        // 注意：由于是按月份循环，这里只能校验当前月份处理后的部分结果
        // 如果当前月份不是最后一个月份，daysDiff 和 amountDiff 可能不为0是正常的
        if (debugRecordIds.includes(subscriptionId)) {
          console.log(`[generate-reader-spending] 订阅记录 ${subscriptionId} 当前月份拆分: totalDays=${splitInfo.totalDays}, allocatedDays=${splitInfo.allocatedDays}, daysDiff=${daysDiff}, payment_amount=${paymentAmount.toString()}, allocatedAmount=${splitInfo.allocatedAmount.toString()}, amountDiff=${amountDiff.toString()}, months=${splitInfo.months.join(',')}`);
        }
      }
    }
    
    // 输出调试汇总
    if (debugLogs.length > 0) {
      console.log('\n[调试汇总] 本次生成的订阅拆分记录:');
      debugLogs.forEach(log => {
        console.log(`  记录 ${log.recordId}: payment_amount=${log.paymentAmount}, 本月拆分=${log.amountForMonth}, overlapDays=${log.overlapDays}, totalDays=${log.totalDays}`);
      });
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
    console.log('\n========== [author-royalty/generate] 开始生成作者基础收入数据 ==========');
    
    // ========== 节点1: 接收参数 ==========
    const { month } = req.body; // month格式：2025-11
    console.log('[节点1-接收参数] req.body:', JSON.stringify(req.body));
    console.log('[节点1-接收参数] month:', month);
    
    if (!month) {
      console.log('[节点1-接收参数] ❌ month 参数缺失');
      return res.status(400).json({
        success: false,
        message: '请指定月份'
      });
    }
    console.log('[节点1-接收参数] ✅ month 参数有效');
    
    // ========== 节点2: 连接数据库 ==========
    console.log('[节点2-连接数据库] 正在连接数据库...');
    db = await mysql.createConnection(dbConfig);
    console.log('[节点2-连接数据库] ✅ 数据库连接成功');
    
    // ========== 节点3: 格式转换 ==========
    // 月份转换：前端传 2025-11，后端转成 2025-11-01（与 generate-reader-spending 保持一致）
    const settlementMonth = `${month}-01`;
    console.log('[节点3-格式转换] 前端传入 month:', month);
    console.log('[节点3-格式转换] 转换后 settlementMonth:', settlementMonth);
    console.log('[节点3-格式转换] ✅ 格式转换完成');
    
    // ========== 节点4: 检查是否已生成过 ==========
    console.log('[节点4-检查已存在] 查询 author_royalty 表...');
    const [existing] = await db.execute(
      'SELECT COUNT(*) as count FROM author_royalty WHERE settlement_month = ?',
      [settlementMonth]
    );
    const existingCount = existing[0].count;
    console.log('[节点4-检查已存在] 已存在的记录数:', existingCount);
    
    if (existingCount > 0) {
      console.log('[节点4-检查已存在] ❌ 该月份数据已存在，终止生成');
      return res.status(400).json({
        success: false,
        message: '该月份数据已存在，请先删除后再生成'
      });
    }
    console.log('[节点4-检查已存在] ✅ 该月份数据不存在，可以继续生成');
    
    // ========== 节点5: 查询 reader_spending 数据 ==========
    console.log('[节点5-查询reader_spending] 执行SQL查询...');
    console.log('[节点5-查询reader_spending] SQL: SELECT ... FROM reader_spending WHERE settlement_month = ?');
    console.log('[节点5-查询reader_spending] 参数:', settlementMonth);
    
    // 获取该月份的所有 reader_spending 记录
    // 查询条件：只按 settlement_month 过滤，不区分 source_type（章节解锁/订阅）和 settled 状态
    // 业务规则：当月所有 reader_spending 都应该参与作者分成
    const [spendings] = await db.execute(
      `SELECT 
        rs.id,
        rs.user_id,
        rs.novel_id,
        rs.amount_usd,
        rs.spend_time,
        rs.source_type
      FROM reader_spending rs
      WHERE rs.settlement_month = ?
      ORDER BY rs.spend_time`,
      [settlementMonth]  // 参数：settlementMonth = '2025-11-01'
    );
    
    console.log('[节点5-查询reader_spending] ✅ 查询完成');
    console.log('[节点5-查询reader_spending] 查询到的记录数:', spendings.length);
    
    if (spendings.length > 0) {
      console.log('[节点5-查询reader_spending] 前3条记录详情:');
      spendings.slice(0, 3).forEach((rs, idx) => {
        console.log(`  [${idx + 1}] id=${rs.id}, novel_id=${rs.novel_id}, amount_usd=${rs.amount_usd}, source_type=${rs.source_type}, spend_time=${rs.spend_time}`);
      });
    }
    
    if (spendings.length === 0) {
      console.log('[节点5-查询reader_spending] ❌ 没有 reader_spending 数据，终止生成');
      return res.status(400).json({
        success: false,
        message: '该月份没有读者消费数据，请先生成基础收入数据'
      });
    }
    console.log('[节点5-查询reader_spending] ✅ 找到 reader_spending 数据，继续处理');
    
    // ========== 节点6: 循环处理每条记录 ==========
    console.log('[节点6-循环处理] 开始循环处理', spendings.length, '条记录...');
    let generatedCount = 0;
    let skippedCount = 0;
    const skippedReasons = [];
    
    for (let i = 0; i < spendings.length; i++) {
      const spending = spendings[i];
      console.log(`\n[节点6-循环处理] ========== 处理第 ${i + 1}/${spendings.length} 条记录 ==========`);
      console.log(`[节点6-循环处理] reader_spending.id: ${spending.id}`);
      console.log(`[节点6-循环处理] reader_spending.novel_id: ${spending.novel_id}`);
      console.log(`[节点6-循环处理] reader_spending.amount_usd: ${spending.amount_usd}`);
      
      try {
        // ========== 节点6.1: 查询 novel 表获取作者ID ==========
        console.log(`[节点6.1-查询novel] 查询 novel 表，novel_id=${spending.novel_id}...`);
        const [novels] = await db.execute(
          'SELECT user_id FROM novel WHERE id = ?',
          [spending.novel_id]
        );
        console.log(`[节点6.1-查询novel] 查询结果数量: ${novels.length}`);
        
        if (novels.length === 0) {
          skippedCount++;
          const reason = `小说 ${spending.novel_id} 不存在`;
          skippedReasons.push(reason);
          console.warn(`[节点6.1-查询novel] ❌ ${reason}，跳过 reader_spending.id=${spending.id}`);
          continue;
        }
        
        const novel = novels[0];
        console.log(`[节点6.1-查询novel] novel.user_id: ${novel.user_id}`);
        
        if (!novel.user_id) {
          skippedCount++;
          const reason = `小说 ${spending.novel_id} 没有作者（user_id 为 NULL）`;
          skippedReasons.push(reason);
          console.warn(`[节点6.1-查询novel] ❌ ${reason}，跳过 reader_spending.id=${spending.id}`);
          continue;
        }
        
        const authorId = novel.user_id;
        console.log(`[节点6.1-查询novel] ✅ 找到作者ID: ${authorId}`);
        
        // ========== 节点6.2: 查找分成合同 ==========
        console.log(`[节点6.2-查找合同] 查询 novel_royalty_contract 表...`);
        console.log(`[节点6.2-查找合同] novel_id=${spending.novel_id}, author_id=${authorId}, spend_time=${spending.spend_time}`);
        
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
        
        console.log(`[节点6.2-查找合同] 查询结果数量: ${contracts.length}`);
        if (contracts.length > 0) {
          console.log(`[节点6.2-查找合同] 找到合同，plan_id=${contracts[0].plan_id}`);
        } else {
          console.log(`[节点6.2-查找合同] 未找到合同，将使用默认方案`);
        }
        
        // ========== 节点6.3: 确定分成比例 ==========
        console.log(`[节点6.3-确定分成比例] 开始确定分成比例...`);
        let royaltyPercent = new Decimal(0.5); // 默认50%
        
        if (contracts.length > 0) {
          console.log(`[节点6.3-确定分成比例] 查找合同对应的分成方案，plan_id=${contracts[0].plan_id}...`);
          // 查找对应的分成方案
          const [plans] = await db.execute(
            'SELECT royalty_percent FROM author_royalty_plan WHERE id = ?',
            [contracts[0].plan_id]
          );
          
          console.log(`[节点6.3-确定分成比例] 分成方案查询结果数量: ${plans.length}`);
          if (plans.length > 0) {
            royaltyPercent = new Decimal(plans[0].royalty_percent);
            console.log(`[节点6.3-确定分成比例] ✅ 使用合同方案，royalty_percent=${royaltyPercent.toString()}`);
          } else {
            console.log(`[节点6.3-确定分成比例] ⚠️ 合同方案不存在，使用默认值`);
          }
        } else {
          console.log(`[节点6.3-确定分成比例] 查找默认方案（is_default=1）...`);
          // 如果没有合同，使用默认方案
          const [defaultPlans] = await db.execute(
            'SELECT royalty_percent FROM author_royalty_plan WHERE is_default = 1 ORDER BY start_date DESC LIMIT 1'
          );
          
          console.log(`[节点6.3-确定分成比例] 默认方案查询结果数量: ${defaultPlans.length}`);
          if (defaultPlans.length > 0) {
            royaltyPercent = new Decimal(defaultPlans[0].royalty_percent);
            console.log(`[节点6.3-确定分成比例] ✅ 使用默认方案，royalty_percent=${royaltyPercent.toString()}`);
          } else {
            console.log(`[节点6.3-确定分成比例] ⚠️ 未找到默认方案，使用硬编码默认值 0.5`);
          }
        }
        
        // ========== 节点6.4: 计算金额 ==========
        console.log(`[节点6.4-计算金额] 开始计算金额...`);
        console.log(`[节点6.4-计算金额] spending.amount_usd: ${spending.amount_usd}`);
        console.log(`[节点6.4-计算金额] royalty_percent: ${royaltyPercent.toString()}`);
        
        // 使用高精度计算，不四舍五入
        const grossAmountUsd = new Decimal(spending.amount_usd);
        const authorAmountUsd = grossAmountUsd.mul(royaltyPercent); // 高精度乘法，不四舍五入
        
        console.log(`[节点6.4-计算金额] grossAmountUsd: ${grossAmountUsd.toString()}`);
        console.log(`[节点6.4-计算金额] authorAmountUsd: ${authorAmountUsd.toString()}`);
        console.log(`[节点6.4-计算金额] grossAmountUsd.toNumber(): ${grossAmountUsd.toNumber()}`);
        console.log(`[节点6.4-计算金额] authorAmountUsd.toNumber(): ${authorAmountUsd.toNumber()}`);
        console.log(`[节点6.4-计算金额] ✅ 金额计算完成`);
        
        // ========== 节点6.5: 插入 author_royalty ==========
        console.log(`[节点6.5-插入数据] 准备插入 author_royalty 表...`);
        console.log(`[节点6.5-插入数据] INSERT INTO author_royalty (author_id, novel_id, source_spend_id, gross_amount_usd, author_amount_usd, settlement_month)`);
        console.log(`[节点6.5-插入数据] VALUES (${authorId}, ${spending.novel_id}, ${spending.id}, ${grossAmountUsd.toNumber()}, ${authorAmountUsd.toNumber()}, '${settlementMonth}')`);
        
        // 插入 author_royalty
        // 列名列表：author_id, novel_id, source_spend_id, gross_amount_usd, author_amount_usd, settlement_month
        // 表结构：id(自增), author_id, novel_id, source_spend_id, gross_amount_usd, author_amount_usd, settlement_month, created_at(默认值)
        const insertResult = await db.execute(
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
        
        console.log(`[节点6.5-插入数据] ✅ 插入成功`);
        console.log(`[节点6.5-插入数据] insertResult.affectedRows: ${insertResult[0].affectedRows}`);
        console.log(`[节点6.5-插入数据] insertResult.insertId: ${insertResult[0].insertId}`);
        
        generatedCount++;
        console.log(`[节点6-循环处理] ✅ 第 ${i + 1} 条记录处理完成，当前已生成: ${generatedCount} 条`);
        
      } catch (insertError) {
        // 如果单条记录插入失败，记录错误但继续处理下一条
        skippedCount++;
        const reason = `插入失败: ${insertError.message}`;
        skippedReasons.push(`reader_spending.id=${spending.id}: ${reason}`);
        console.error(`[节点6-循环处理] ❌ 第 ${i + 1} 条记录处理失败`);
        console.error(`[节点6-循环处理] reader_spending.id=${spending.id} 插入失败:`);
        console.error(`[节点6-循环处理] 错误信息: ${insertError.message}`);
        console.error(`[节点6-循环处理] 错误堆栈:`, insertError.stack);
        // 继续处理下一条记录，不中断整个流程
      }
    }
    
    console.log(`\n[节点6-循环处理] ✅ 循环处理完成`);
    console.log(`[节点6-循环处理] 总记录数: ${spendings.length}`);
    console.log(`[节点6-循环处理] 成功生成: ${generatedCount} 条`);
    console.log(`[节点6-循环处理] 跳过: ${skippedCount} 条`);
    
    // ========== 节点7: 返回结果 ==========
    console.log('\n[节点7-返回结果] 准备返回结果...');
    console.log('[节点7-返回结果] generatedCount:', generatedCount);
    console.log('[节点7-返回结果] skippedCount:', skippedCount);
    if (skippedReasons.length > 0) {
      console.log('[节点7-返回结果] skippedReasons:', skippedReasons);
    }
    
    const responseData = {
      success: true,
      message: `成功生成 ${generatedCount} 条作者基础收入数据${skippedCount > 0 ? `，跳过 ${skippedCount} 条` : ''}`,
      data: {
        month: settlementMonth,
        count: generatedCount,
        skipped: skippedCount,
        skippedReasons: skippedReasons.length > 0 ? skippedReasons : undefined
      }
    };
    
    console.log('[节点7-返回结果] 响应数据:', JSON.stringify(responseData, null, 2));
    console.log('========== [author-royalty/generate] 生成完成 ==========\n');
    
    res.json(responseData);

  } catch (error) {
    console.error('\n========== [author-royalty/generate] 发生错误 ==========');
    console.error('[错误] 错误信息:', error.message);
    console.error('[错误] 错误堆栈:', error.stack);
    console.error('========== [author-royalty/generate] 错误结束 ==========\n');
    
    res.status(500).json({
      success: false,
      message: '生成失败',
      error: error.message
    });
  } finally {
    if (db) {
      console.log('[清理] 关闭数据库连接...');
      await db.end();
      console.log('[清理] ✅ 数据库连接已关闭');
    }
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
        let planId = referrals[0].promoter_plan_id;
        
        if (planId) {
          // 获取方案信息，并检查生效时间（使用消费时间判断方案是否生效）
          let [plans] = await db.execute(
            `SELECT max_level FROM commission_plan 
             WHERE id = ? 
               AND start_date <= ? 
               AND (end_date IS NULL OR end_date > ?)`,
            [planId, spending.spend_time, spending.spend_time]
          );
          
          // 如果方案过期，回退到默认方案
          if (plans.length === 0) {
            console.warn(`方案ID ${planId} 在消费时间 ${spending.spend_time} 时已过期或未生效，尝试使用默认读者推广方案`);
            const [defaultPlans] = await db.execute(
              `SELECT id, max_level FROM commission_plan 
               WHERE plan_type = 'reader_promoter'
                 AND is_custom = 0 
                 AND owner_user_id IS NULL
                 AND start_date <= ? 
                 AND (end_date IS NULL OR end_date > ?)
               ORDER BY start_date DESC 
               LIMIT 1`,
              [spending.spend_time, spending.spend_time]
            );
            
            if (defaultPlans.length > 0) {
              planId = defaultPlans[0].id;
              plans = [{ max_level: defaultPlans[0].max_level }];
              console.log(`使用默认读者推广方案 ID ${planId}`);
            } else {
              console.warn(`未找到有效的默认读者推广方案，跳过该层级佣金计算`);
            }
          }
          
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
        ar.author_amount_usd,
        ar.source_spend_id
      FROM author_royalty ar
      WHERE ar.settlement_month = ?
      ORDER BY ar.created_at`,
      [settlementMonth]
    );
    
    for (const ar of authorRoyalties) {
      const author = ar.author_id;
      // 使用高精度，不四舍五入
      const baseAmountUsd = new Decimal(ar.author_amount_usd);
      
      // 获取对应的reader_spending的消费时间，用于判断方案是否生效
      const [spendings] = await db.execute(
        'SELECT spend_time FROM reader_spending WHERE id = ?',
        [ar.source_spend_id]
      );
      
      if (spendings.length === 0) {
        console.warn(`找不到对应的reader_spending记录，source_spend_id=${ar.source_spend_id}，跳过`);
        continue;
      }
      
      const spendTime = spendings[0].spend_time;
      
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
        let planId = referrals[0].author_plan_id;
        
        if (planId) {
          // 获取方案信息，并检查生效时间（使用消费时间判断方案是否生效）
          let [plans] = await db.execute(
            `SELECT max_level FROM commission_plan 
             WHERE id = ? 
               AND start_date <= ? 
               AND (end_date IS NULL OR end_date > ?)`,
            [planId, spendTime, spendTime]
          );
          
          // 如果方案过期，回退到默认方案
          if (plans.length === 0) {
            console.warn(`方案ID ${planId} 在消费时间 ${spendTime} 时已过期或未生效，尝试使用默认作者推广方案`);
            const [defaultPlans] = await db.execute(
              `SELECT id, max_level FROM commission_plan 
               WHERE plan_type = 'author_promoter'
                 AND is_custom = 0 
                 AND owner_user_id IS NULL
                 AND start_date <= ? 
                 AND (end_date IS NULL OR end_date > ?)
               ORDER BY start_date DESC 
               LIMIT 1`,
              [spendTime, spendTime]
            );
            
            if (defaultPlans.length > 0) {
              planId = defaultPlans[0].id;
              plans = [{ max_level: defaultPlans[0].max_level }];
              console.log(`使用默认作者推广方案 ID ${planId}`);
            } else {
              console.warn(`未找到有效的默认作者推广方案，跳过该层级佣金计算`);
            }
          }
          
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

// 更新Karma汇率
router.put('/karma-rates/:id', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { id } = req.params;
    const { usd_per_karma, effective_from, effective_to } = req.body;
    
    db = await mysql.createConnection(dbConfig);
    
    // 检查汇率是否存在
    const [rates] = await db.execute(
      'SELECT * FROM karma_dollars WHERE id = ?',
      [id]
    );
    
    if (rates.length === 0) {
      return res.status(404).json({
        success: false,
        message: '汇率不存在'
      });
    }
    
    // 构建更新字段
    const updateFields = [];
    const updateValues = [];
    
    if (usd_per_karma !== undefined) {
      updateFields.push('usd_per_karma = ?');
      updateValues.push(usd_per_karma);
    }
    
    if (effective_from !== undefined) {
      updateFields.push('effective_from = ?');
      updateValues.push(formatDateForMySQL(effective_from));
    }
    
    if (effective_to !== undefined) {
      updateFields.push('effective_to = ?');
      updateValues.push(effective_to ? formatDateForMySQL(effective_to) : null);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有要更新的字段'
      });
    }
    
    updateValues.push(id);
    
    // 更新汇率
    await db.execute(
      `UPDATE karma_dollars SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );
    
    res.json({
      success: true,
      message: '更新成功'
    });
  } catch (error) {
    console.error('更新Karma汇率错误:', error);
    res.status(500).json({
      success: false,
      message: '更新失败',
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
    
    // 将数据库错误转换为友好的中英文提示
    let friendlyMessage = {
      zh: '保存失败',
      en: 'Save failed'
    };
    
    // 处理常见的数据库错误
    if (error.code === 'ER_BAD_NULL_ERROR') {
      // 提取字段名
      const fieldMatch = error.sqlMessage && error.sqlMessage.match(/Column '(\w+)' cannot be null/i);
      if (fieldMatch) {
        const fieldName = fieldMatch[1];
        const fieldMap = {
          'start_date': { zh: '生效时间', en: 'Effective Date' },
          'end_date': { zh: '结束时间', en: 'End Date' },
          'name': { zh: '方案名称', en: 'Plan Name' },
          'royalty_percent': { zh: '分成比例', en: 'Royalty Ratio' }
        };
        
        const fieldLabel = fieldMap[fieldName] || { zh: fieldName, en: fieldName };
        friendlyMessage = {
          zh: `请填写必填字段：${fieldLabel.zh}`,
          en: `Please fill in the required field: ${fieldLabel.en}`
        };
      } else {
        friendlyMessage = {
          zh: '请填写所有必填字段',
          en: 'Please fill in all required fields'
        };
      }
    } else if (error.code === 'ER_DUP_ENTRY') {
      friendlyMessage = {
        zh: '该方案名称已存在，请使用其他名称',
        en: 'This plan name already exists, please use another name'
      };
    } else if (error.code === 'ER_DATA_TOO_LONG') {
      friendlyMessage = {
        zh: '输入的数据过长，请缩短后重试',
        en: 'Input data is too long, please shorten and try again'
      };
    } else if (error.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD') {
      friendlyMessage = {
        zh: '输入的数据格式不正确，请检查后重试',
        en: 'Invalid data format, please check and try again'
      };
    } else if (error.message) {
      // 如果错误消息包含中文，直接使用
      if (/[\u4e00-\u9fa5]/.test(error.message)) {
        friendlyMessage = {
          zh: error.message,
          en: error.message
        };
      }
    }
    
    res.status(500).json({
      success: false,
      message: friendlyMessage.zh,
      messageEn: friendlyMessage.en,
      error: error.message,
      errorCode: error.code
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

// 获取所有小说分成合同列表（分页）
router.get('/novel-royalty-contracts', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { page = 1, page_size = 20, novel_id, author_id, plan_id } = req.query;
    db = await mysql.createConnection(dbConfig);
    
    const pageInt = parseInt(page);
    const pageSizeInt = parseInt(page_size);
    const offset = (pageInt - 1) * pageSizeInt;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (novel_id) {
      whereClause += ' AND nrc.novel_id = ?';
      params.push(novel_id);
    }
    
    if (author_id) {
      whereClause += ' AND nrc.author_id = ?';
      params.push(author_id);
    }
    
    if (plan_id) {
      whereClause += ' AND nrc.plan_id = ?';
      params.push(plan_id);
    }
    
    // 获取总数
    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM novel_royalty_contract nrc ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    
    // 获取列表数据
    // 注意：LIMIT 和 OFFSET 不能使用参数占位符，需要直接插入数值
    const [contracts] = await db.execute(
      `SELECT 
        nrc.*,
        n.title as novel_title,
        u.username as author_username,
        u.pen_name as author_pen_name,
        arp.name as plan_name,
        arp.royalty_percent
      FROM novel_royalty_contract nrc
      LEFT JOIN novel n ON nrc.novel_id = n.id
      LEFT JOIN user u ON nrc.author_id = u.id
      LEFT JOIN author_royalty_plan arp ON nrc.plan_id = arp.id
      ${whereClause}
      ORDER BY nrc.effective_from DESC, nrc.id DESC
      LIMIT ${pageSizeInt} OFFSET ${offset}`,
      params
    );
    
    res.json({
      success: true,
      data: {
        list: contracts.map(contract => ({
          ...contract,
          royalty_percent: parseFloat(contract.royalty_percent || 0)
        })),
        total: total,
        page: pageInt,
        page_size: pageSizeInt,
        total_pages: Math.ceil(total / pageSizeInt)
      }
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

// 更新小说分成合同（可更新plan_id、effective_from、effective_to）
router.put('/novel-royalty-contracts/:id', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { id } = req.params;
    const { plan_id, effective_from, effective_to } = req.body;
    
    db = await mysql.createConnection(dbConfig);
    
    // 检查合同是否存在
    const [contracts] = await db.execute(
      'SELECT * FROM novel_royalty_contract WHERE id = ?',
      [id]
    );
    
    if (contracts.length === 0) {
      return res.status(404).json({
        success: false,
        message: '合同不存在'
      });
    }
    
    // 检查方案是否存在（如果提供了plan_id）
    if (plan_id !== undefined && plan_id !== null) {
      const [plans] = await db.execute(
        'SELECT id FROM author_royalty_plan WHERE id = ?',
        [plan_id]
      );
      
      if (plans.length === 0) {
        return res.status(404).json({
          success: false,
          message: '分成方案不存在'
        });
      }
    }
    
    // 构建更新字段
    const updateFields = [];
    const updateValues = [];
    
    if (plan_id !== undefined) {
      updateFields.push('plan_id = ?');
      updateValues.push(plan_id);
    }
    
    if (effective_from !== undefined) {
      updateFields.push('effective_from = ?');
      updateValues.push(effective_from);
    }
    
    if (effective_to !== undefined) {
      updateFields.push('effective_to = ?');
      updateValues.push(effective_to || null);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有要更新的字段'
      });
    }
    
    updateValues.push(id);
    
    // 更新合同
    await db.execute(
      `UPDATE novel_royalty_contract SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );
    
    res.json({
      success: true,
      message: '更新成功'
    });
  } catch (error) {
    console.error('更新小说分成合同错误:', error);
    res.status(500).json({
      success: false,
      message: '更新失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 更新作者分成方案
router.put('/author-royalty-plans/:id', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { id } = req.params;
    const { name, royalty_percent, is_default, owner_user_id, start_date, end_date, remark } = req.body;
    
    db = await mysql.createConnection(dbConfig);
    
    // 检查方案是否存在
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
    
    // 构建更新字段
    const updateFields = [];
    const updateParams = [];
    
    if (name !== undefined) {
      updateFields.push('name = ?');
      updateParams.push(name);
    }
    
    if (royalty_percent !== undefined) {
      updateFields.push('royalty_percent = ?');
      updateParams.push(royalty_percent);
    }
    
    if (is_default !== undefined) {
      updateFields.push('is_default = ?');
      updateParams.push(is_default ? 1 : 0);
      
      // 如果设置为默认，需要将其他方案取消默认
      if (is_default) {
        await db.execute(
          'UPDATE author_royalty_plan SET is_default = 0 WHERE id != ?',
          [id]
        );
      }
    }
    
    if (owner_user_id !== undefined) {
      updateFields.push('owner_user_id = ?');
      updateParams.push(owner_user_id || null);
    }
    
    if (start_date !== undefined) {
      updateFields.push('start_date = ?');
      updateParams.push(start_date);
    }
    
    if (end_date !== undefined) {
      updateFields.push('end_date = ?');
      updateParams.push(end_date || null);
    }
    
    if (remark !== undefined) {
      updateFields.push('remark = ?');
      updateParams.push(remark || null);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有要更新的字段'
      });
    }
    
    updateParams.push(id);
    
    await db.execute(
      `UPDATE author_royalty_plan SET ${updateFields.join(', ')} WHERE id = ?`,
      updateParams
    );
    
    res.json({
      success: true,
      message: '更新成功'
    });
  } catch (error) {
    console.error('更新作者分成方案错误:', error);
    res.status(500).json({
      success: false,
      message: '更新失败',
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

// ========== 编辑结算相关接口 ==========

// 生成编辑结算汇总
router.post('/editor-settlement/generate-monthly', authenticateAdmin, async (req, res) => {
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
    
    console.log(`[editor-settlement] 开始生成 ${monthStart} 的编辑结算汇总`);
    
    db = await mysql.createConnection(dbConfig);
    
    // 从 editor_income_monthly 表聚合数据
    const [aggregatedResults] = await db.execute(
      `SELECT 
        editor_admin_id,
        role,
        month,
        SUM(editor_income_usd) AS total_income_usd,
        COUNT(DISTINCT novel_id) AS novel_count,
        COUNT(*) AS record_count
       FROM editor_income_monthly
       WHERE month = ?
       GROUP BY editor_admin_id, role, month`,
      [monthStart]
    );
    
    console.log(`[editor-settlement] 查询到 ${aggregatedResults.length} 条聚合记录`);
    
    let processed = 0;
    let errors = [];
    
    for (const row of aggregatedResults) {
      try {
        const editorAdminId = row.editor_admin_id;
        const role = row.role;
        const totalIncomeUsd = parseFloat(row.total_income_usd || 0);
        const novelCount = parseInt(row.novel_count || 0);
        const recordCount = parseInt(row.record_count || 0);
        
        // 检查是否已有记录且已支付
        const [existingRows] = await db.execute(
          `SELECT id, payout_status, payout_id 
           FROM editor_settlement_monthly 
           WHERE editor_admin_id = ? AND role = ? AND month = ?`,
          [editorAdminId, role, monthStart]
        );
        
        let payoutStatus = 'unpaid';
        let payoutId = null;
        
        if (existingRows.length > 0) {
          const existing = existingRows[0];
          // 如果已支付，保留原有状态和 payout_id
          if (existing.payout_status === 'paid') {
            payoutStatus = 'paid';
            payoutId = existing.payout_id;
            // 只更新金额字段，不覆盖支付状态
            await db.execute(
              `UPDATE editor_settlement_monthly 
               SET total_income_usd = ?,
                   novel_count = ?,
                   record_count = ?,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = ?`,
              [totalIncomeUsd, novelCount, recordCount, existing.id]
            );
            processed++;
            continue;
          }
        }
        
        // 检查是否有已支付的支付单
        if (totalIncomeUsd > 0) {
          const [payoutResult] = await db.execute(
            `SELECT id, status FROM editor_payout
             WHERE editor_admin_id = ? AND role = ? AND month = ? AND status = 'paid'
             LIMIT 1`,
            [editorAdminId, role, monthStart]
          );
          
          if (payoutResult.length > 0) {
            payoutStatus = 'paid';
            payoutId = payoutResult[0].id;
          }
        }
        
        // 插入或更新 editor_settlement_monthly
        await db.execute(
          `INSERT INTO editor_settlement_monthly 
           (editor_admin_id, role, month, total_income_usd, novel_count, record_count, payout_status, payout_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
           total_income_usd = VALUES(total_income_usd),
           novel_count = VALUES(novel_count),
           record_count = VALUES(record_count),
           payout_status = VALUES(payout_status),
           payout_id = VALUES(payout_id),
           updated_at = CURRENT_TIMESTAMP`,
          [editorAdminId, role, monthStart, totalIncomeUsd, novelCount, recordCount, payoutStatus, payoutId]
        );
        
        processed++;
      } catch (error) {
        console.error(`[editor-settlement] 处理编辑 ${row.editor_admin_id} (${row.role}) 失败:`, error);
        errors.push({ editor_admin_id: row.editor_admin_id, role: row.role, error: error.message });
      }
    }
    
    console.log(`[editor-settlement] 生成完成: 处理 ${processed} 条记录，${errors.length} 个错误`);
    
    res.json({
      success: true,
      message: `编辑月度结算生成完成: ${processed} 条记录`,
      data: {
        processed,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    console.error('[editor-settlement] 生成月度结算汇总错误:', error);
    res.status(500).json({
      success: false,
      message: '生成失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取编辑结算总览列表
router.get('/editor-settlement/overview', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { month, status, role, editorId } = req.query;
    
    db = await mysql.createConnection(dbConfig);
    
    // 解析月份
    const monthStart = month ? parseMonth(month) : null;
    const monthParam = monthStart || new Date().toISOString().substring(0, 7) + '-01';
    
    let query = `
      SELECT 
        esm.id AS settlement_id,
        esm.editor_admin_id,
        esm.role,
        esm.month,
        esm.total_income_usd,
        esm.novel_count,
        esm.record_count,
        esm.payout_status,
        esm.payout_id,
        COALESCE(a.real_name, a.name) AS editor_name,
        ep.method AS payout_method,
        ep.payout_currency,
        ep.payout_amount
      FROM editor_settlement_monthly esm
      LEFT JOIN admin a ON esm.editor_admin_id = a.id
      LEFT JOIN editor_payout ep ON esm.payout_id = ep.id
      WHERE esm.month = ?
    `;
    
    const params = [monthParam];
    
    // 角色筛选
    if (role && role !== 'all') {
      if (role === 'editor') {
        query += ' AND esm.role = ?';
        params.push('editor');
      } else if (role === 'chief_editor') {
        query += ' AND esm.role = ?';
        params.push('chief_editor');
      }
    }
    
    // 编辑ID筛选
    if (editorId) {
      query += ' AND esm.editor_admin_id = ?';
      params.push(parseInt(editorId));
    }
    
    // 状态筛选
    if (status && status !== 'all') {
      if (status === 'unpaid') {
        query += ' AND (esm.payout_status IS NULL OR esm.payout_status = \'unpaid\')';
      } else {
        query += ' AND esm.payout_status = ?';
        params.push(status);
      }
    }
    
    // 只显示有收入的记录
    query += ' AND esm.total_income_usd > 0';
    
    // 排序
    query += ' ORDER BY esm.total_income_usd DESC, esm.editor_admin_id ASC';
    
    const [results] = await db.execute(query, params);
    
    res.json({
      success: true,
      data: results.map(row => ({
        settlement_id: row.settlement_id,
        editor_admin_id: row.editor_admin_id,
        editor_name: row.editor_name || `编辑${row.editor_admin_id}`,
        role: row.role,
        month: row.month ? row.month.toString().substring(0, 10) : null,
        total_income_usd: parseFloat(row.total_income_usd || 0),
        novel_count: parseInt(row.novel_count || 0),
        record_count: parseInt(row.record_count || 0),
        payout_status: row.payout_status || 'unpaid',
        payout_id: row.payout_id || null,
        payout_method: row.payout_method || null,
        payout_currency: row.payout_currency || null,
        payout_amount: row.payout_amount ? parseFloat(row.payout_amount) : null
      }))
    });
  } catch (error) {
    console.error('[editor-settlement] 获取编辑结算总览错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

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
        up.payout_currency,
        up.payout_amount,
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
        payout_method: row.payout_method || null, // 支付方式
        payout_currency: row.payout_currency || null, // 支付币种
        payout_amount: row.payout_amount ? parseFloat(row.payout_amount) : null // 支付金额
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

// 发起编辑支付
router.post('/editor-settlements/:settlementMonthlyId/pay', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const settlementMonthlyId = parseInt(req.params.settlementMonthlyId);
    const adminId = req.admin?.id || null;
    
    if (isNaN(settlementMonthlyId)) {
      return res.status(400).json({
        success: false,
        message: '无效的结算记录ID'
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
      // 1. 锁住并获取月度结算记录
      const [settlementRows] = await db.execute(
        'SELECT * FROM editor_settlement_monthly WHERE id = ? FOR UPDATE',
        [settlementMonthlyId]
      );
      
      if (settlementRows.length === 0) {
        await db.rollback();
        return res.status(404).json({
          success: false,
          message: '结算记录不存在'
        });
      }
      
      const settlementMonthly = settlementRows[0];
      
      // 2. 检查 payout_status，防止重复支付
      if (settlementMonthly.payout_status === 'paid') {
        await db.rollback();
        return res.status(400).json({
          success: false,
          message: '该结算已经支付完成，请勿重复发起。可使用【同步 PayPal 状态】刷新结果。'
        });
      }
      
      // 检查是否已有正在处理的支付单
      if (settlementMonthly.payout_id) {
        const [existingPayoutRows] = await db.execute(
          'SELECT status FROM editor_payout WHERE id = ?',
          [settlementMonthly.payout_id]
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
      
      // 3. 获取收款账户信息（从 admin_payout_account）
      const [accounts] = await db.execute(
        'SELECT * FROM admin_payout_account WHERE id = ? AND admin_id = ? AND status = "active"',
        [accountIdNum, settlementMonthly.editor_admin_id]
      );
      
      if (accounts.length === 0) {
        await db.rollback();
        return res.status(404).json({
          success: false,
          message: '收款账户不存在或已禁用'
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
      const baseAmountUsd = parseFloat(settlementMonthly.total_income_usd || 0);
      const payoutAmount = Math.round(baseAmountUsd * fxRate * 100) / 100;
      
      // 5. 查找或创建 editor_payout
      let payout = null;
      let payoutId;
      
      if (settlementMonthly.payout_id) {
        // 已有 payout_id，检查并更新
        const [payoutRows] = await db.execute(
          'SELECT * FROM editor_payout WHERE id = ? FOR UPDATE',
          [settlementMonthly.payout_id]
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
        
        payoutId = payout.id;
        const finalAdminId = adminId || null;
        
        // 更新支付单状态为 processing
        await db.execute(
          `UPDATE editor_payout
           SET status = 'processing',
               requested_at = NOW(),
               updated_at = NOW(),
               admin_id = ?
           WHERE id = ?`,
          [finalAdminId, payoutId]
        );
        
        // 更新 editor_settlement_monthly 的 payout_id（不更新 payout_status，保持 'unpaid'，直到支付完成）
        await db.execute(
          `UPDATE editor_settlement_monthly
           SET payout_id = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [payoutId, settlementMonthlyId]
        );
      } else {
        // 创建新的支付单
        const editorAdminId = settlementMonthly.editor_admin_id || null;
        const role = settlementMonthly.role || null;
        const month = settlementMonthly.month || null;
        const finalAdminId = adminId || null;
        const finalNote = note || null;
        
        const [result] = await db.execute(
          `INSERT INTO editor_payout (
            editor_admin_id, role, month, settlement_monthly_id,
            base_amount_usd, payout_currency, payout_amount, fx_rate,
            status, method, account_info, requested_at, admin_id, note
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'processing', ?, ?, NOW(), ?, ?)`,
          [
            editorAdminId,
            role,
            month,
            settlementMonthlyId,
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
        
        // 更新 editor_settlement_monthly 的 payout_id（不更新 payout_status，保持 'unpaid'，直到支付完成）
        await db.execute(
          `UPDATE editor_settlement_monthly
           SET payout_id = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [payoutId, settlementMonthlyId]
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
      
      // 7. 更新 editor_payout 的 gateway_tx_id
      await db.execute(
        `UPDATE editor_payout
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
          
          // 使用幂等的 sender_batch_id
          const monthStr = settlementMonthly.month ? new Date(settlementMonthly.month).toISOString().substring(0, 7).replace('-', '') : '';
          const senderBatchId = `PAYOUT_EDITOR_${settlementMonthly.editor_admin_id}_${settlementMonthly.role}_${monthStr}`;
          
          const payoutNote = `Payout for ${settlementMonthly.month} - Editor ID: ${settlementMonthly.editor_admin_id} (${settlementMonthly.role})`;
          paymentResult = await paypalService.createPayout(
            email,
            payoutAmount,
            payoutCurrency,
            payoutNote,
            senderBatchId
          );
          
          console.log('[editor-settlement] PayPal API返回结果:', JSON.stringify(paymentResult, null, 2));
        } catch (paypalError) {
          console.error('[editor-settlement] PayPal调用错误:', paypalError);
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
          const payeeAccount = accountData.account || accountData.login_id;
          const payeeRealName = accountData.name || accountData.real_name || '';
          
          if (!payeeAccount) {
            throw new Error('支付宝账户信息中缺少account或login_id字段');
          }
          
          const monthStr = settlementMonthly.month ? new Date(settlementMonthly.month).toISOString().substring(0, 7).replace('-', '') : '';
          let outBizNo = `ALIPAY_EDITOR_${settlementMonthly.editor_admin_id}_${settlementMonthly.role}_${monthStr}`;
          
          const transferAmount = payoutCurrency === 'CNY' ? payoutAmount : payoutAmount * fxRate;
          const transferRemark = `转账 - ${settlementMonthly.month} - 编辑ID: ${settlementMonthly.editor_admin_id} (${settlementMonthly.role})`;
          
          // 检查是否已存在成功的支付记录
          if (payoutId && payout && payout.gateway_tx_id) {
            const [existingTx] = await db.execute(
              `SELECT provider_tx_id, status, response_payload, request_payload
               FROM payout_gateway_transaction 
               WHERE id = ? AND provider = 'alipay'`,
              [payout.gateway_tx_id]
            );
            
            if (existingTx.length > 0 && existingTx[0].status === 'succeeded') {
              try {
                const responsePayload = typeof existingTx[0].response_payload === 'string' 
                  ? JSON.parse(existingTx[0].response_payload) 
                  : existingTx[0].response_payload;
                const requestPayload = typeof existingTx[0].request_payload === 'string'
                  ? JSON.parse(existingTx[0].request_payload)
                  : existingTx[0].request_payload;
                
                const existingAmount = parseFloat(responsePayload.trans_amount || responsePayload.amount || requestPayload?.amount || 0);
                const existingAccount = responsePayload.payee_info?.identity || requestPayload?.account_info?.account_data?.account || requestPayload?.account_info?.account_data?.login_id;
                const currentAccount = payeeAccount;
                
                if (Math.abs(existingAmount - transferAmount) < 0.01 && existingAccount === currentAccount) {
                  console.log('[editor-settlement] 已存在成功的支付记录且参数一致，直接返回成功');
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
                } else {
                  outBizNo = `ALIPAY_EDITOR_${settlementMonthly.editor_admin_id}_${settlementMonthly.role}_${monthStr}_${Date.now()}`;
                }
              } catch (e) {
                outBizNo = `ALIPAY_EDITOR_${settlementMonthly.editor_admin_id}_${settlementMonthly.role}_${monthStr}_${Date.now()}`;
              }
            } else if (payout && (payout.status === 'failed' || payout.status === 'cancelled')) {
              outBizNo = `ALIPAY_EDITOR_${settlementMonthly.editor_admin_id}_${settlementMonthly.role}_${monthStr}_${Date.now()}`;
            }
          }
          
          if (!paymentResult || !paymentResult.success) {
            paymentResult = await alipayService.transferToAccount(
              payeeAccount,
              transferAmount,
              transferRemark,
              outBizNo,
              payeeRealName
            );
            
            console.log('[editor-settlement] 支付宝API返回结果:', JSON.stringify(paymentResult, null, 2));
          }
        } catch (alipayError) {
          console.error('[editor-settlement] 支付宝调用错误:', alipayError);
          paymentResult = {
            success: false,
            message: `支付宝支付失败: ${alipayError.message}`,
            error: alipayError
          };
        }
      } else if (method.toLowerCase() === 'wechat') {
        // TODO: 调用微信企业付款API
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
        const providerTxId = paymentResult.order_id || paymentResult.orderId || 
                             paymentResult.payFundOrderId || paymentResult.tx_id || 
                             paymentResult.batch_id || paymentResult.payout_item_id || null;
        let dbStatus = 'processing';
        
        if (method.toLowerCase() === 'paypal') {
          const paypalStatus = paymentResult.status || 'PENDING';
          if (paypalStatus === 'SUCCESS') {
            dbStatus = 'succeeded';
          } else if (paypalStatus === 'DENIED' || paypalStatus === 'FAILED') {
            dbStatus = 'failed';
          }
        } else if (method.toLowerCase() === 'alipay') {
          dbStatus = 'succeeded';
        }
        
        await db.execute(
          `UPDATE payout_gateway_transaction
           SET provider_tx_id = ?,
               status = ?,
               response_payload = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [
            providerTxId || null,
            dbStatus,
            JSON.stringify(paymentResult),
            gatewayTxId
          ]
        );
        
        // 如果支付成功，更新支付单和结算记录
        if (dbStatus === 'succeeded') {
          await db.execute(
            `UPDATE editor_payout
             SET status = 'paid',
                 paid_at = NOW(),
                 updated_at = NOW()
             WHERE id = ?`,
            [payoutId]
          );
          
          await db.execute(
            `UPDATE editor_settlement_monthly
             SET payout_status = 'paid',
                 updated_at = NOW()
             WHERE id = ?`,
            [settlementMonthlyId]
          );
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
            gatewayTxId || null
          ]
        );
        
        await db.execute(
          `UPDATE editor_payout
           SET status = 'failed',
               updated_at = NOW()
           WHERE id = ?`,
          [payoutId]
        );
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
    console.error('[editor-settlement] 发起支付错误:', error);
    res.status(500).json({
      success: false,
      message: '发起支付失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 同步编辑PayPal状态
router.post('/editor-settlements/:settlementMonthlyId/sync-paypal', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const settlementMonthlyId = parseInt(req.params.settlementMonthlyId);
    
    if (isNaN(settlementMonthlyId)) {
      return res.status(400).json({
        success: false,
        message: '无效的结算记录ID'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    // 1. 查询 editor_settlement_monthly
    const [settlementRows] = await db.execute(
      'SELECT * FROM editor_settlement_monthly WHERE id = ?',
      [settlementMonthlyId]
    );
    
    if (settlementRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '结算记录不存在'
      });
    }
    
    const settlementMonthly = settlementRows[0];
    
    // 2. 检查是否有 payout_id
    if (!settlementMonthly.payout_id) {
      return res.status(400).json({
        success: false,
        message: '尚未发起支付，无法同步状态'
      });
    }
    
    // 3. 查询 editor_payout
    const [payoutRows] = await db.execute(
      'SELECT * FROM editor_payout WHERE id = ?',
      [settlementMonthly.payout_id]
    );
    
    if (payoutRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '支付单不存在'
      });
    }
    
    const payout = payoutRows[0];
    
    // 4. 检查支付方式
    if (payout.method !== 'paypal') {
      return res.status(400).json({
        success: false,
        message: '只有PayPal支付才能同步状态'
      });
    }
    
    // 5. 查询 gateway_transaction
    if (!payout.gateway_tx_id) {
      return res.status(400).json({
        success: false,
        message: '支付单没有关联的网关交易记录'
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
    
    // 6. 从 response_payload 或 request_payload 提取 batch_id
    let batchId = null;
    
    // 尝试从 response_payload 中提取
    if (gatewayTx.response_payload) {
      try {
        const responsePayload = typeof gatewayTx.response_payload === 'string'
          ? JSON.parse(gatewayTx.response_payload)
          : gatewayTx.response_payload;
        batchId = responsePayload.batch_id || responsePayload.batch_header?.payout_batch_id || 
                  responsePayload.batch_header?.batch_id || null;
      } catch (e) {
        console.warn('[editor-settlement] 解析 response_payload 失败:', e.message);
      }
    }
    
    // 如果还是没有，尝试从 request_payload 中提取
    if (!batchId && gatewayTx.request_payload) {
      try {
        const requestPayload = typeof gatewayTx.request_payload === 'string'
          ? JSON.parse(gatewayTx.request_payload)
          : gatewayTx.request_payload;
        batchId = requestPayload.batch_id || requestPayload.sender_batch_id || null;
      } catch (e) {
        console.warn('[editor-settlement] 解析 request_payload 失败:', e.message);
      }
    }
    
    // 如果还是没有，尝试使用 provider_tx_id（可能是 batch_id）
    if (!batchId) {
      batchId = gatewayTx.provider_tx_id;
    }
    
    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: '当前交易记录缺少 PayPal 批次ID，无法同步状态。请尝试重新发起支付。'
      });
    }
    
    // 7. 调用PayPal API查询状态
    let paypalStatus = null;
    try {
      // 使用 getBatchStatus 或 getPayoutStatus（根据实际情况选择）
      if (batchId && batchId.startsWith('PAYOUT_')) {
        // 如果是批次ID格式，使用 getBatchStatus
        paypalStatus = await paypalService.getBatchStatus(batchId);
      } else {
        // 否则使用 getPayoutStatus
        paypalStatus = await paypalService.getPayoutStatus(batchId);
      }
      console.log('[editor-settlement] PayPal批次状态查询结果:', JSON.stringify(paypalStatus, null, 2));
    } catch (paypalError) {
      console.error('[editor-settlement] PayPal状态查询错误:', paypalError);
      return res.status(500).json({
        success: false,
        message: `PayPal状态查询失败: ${paypalError.message}`
      });
    }
    
    // 8. 根据PayPal返回的状态更新数据库
    const batchStatus = paypalStatus?.batch_header?.batch_status || paypalStatus?.batch_status || 'UNKNOWN';
    
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
      
      // 如果PayPal状态为SUCCESS，更新editor_payout和editor_settlement_monthly
      if (batchStatus === 'SUCCESS') {
        await db.execute(
          `UPDATE editor_payout
           SET status = 'paid',
               paid_at = NOW(),
               updated_at = NOW()
           WHERE id = ?`,
          [payout.id]
        );
        
        await db.execute(
          `UPDATE editor_settlement_monthly
           SET payout_status = 'paid',
               updated_at = NOW()
           WHERE id = ?`,
          [settlementMonthlyId]
        );
      } else if (batchStatus === 'DENIED' || batchStatus === 'FAILED') {
        // 如果失败，更新editor_payout状态
        await db.execute(
          `UPDATE editor_payout
           SET status = 'failed',
               updated_at = NOW()
           WHERE id = ?`,
          [payout.id]
        );
        
        // editor_settlement_monthly.payout_status 保持 'unpaid'（支付失败意味着还是未支付状态）
      }
      
      await db.commit();
      
      // 重新查询更新后的数据
      const [updatedSettlementRows] = await db.execute(
        'SELECT * FROM editor_settlement_monthly WHERE id = ?',
        [settlementMonthlyId]
      );
      
      const [updatedPayoutRows] = await db.execute(
        'SELECT * FROM editor_payout WHERE id = ?',
        [payout.id]
      );
      
      const [updatedGatewayRows] = await db.execute(
        'SELECT * FROM payout_gateway_transaction WHERE id = ?',
        [gatewayTx.id]
      );
      
      const updatedSettlement = updatedSettlementRows[0];
      const updatedPayout = updatedPayoutRows[0];
      const updatedGatewayTx = updatedGatewayRows[0];
      
      res.json({
        success: true,
        message: `同步成功，当前状态: ${batchStatus === 'SUCCESS' ? '已支付' : batchStatus === 'DENIED' || batchStatus === 'FAILED' ? '支付失败' : '处理中'}`,
        data: {
          settlement_monthly: {
            id: updatedSettlement.id,
            editor_admin_id: updatedSettlement.editor_admin_id,
            role: updatedSettlement.role,
            month: updatedSettlement.month,
            total_income_usd: parseFloat(updatedSettlement.total_income_usd || 0),
            payout_status: updatedSettlement.payout_status,
            payout_id: updatedSettlement.payout_id || null
          },
          payout: {
            id: updatedPayout.id,
            status: updatedPayout.status,
            method: updatedPayout.method,
            payout_currency: updatedPayout.payout_currency,
            payout_amount: parseFloat(updatedPayout.payout_amount || 0)
          },
          gateway_tx: {
            id: updatedGatewayTx.id,
            status: updatedGatewayTx.status,
            provider_tx_id: updatedGatewayTx.provider_tx_id,
            response_payload: updatedGatewayTx.response_payload ? 
              (typeof updatedGatewayTx.response_payload === 'string' ? 
                JSON.parse(updatedGatewayTx.response_payload) : 
                updatedGatewayTx.response_payload) : null
          }
        }
      });
    } catch (error) {
      await db.rollback();
      throw error;
    }
  } catch (error) {
    console.error('[editor-settlement] 同步PayPal状态错误:', error);
    res.status(500).json({
      success: false,
      message: '同步失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 查看编辑结算详情
router.get('/editor-settlements/:settlementMonthlyId/detail', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const settlementMonthlyId = parseInt(req.params.settlementMonthlyId);
    
    if (isNaN(settlementMonthlyId)) {
      return res.status(400).json({
        success: false,
        message: '无效的结算记录ID'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    // 1. 查询 editor_settlement_monthly
    const [settlementRows] = await db.execute(
      'SELECT * FROM editor_settlement_monthly WHERE id = ?',
      [settlementMonthlyId]
    );
    
    if (settlementRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '结算记录不存在'
      });
    }
    
    const settlementMonthly = settlementRows[0];
    
    // 2. 获取编辑基本信息
    const [admins] = await db.execute(
      'SELECT id, name, email, role, real_name FROM admin WHERE id = ?',
      [settlementMonthly.editor_admin_id]
    );
    
    if (admins.length === 0) {
      return res.status(404).json({
        success: false,
        message: '编辑不存在'
      });
    }
    
    const editor = admins[0];
    
    // 3. 查询 editor_payout 记录
    const payouts = [];
    if (settlementMonthly.payout_id) {
      const [payoutRows] = await db.execute(
        'SELECT * FROM editor_payout WHERE id = ? OR settlement_monthly_id = ? ORDER BY id DESC',
        [settlementMonthly.payout_id, settlementMonthlyId]
      );
      
      for (const payout of payoutRows) {
        // 4. 查询对应的 gateway_transaction
        let gatewayTransaction = null;
        if (payout.gateway_tx_id) {
          const [gatewayRows] = await db.execute(
            'SELECT * FROM payout_gateway_transaction WHERE id = ?',
            [payout.gateway_tx_id]
          );
          
          if (gatewayRows.length > 0) {
            gatewayTransaction = gatewayRows[0];
          }
        }
        
        payouts.push({
          ...payout,
          gateway_transaction: gatewayTransaction
        });
      }
    }
    
    // 5. 查询编辑收款账户（admin_payout_account）
    const [accountRows] = await db.execute(
      'SELECT * FROM admin_payout_account WHERE admin_id = ? AND status = ? ORDER BY is_default DESC, id ASC',
      [settlementMonthly.editor_admin_id, 'active']
    );
    
    const allAccounts = accountRows || [];
    let defaultAccount = null;
    if (allAccounts.length > 0) {
      // 优先取 is_default = 1 的账户
      defaultAccount = allAccounts.find(acc => acc.is_default === 1) || allAccounts[0];
    }
    
    // 兼容旧接口：如果有 payouts，取第一个作为 payout
    const payout = payouts.length > 0 ? payouts[0] : null;
    const gateway_transaction = payout?.gateway_transaction || null;
    
    res.json({
      success: true,
      data: {
        settlement_monthly: settlementMonthly,
        editor: editor,
        payout: payout,
        gateway_transaction: gateway_transaction,
        payouts: payouts,
        gateway_transactions: payouts.map(p => p.gateway_transaction).filter(t => t !== null),
        all_accounts: allAccounts,
        default_account: defaultAccount
      }
    });
  } catch (error) {
    console.error('[editor-settlement] 获取结算详情错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
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

// ========== 编辑结算相关接口 ==========

// 生成编辑结算汇总
router.post('/editor-settlement/generate-monthly', authenticateAdmin, async (req, res) => {
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
    
    console.log(`[editor-settlement] 开始生成 ${monthStart} 的编辑结算汇总`);
    
    db = await mysql.createConnection(dbConfig);
    
    // 从 editor_income_monthly 表聚合数据
    const [aggregatedResults] = await db.execute(
      `SELECT 
        editor_admin_id,
        role,
        month,
        SUM(editor_income_usd) AS total_income_usd,
        COUNT(DISTINCT novel_id) AS novel_count,
        COUNT(*) AS record_count
       FROM editor_income_monthly
       WHERE month = ?
       GROUP BY editor_admin_id, role, month`,
      [monthStart]
    );
    
    console.log(`[editor-settlement] 查询到 ${aggregatedResults.length} 条聚合记录`);
    
    let processed = 0;
    let errors = [];
    
    for (const row of aggregatedResults) {
      try {
        const editorAdminId = row.editor_admin_id;
        const role = row.role;
        const totalIncomeUsd = parseFloat(row.total_income_usd || 0);
        const novelCount = parseInt(row.novel_count || 0);
        const recordCount = parseInt(row.record_count || 0);
        
        // 检查是否已有记录且已支付
        const [existingRows] = await db.execute(
          `SELECT id, payout_status, payout_id 
           FROM editor_settlement_monthly 
           WHERE editor_admin_id = ? AND role = ? AND month = ?`,
          [editorAdminId, role, monthStart]
        );
        
        let payoutStatus = 'unpaid';
        let payoutId = null;
        
        if (existingRows.length > 0) {
          const existing = existingRows[0];
          // 如果已支付，保留原有状态和 payout_id
          if (existing.payout_status === 'paid') {
            payoutStatus = 'paid';
            payoutId = existing.payout_id;
            // 只更新金额字段，不覆盖支付状态
            await db.execute(
              `UPDATE editor_settlement_monthly 
               SET total_income_usd = ?,
                   novel_count = ?,
                   record_count = ?,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = ?`,
              [totalIncomeUsd, novelCount, recordCount, existing.id]
            );
            processed++;
            continue;
          }
        }
        
        // 检查是否有已支付的支付单
        if (totalIncomeUsd > 0) {
          const [payoutResult] = await db.execute(
            `SELECT id, status FROM editor_payout
             WHERE editor_admin_id = ? AND role = ? AND month = ? AND status = 'paid'
             LIMIT 1`,
            [editorAdminId, role, monthStart]
          );
          
          if (payoutResult.length > 0) {
            payoutStatus = 'paid';
            payoutId = payoutResult[0].id;
          }
        }
        
        // 插入或更新 editor_settlement_monthly
        await db.execute(
          `INSERT INTO editor_settlement_monthly 
           (editor_admin_id, role, month, total_income_usd, novel_count, record_count, payout_status, payout_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
           total_income_usd = VALUES(total_income_usd),
           novel_count = VALUES(novel_count),
           record_count = VALUES(record_count),
           payout_status = VALUES(payout_status),
           payout_id = VALUES(payout_id),
           updated_at = CURRENT_TIMESTAMP`,
          [editorAdminId, role, monthStart, totalIncomeUsd, novelCount, recordCount, payoutStatus, payoutId]
        );
        
        processed++;
      } catch (error) {
        console.error(`[editor-settlement] 处理编辑 ${row.editor_admin_id} (${row.role}) 失败:`, error);
        errors.push({ editor_admin_id: row.editor_admin_id, role: row.role, error: error.message });
      }
    }
    
    console.log(`[editor-settlement] 生成完成: 处理 ${processed} 条记录，${errors.length} 个错误`);
    
    res.json({
      success: true,
      message: `编辑月度结算生成完成: ${processed} 条记录`,
      data: {
        processed,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    console.error('[editor-settlement] 生成月度结算汇总错误:', error);
    res.status(500).json({
      success: false,
      message: '生成失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取编辑结算总览列表
router.get('/editor-settlement/overview', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { month, status, role, editorId } = req.query;
    
    db = await mysql.createConnection(dbConfig);
    
    // 解析月份
    const monthStart = month ? parseMonth(month) : null;
    const monthParam = monthStart || new Date().toISOString().substring(0, 7) + '-01';
    
    let query = `
      SELECT 
        esm.id AS settlement_id,
        esm.editor_admin_id,
        esm.role,
        esm.month,
        esm.total_income_usd,
        esm.novel_count,
        esm.record_count,
        esm.payout_status,
        esm.payout_id,
        COALESCE(a.real_name, a.name) AS editor_name,
        ep.method AS payout_method,
        ep.payout_currency,
        ep.payout_amount
      FROM editor_settlement_monthly esm
      LEFT JOIN admin a ON esm.editor_admin_id = a.id
      LEFT JOIN editor_payout ep ON esm.payout_id = ep.id
      WHERE esm.month = ?
    `;
    
    const params = [monthParam];
    
    // 角色筛选
    if (role && role !== 'all') {
      if (role === 'editor') {
        query += ' AND esm.role = ?';
        params.push('editor');
      } else if (role === 'chief_editor') {
        query += ' AND esm.role = ?';
        params.push('chief_editor');
      }
    }
    
    // 编辑ID筛选
    if (editorId) {
      query += ' AND esm.editor_admin_id = ?';
      params.push(parseInt(editorId));
    }
    
    // 状态筛选
    if (status && status !== 'all') {
      if (status === 'unpaid') {
        query += ' AND (esm.payout_status IS NULL OR esm.payout_status = \'unpaid\')';
      } else {
        query += ' AND esm.payout_status = ?';
        params.push(status);
      }
    }
    
    // 只显示有收入的记录
    query += ' AND esm.total_income_usd > 0';
    
    // 排序
    query += ' ORDER BY esm.total_income_usd DESC, esm.editor_admin_id ASC';
    
    const [results] = await db.execute(query, params);
    
    res.json({
      success: true,
      data: results.map(row => ({
        settlement_id: row.settlement_id,
        editor_admin_id: row.editor_admin_id,
        editor_name: row.editor_name || `编辑${row.editor_admin_id}`,
        role: row.role,
        month: row.month ? row.month.toString().substring(0, 10) : null,
        total_income_usd: parseFloat(row.total_income_usd || 0),
        novel_count: parseInt(row.novel_count || 0),
        record_count: parseInt(row.record_count || 0),
        payout_status: row.payout_status || 'unpaid',
        payout_id: row.payout_id || null,
        payout_method: row.payout_method || null,
        payout_currency: row.payout_currency || null,
        payout_amount: row.payout_amount ? parseFloat(row.payout_amount) : null
      }))
    });
  } catch (error) {
    console.error('[editor-settlement] 获取编辑结算总览错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
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
    const startChapter = apply_from_chapter_number || 1; // 从第1章开始更新
    
    // 获取所有需要更新的章节（包括前N章）
    const [chapters] = await db.execute(
      `SELECT id, chapter_number, word_count, content
       FROM chapter 
       WHERE novel_id = ? AND chapter_number >= ?
       ORDER BY chapter_number ASC`,
      [novelId, startChapter]
    );
    
    let updatedCount = 0;
    let errorCount = 0;
    let freeChaptersCount = 0;
    
    for (const chapter of chapters) {
      try {
        let basePrice = 0;
        let calculatedWordCount = parseInt(chapter.word_count) || 0;
        
        // 如果word_count为0或NULL，从content计算字数
        if (calculatedWordCount === 0 && chapter.content) {
          // 计算字数（去除空格和换行）
          calculatedWordCount = chapter.content.replace(/\s/g, '').length;
        }
        
        // 前N章免费（根据default_free_chapters设置）
        if (chapter.chapter_number <= config.default_free_chapters) {
          basePrice = 0;
          freeChaptersCount++;
        } else {
          // 收费章节按字数计算价格
          const words = calculatedWordCount || 0;
          if (words <= 0) {
            basePrice = config.min_karma;
          } else {
            basePrice = Math.ceil((words / 1000) * config.karma_per_1000);
            basePrice = Math.max(basePrice, config.min_karma);
            basePrice = Math.min(basePrice, config.max_karma);
          }
        }
        
        // 更新章节价格和字数
        await db.execute(
          'UPDATE chapter SET unlock_price = ?, word_count = ? WHERE id = ?',
          [basePrice, calculatedWordCount, chapter.id]
        );
        
        updatedCount++;
      } catch (err) {
        console.error(`更新章节 ${chapter.id} 失败:`, err);
        errorCount++;
      }
    }
    
    res.json({
      success: true,
      message: `成功更新 ${updatedCount} 个章节（其中 ${freeChaptersCount} 个免费章节），失败 ${errorCount} 个`,
      data: { updated: updatedCount, failed: errorCount, freeChapters: freeChaptersCount }
    });
  } catch (error) {
    console.error('批量重新计算价格失败:', error);
    res.status(500).json({ success: false, message: '计算失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// 获取小说的章节列表（用于查看章节价格）
router.get('/novels/:novelId/chapters', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { novelId } = req.params;
    db = await mysql.createConnection(dbConfig);
    
    // 先检查updated_at字段是否存在
    const [columns] = await db.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'chapter' 
       AND COLUMN_NAME = 'updated_at'`
    );
    
    const hasUpdatedAt = columns.length > 0;
    
    const [chapters] = await db.execute(
      `SELECT 
        id,
        volume_id,
        chapter_number,
        title,
        unlock_price,
        is_advance,
        word_count,
        review_status,
        is_released,
        release_date,
        created_at${hasUpdatedAt ? ', updated_at' : ', created_at as updated_at'}
      FROM chapter 
      WHERE novel_id = ?
      ORDER BY chapter_number ASC`,
      [novelId]
    );
    
    res.json({
      success: true,
      data: chapters.map(ch => ({
        id: ch.id,
        volume_id: ch.volume_id,
        chapter_number: ch.chapter_number,
        title: ch.title || `第${ch.chapter_number}章`,
        unlock_price: parseFloat(ch.unlock_price || 0),
        is_advance: ch.is_advance === 1,
        word_count: parseInt(ch.word_count || 0),
        review_status: ch.review_status,
        is_released: ch.is_released === 1,
        release_date: ch.release_date,
        created_at: ch.created_at,
        updated_at: ch.updated_at || ch.created_at
      }))
    });
  } catch (error) {
    console.error('获取章节列表失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: error.message });
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
      updateValues.push(formatDateForMySQL(start_at));
    }
    
    if (end_at !== undefined) {
      updateFields.push('end_at = ?');
      updateValues.push(formatDateForMySQL(end_at));
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
      [novel_id, promotion_type, discount_value, formatDateForMySQL(start_at), formatDateForMySQL(end_at), status, adminId, adminId, remark || null]
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

// ==================== 章节审核系统 ====================

// 获取待审核章节列表
router.get('/pending-chapters', authenticateAdmin, requireRole('super_admin', 'chief_editor', 'editor'), async (req, res) => {
  let db;
  try {
    const { status, page = 1, limit = 20 } = req.query;
    db = await mysql.createConnection(dbConfig);
    
    // 应用权限过滤
    const permissionFilter = await getNovelPermissionFilter(
      db, 
      req.admin.adminId, 
      req.admin.role
    );
    
    let query = `
      SELECT 
        c.id,
        c.novel_id,
        c.chapter_number,
        c.title,
        c.content,
        c.translator_note,
        c.word_count,
        c.review_status,
        c.is_released,
        c.release_date,
        c.created_at,
        n.title as novel_title,
        n.author,
        n.current_editor_admin_id,
        u.username as author_name,
        u.pen_name as author_pen_name
      FROM chapter c
      LEFT JOIN novel n ON c.novel_id = n.id
      LEFT JOIN user u ON n.user_id = u.id
      WHERE c.review_status IN ('submitted', 'reviewing') ${permissionFilter.where}
    `;
    const params = [...permissionFilter.params];
    
    if (status && status !== 'all') {
      query += ' AND c.review_status = ?';
      params.push(status);
    }
    
    // LIMIT 和 OFFSET 需要直接插入数值，不能使用占位符
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offsetNum = (pageNum - 1) * limitNum;
    query += ` ORDER BY c.created_at DESC LIMIT ${limitNum} OFFSET ${offsetNum}`;
    
    const [chapters] = await db.execute(query, params);
    
    // 获取总数
    let countQuery = `
      SELECT COUNT(*) as total
      FROM chapter c
      LEFT JOIN novel n ON c.novel_id = n.id
      WHERE c.review_status IN ('submitted', 'reviewing') ${permissionFilter.where}
    `;
    const countParams = [...permissionFilter.params];
    if (status && status !== 'all') {
      countQuery += ' AND c.review_status = ?';
      countParams.push(status);
    }
    const [countResult] = await db.execute(countQuery, countParams);
    const total = countResult[0].total;
    
    res.json({
      success: true,
      data: chapters.map(ch => ({
        id: ch.id,
        novel_id: ch.novel_id,
        novel_title: ch.novel_title,
        author: ch.author_name || ch.author_pen_name || ch.author,
        chapter_number: ch.chapter_number,
        title: ch.title || `第${ch.chapter_number}章`,
        content_preview: ch.content ? ch.content.substring(0, 200) : '',
        translator_note: ch.translator_note,
        word_count: parseInt(ch.word_count || 0),
        review_status: ch.review_status,
        is_released: ch.is_released === 1,
        release_date: ch.release_date,
        created_at: ch.created_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('获取待审核章节列表失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// ==================== 章节审批系统（Phase 1） ====================

// 获取章节列表（分页+筛选+搜索）
router.get('/chapters', authenticateAdmin, requireRole('super_admin', 'chief_editor', 'editor'), async (req, res) => {
  let db;
  try {
    const { 
      status,           // 审核状态筛选
      novel_id,         // 小说ID筛选
      search,           // 搜索关键词（小说名/章节标题/章节ID）
      page = 1, 
      limit = 20 
    } = req.query;
    
    db = await mysql.createConnection(dbConfig);
    
    // 应用权限过滤
    const permissionFilter = await getNovelPermissionFilter(
      db, 
      req.admin.adminId, 
      req.admin.role
    );
    
    // requires_chief_edit 已不再是 novel 表字段，而是运行时计算：当前是否存在有效主编合同，用于前端控制是否走主编终审流程
    let query = `
      SELECT 
        c.id,
        c.novel_id,
        c.volume_id,
        c.chapter_number,
        c.title,
        c.word_count,
        c.review_status,
        c.is_released,
        c.is_advance,
        c.unlock_price,
        c.key_cost,
        c.unlock_priority,
        c.release_date,
        c.created_at,
        c.updated_at,
        n.title as novel_title,
        n.author,
        n.current_editor_admin_id,
        n.chief_editor_admin_id,
        n.cover as novel_cover,
        v.title as volume_name,
        u.username as author_name,
        u.pen_name as author_pen_name,
        ae.name as editor_name,
        ac.name as chief_editor_name,
        c.editor_admin_id as chapter_editor_admin_id,
        c.chief_editor_admin_id as chapter_chief_editor_admin_id,
        nec_chief.id as chief_contract_id
      FROM chapter c
      LEFT JOIN novel n ON c.novel_id = n.id
      LEFT JOIN volume v ON c.volume_id = v.id
      LEFT JOIN user u ON n.user_id = u.id
      LEFT JOIN admin ae ON n.current_editor_admin_id = ae.id
      LEFT JOIN admin ac ON n.chief_editor_admin_id = ac.id
      LEFT JOIN novel_editor_contract nec_chief
        ON nec_chief.novel_id = n.id
       AND nec_chief.editor_admin_id = n.chief_editor_admin_id
       AND nec_chief.role = 'chief_editor'
       AND nec_chief.status = 'active'
       AND nec_chief.start_date <= NOW()
       AND (nec_chief.end_date IS NULL OR nec_chief.end_date >= NOW())
      WHERE 1=1 ${permissionFilter.where}
      AND c.review_status != 'draft'  -- 排除草稿状态的章节
    `;
    const params = [...permissionFilter.params];
    
    // 审核状态筛选
    if (status && status !== 'all') {
      query += ' AND c.review_status = ?';
      params.push(status);
    }
    
    // 小说ID筛选
    if (novel_id) {
      query += ' AND c.novel_id = ?';
      params.push(novel_id);
    }
    
    // 搜索（小说名/章节标题/章节ID）
    if (search) {
      query += ' AND (n.title LIKE ? OR c.title LIKE ? OR c.id = ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, search);
    }
    
    // 获取总数
    let countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
    countQuery = countQuery.replace(/ORDER BY[\s\S]*$/, '');
    const [countResult] = await db.execute(countQuery, params);
    const total = countResult[0].total;
    
    // 添加排序和分页（LIMIT 和 OFFSET 需要直接插入数值，不能使用占位符）
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offsetNum = (pageNum - 1) * limitNum;
    query += ` ORDER BY c.created_at DESC LIMIT ${limitNum} OFFSET ${offsetNum}`;
    
    const [chapters] = await db.execute(query, params);
    
    res.json({
      success: true,
      data: chapters.map(ch => ({
        id: ch.id,
        novel_id: ch.novel_id,
        novel_title: ch.novel_title,
        novel_cover: ch.novel_cover,
        requires_chief_edit: !!ch.chief_contract_id, // 运行时计算：是否存在有效主编合同（字段+合同双判断），用于前端控制是否走主编终审流程
        volume_id: ch.volume_id,
        volume_name: ch.volume_name || `第${ch.volume_id}卷`,
        chapter_number: ch.chapter_number,
        title: ch.title || `第${ch.chapter_number}章`,
        word_count: parseInt(ch.word_count || 0),
        author: ch.author_name || ch.author_pen_name || ch.author,
        editor_admin_id: ch.current_editor_admin_id,
        editor_name: ch.editor_name || null,
        chief_editor_admin_id: ch.chief_editor_admin_id,
        chief_editor_name: ch.chief_editor_name || null,
        chapter_editor_admin_id: ch.chapter_editor_admin_id,
        chapter_chief_editor_admin_id: ch.chapter_chief_editor_admin_id,
        review_status: ch.review_status,
        is_released: ch.is_released === 1,
        is_advance: ch.is_advance === 1,
        unlock_price: parseInt(ch.unlock_price || 0),
        key_cost: parseInt(ch.key_cost || 0),
        unlock_priority: ch.unlock_priority || 'free',
        release_date: ch.release_date,
        created_at: ch.created_at,
        updated_at: ch.updated_at
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('获取章节列表失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// 获取章节详情（完整信息）
router.get('/chapter/:id', authenticateAdmin, requireRole('super_admin', 'chief_editor', 'editor'), async (req, res) => {
  let db;
  try {
    const { id } = req.params;
    db = await mysql.createConnection(dbConfig);
    
    // requires_chief_edit 已不再是 novel 表字段，而是运行时计算：当前是否存在有效主编合同，用于前端控制是否走主编终审流程
    // 注意：明确列出所有字段，避免c.*覆盖别名字段
    // 先查询chapter表的所有字段，然后添加别名字段
    const [chapters] = await db.execute(
      `SELECT 
        c.id,
        c.novel_id,
        c.volume_id,
        c.chapter_number,
        c.title,
        c.content,
        c.translator_note,
        c.word_count,
        c.review_status,
        c.is_released,
        c.is_advance,
        c.unlock_price,
        c.key_cost,
        c.unlock_priority,
        c.release_date,
        c.created_at,
        c.updated_at,
        c.editor_admin_id,
        c.chief_editor_admin_id,
        n.title as novel_title,
        n.author,
        n.current_editor_admin_id as novel_editor_admin_id,
        n.chief_editor_admin_id as novel_chief_editor_admin_id,
        n.cover as novel_cover,
        v.title as volume_name,
        v.volume_id as volume_number,
        u.username as author_name,
        u.pen_name as author_pen_name,
        ae.name as novel_editor_name,
        ac.name as novel_chief_editor_name,
        ce.name as chapter_editor_name,
        cce.name as chapter_chief_editor_name,
        nec_chief.id as chief_contract_id
      FROM chapter c
      LEFT JOIN novel n ON c.novel_id = n.id
      LEFT JOIN volume v ON c.volume_id = v.id
      LEFT JOIN user u ON n.user_id = u.id
      LEFT JOIN admin ae ON n.current_editor_admin_id = ae.id
      LEFT JOIN admin ac ON n.chief_editor_admin_id = ac.id
      LEFT JOIN admin ce ON ce.id = c.editor_admin_id
      LEFT JOIN admin cce ON cce.id = c.chief_editor_admin_id
      LEFT JOIN novel_editor_contract nec_chief
        ON nec_chief.novel_id = n.id
       AND nec_chief.editor_admin_id = n.chief_editor_admin_id
       AND nec_chief.role = 'chief_editor'
       AND nec_chief.status = 'active'
       AND nec_chief.start_date <= NOW()
       AND (nec_chief.end_date IS NULL OR nec_chief.end_date >= NOW())
      WHERE c.id = ?`,
      [id]
    );
    
    if (chapters.length === 0) {
      return res.status(404).json({ success: false, message: '章节不存在' });
    }
    
    const chapter = chapters[0];
    
    // 调试日志：检查所有章节的查询结果
    console.log('[章节详情调试] SQL查询结果 - 所有字段:', Object.keys(chapter));
    console.log('[章节详情调试] SQL查询结果 - novel相关字段:', {
      'novel_editor_admin_id': chapter.novel_editor_admin_id,
      'novel_editor_name': chapter.novel_editor_name,
      'novel_chief_editor_admin_id': chapter.novel_chief_editor_admin_id,
      'novel_chief_editor_name': chapter.novel_chief_editor_name,
      'novel_id': chapter.novel_id
    });
    
    // 调试日志：检查小说级别编辑信息是否正确查询（仅针对小说ID=10）
    if (chapter.novel_id === 10) {
      console.log(`[章节详情调试] 小说ID=10的章节详情查询结果:`);
      console.log(`  novel_editor_admin_id=${chapter.novel_editor_admin_id}, novel_editor_name=${chapter.novel_editor_name}`);
      console.log(`  novel_chief_editor_admin_id=${chapter.novel_chief_editor_admin_id}, novel_chief_editor_name=${chapter.novel_chief_editor_name}`);
      
      // 直接查询novel表检查数据
      const [novelCheck] = await db.execute(
        'SELECT current_editor_admin_id, chief_editor_admin_id FROM novel WHERE id = ?',
        [chapter.novel_id]
      );
      console.log(`[章节详情调试] novel表原始数据:`, novelCheck[0]);
      
      // 如果有current_editor_admin_id，检查admin表
      if (novelCheck[0]?.current_editor_admin_id) {
        const [editorCheck] = await db.execute(
          'SELECT id, name FROM admin WHERE id = ?',
          [novelCheck[0].current_editor_admin_id]
        );
        console.log(`[章节详情调试] admin表editor数据:`, editorCheck[0]);
      }
      
      // 如果有chief_editor_admin_id，检查admin表
      if (novelCheck[0]?.chief_editor_admin_id) {
        const [chiefCheck] = await db.execute(
          'SELECT id, name FROM admin WHERE id = ?',
          [novelCheck[0].chief_editor_admin_id]
        );
        console.log(`[章节详情调试] admin表chief_editor数据:`, chiefCheck[0]);
      }
    }
    
    // 检查权限（用于查看章节详情）
    // super_admin 可以看到所有章节，但审核权限仍需检查合同
    const canView = req.admin.role === 'super_admin' || await checkNovelPermission(
      db,
      req.admin.adminId,
      req.admin.role,
      chapter.novel_id
    );
    
    if (!canView) {
      return res.status(403).json({ success: false, message: '无权限访问此章节' });
    }
    
    // requires_chief_edit 运行时计算：是否存在有效主编合同（字段+合同双判断）
    const requiresChiefEdit = !!chapter.chief_contract_id;
    
    // 获取小说信息（用于计算 can_review）
    const [novels] = await db.execute(
      'SELECT id, chief_editor_admin_id FROM novel WHERE id = ?',
      [chapter.novel_id]
    );
    const novel = novels[0];
    
    // 使用新的统一函数计算 can_review
    let canReview = await computeChapterCanReview(
      db,
      { adminId: req.admin.adminId, role: req.admin.role },
      chapter,
      novel
    );
    
    // 在编辑阶段（非 pending_chief），叠加"责任编辑覆盖规则"的判断
    // 主编终审阶段（pending_chief）不检查 editor_admin_id 覆盖规则
    // 主编在编辑阶段也走这个逻辑，规则与 canCurrentAdminOverrideEditor 保持一致
    if (canReview && chapter.review_status !== 'pending_chief') {
      // 如果章节没有 editor_admin_id，允许审核（任意编辑/主编/超管都可以绑定）
      if (!chapter.editor_admin_id) {
        canReview = true;
      } else {
        // 查询已有归属人的角色
        const [existingAdmins] = await db.execute(
          'SELECT role FROM admin WHERE id = ?',
          [chapter.editor_admin_id]
        );
        const existingRole = existingAdmins.length > 0 ? (existingAdmins[0].role || 'editor') : 'editor';
        const currentAdminId = req.admin.adminId;
        const currentAdminRole = req.admin.role;
        
        if (chapter.editor_admin_id === currentAdminId) {
          // 自己永远可以再审（自己重复审批或修正）
          canReview = true;
        } else if (currentAdminRole === 'super_admin') {
          // 超管永远可以（超管可以覆盖任意人的）
          canReview = true;
        } else if (existingRole === 'super_admin' && (currentAdminRole === 'editor' || currentAdminRole === 'chief_editor')) {
          // 之前是超管审的，现在是普通编辑/主编来审，也允许（可以从超管手里接盘）
          canReview = true;
        } else if (currentAdminRole === 'editor') {
          // 普通编辑遇到"别人的章节"，禁止（抢功防护）
          canReview = false;
        } else {
          // chief_editor 走到这里一律不再因为 editor_admin_id 被禁止
          // 保持 canReview = true（主编可以重新审核，但不会改 editor_admin_id）
          canReview = true;
        }
      }
    }
    
    // 调试日志：检查返回前的数据
    console.log('[后端返回前] chapter对象中的字段:', {
      'chapter.novel_editor_admin_id': chapter.novel_editor_admin_id,
      'chapter.novel_editor_name': chapter.novel_editor_name,
      'chapter.novel_chief_editor_admin_id': chapter.novel_chief_editor_admin_id,
      'chapter.novel_chief_editor_name': chapter.novel_chief_editor_name,
      'chapter.novel_id': chapter.novel_id
    });
    
    // 参考章节列表API的实现方式，确保novel编辑字段正确获取
    // 直接从SQL查询结果中获取，如果为undefined则设为null
    const novelEditorAdminId = chapter.novel_editor_admin_id !== undefined ? chapter.novel_editor_admin_id : null;
    const novelEditorName = chapter.novel_editor_name !== undefined ? chapter.novel_editor_name : null;
    const novelChiefEditorAdminId = chapter.novel_chief_editor_admin_id !== undefined ? chapter.novel_chief_editor_admin_id : null;
    const novelChiefEditorName = chapter.novel_chief_editor_name !== undefined ? chapter.novel_chief_editor_name : null;
    
    // 调试：检查从SQL查询结果中获取的值
    console.log('[章节详情调试] 从chapter对象中提取的novel编辑字段:', {
      'chapter.novel_editor_admin_id (原始值)': chapter.novel_editor_admin_id,
      'chapter.novel_editor_name (原始值)': chapter.novel_editor_name,
      'chapter.novel_chief_editor_admin_id (原始值)': chapter.novel_chief_editor_admin_id,
      'chapter.novel_chief_editor_name (原始值)': chapter.novel_chief_editor_name,
      '提取后的novelEditorAdminId': novelEditorAdminId,
      '提取后的novelEditorName': novelEditorName,
      '提取后的novelChiefEditorAdminId': novelChiefEditorAdminId,
      '提取后的novelChiefEditorName': novelChiefEditorName
    });
    
    const responseData = {
        id: chapter.id,
        novel_id: chapter.novel_id,
        novel_title: chapter.novel_title,
        novel_cover: chapter.novel_cover,
        requires_chief_edit: requiresChiefEdit,
        can_review: canReview,
        volume_id: chapter.volume_id,
        volume_name: chapter.volume_name || `第${chapter.volume_number}卷`,
        volume_number: chapter.volume_number,
        chapter_number: chapter.chapter_number,
        title: chapter.title || `第${chapter.chapter_number}章`,
        content: chapter.content,
        translator_note: chapter.translator_note,
        word_count: parseInt(chapter.word_count || 0),
        author: chapter.author_name || chapter.author_pen_name || chapter.author,
        editor_admin_id: chapter.editor_admin_id,
        editor_name: chapter.chapter_editor_name || null,
        chief_editor_admin_id: chapter.chief_editor_admin_id,
        chief_editor_name: chapter.chapter_chief_editor_name || null,
        // 强制包含novel编辑字段，使用明确的值（参考章节列表API的实现）
        novel_editor_admin_id: novelEditorAdminId,
        novel_editor_name: novelEditorName,
        novel_chief_editor_admin_id: novelChiefEditorAdminId,
        novel_chief_editor_name: novelChiefEditorName,
        review_status: chapter.review_status,
        is_released: chapter.is_released === 1,
        is_advance: chapter.is_advance === 1,
        unlock_price: parseInt(chapter.unlock_price || 0),
        key_cost: parseInt(chapter.key_cost || 0),
        unlock_priority: chapter.unlock_priority || 'free',
        release_date: chapter.release_date,
        created_at: chapter.created_at,
        updated_at: chapter.updated_at
    };
    
    // 调试：检查responseData中的字段
    console.log('[章节详情调试] responseData中的novel编辑字段:', {
      'responseData.novel_editor_admin_id': responseData.novel_editor_admin_id,
      'responseData.novel_editor_name': responseData.novel_editor_name,
      'responseData.novel_chief_editor_admin_id': responseData.novel_chief_editor_admin_id,
      'responseData.novel_chief_editor_name': responseData.novel_chief_editor_name
    });
    
    console.log('[后端返回前] responseData中的字段:', {
      'novel_editor_admin_id': responseData.novel_editor_admin_id,
      'novel_editor_name': responseData.novel_editor_name,
      'novel_chief_editor_admin_id': responseData.novel_chief_editor_admin_id,
      'novel_chief_editor_name': responseData.novel_chief_editor_name
    });
    
    // 直接使用responseData，因为字段已经在上面强制包含了
    const finalData = {
      ...responseData,
      // 再次强制确保这些字段存在（双重保险）
      novel_editor_admin_id: responseData.novel_editor_admin_id ?? null,
      novel_editor_name: responseData.novel_editor_name ?? null,
      novel_chief_editor_admin_id: responseData.novel_chief_editor_admin_id ?? null,
      novel_chief_editor_name: responseData.novel_chief_editor_name ?? null
    };
    
    console.log('[后端返回前] finalData中的字段:', {
      'novel_editor_admin_id': finalData.novel_editor_admin_id,
      'novel_editor_name': finalData.novel_editor_name,
      'novel_chief_editor_admin_id': finalData.novel_chief_editor_admin_id,
      'novel_chief_editor_name': finalData.novel_chief_editor_name
    });
    
    console.log('[后端返回前] 最终发送的数据（JSON） - 仅novel编辑字段:', JSON.stringify({
      novel_editor_admin_id: finalData.novel_editor_admin_id,
      novel_editor_name: finalData.novel_editor_name,
      novel_chief_editor_admin_id: finalData.novel_chief_editor_admin_id,
      novel_chief_editor_name: finalData.novel_chief_editor_name
    }));
    
    // 调试：输出完整的finalData对象（仅关键字段，避免内容过长）
    console.log('[后端返回前] finalData对象的所有字段:', Object.keys(finalData));
    console.log('[后端返回前] finalData完整对象（JSON）:', JSON.stringify({
      ...finalData,
      content: finalData.content ? `[内容长度: ${finalData.content.length}字符]` : null
    }, null, 2));
    
    // 最终检查：确保novel编辑字段一定存在（防止任何意外情况）
    const finalResponse = {
      success: true,
      data: {
        ...finalData,
        // 最后一次强制确保这些字段存在
        novel_editor_admin_id: finalData.novel_editor_admin_id ?? null,
        novel_editor_name: finalData.novel_editor_name ?? null,
        novel_chief_editor_admin_id: finalData.novel_chief_editor_admin_id ?? null,
        novel_chief_editor_name: finalData.novel_chief_editor_name ?? null
      }
    };
    
    // 调试：检查最终响应中的字段
    console.log('[后端返回前] 最终响应data对象的所有字段:', Object.keys(finalResponse.data));
    console.log('[后端返回前] 最终响应中的novel编辑字段:', {
      'novel_editor_admin_id': finalResponse.data.novel_editor_admin_id,
      'novel_editor_name': finalResponse.data.novel_editor_name,
      'novel_chief_editor_admin_id': finalResponse.data.novel_chief_editor_admin_id,
      'novel_chief_editor_name': finalResponse.data.novel_chief_editor_name
    });
    
    res.json(finalResponse);
  } catch (error) {
    console.error('获取章节详情失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// 章节审核操作（使用Controller）
router.post('/chapter/review', authenticateAdmin, requireRole('super_admin', 'chief_editor', 'editor'), async (req, res) => {
  await chapterReviewController.reviewChapter(req, res);
});

// 批量审核章节（使用Controller）
router.post('/chapters/batch-review', authenticateAdmin, requireRole('super_admin', 'chief_editor', 'editor'), async (req, res) => {
  await chapterReviewController.batchReviewChapters(req, res);
});

// 审核章节
router.post('/review-chapter', authenticateAdmin, requireRole('super_admin', 'chief_editor', 'editor'), async (req, res) => {
  let db;
  try {
    const { chapterId, action, reason } = req.body;
    const adminId = req.admin.adminId;
    
    if (!chapterId || !action) {
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
    
    // 检查章节是否存在
    const [chapters] = await db.execute('SELECT * FROM chapter WHERE id = ?', [chapterId]);
    if (chapters.length === 0) {
      return res.status(404).json({ success: false, message: '章节不存在' });
    }
    
    const chapter = chapters[0];
    
    // 检查权限
    const hasPermission = await checkNovelPermission(
      db,
      adminId,
      req.admin.role,
      chapter.novel_id
    );
    
    if (!hasPermission) {
      return res.status(403).json({ success: false, message: '无权限审核此章节' });
    }
    
    // 检查章节状态
    if (!['submitted', 'reviewing'].includes(chapter.review_status)) {
      return res.status(400).json({
        success: false,
        message: '只能审核已提交或审核中的章节'
      });
    }
    
    // 更新状态
    if (action === 'approve') {
      await db.execute(
        'UPDATE chapter SET review_status = ?, is_released = 1, release_date = NOW() WHERE id = ?',
        ['approved', chapterId]
      );
    } else {
      // reject → locked
      // 检查是否有review_note字段，如果没有则添加
      const [columns] = await db.execute(
        `SELECT COLUMN_NAME 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'chapter' 
         AND COLUMN_NAME = 'review_note'`
      );
      
      if (columns.length > 0) {
        await db.execute(
          'UPDATE chapter SET review_status = ?, review_note = ? WHERE id = ?',
          ['locked', reason || '审核未通过', chapterId]
        );
      } else {
        await db.execute(
          'UPDATE chapter SET review_status = ? WHERE id = ?',
          ['locked', chapterId]
        );
      }
    }
    
    res.json({
      success: true,
      message: action === 'approve' ? '章节已批准' : '章节已拒绝',
      data: {
        chapterId,
        status: action === 'approve' ? 'approved' : 'locked'
      }
    });
  } catch (error) {
    console.error('审核章节失败:', error);
    res.status(500).json({ success: false, message: '操作失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// ==================== 编辑合同管理 ====================

// 获取小说的编辑合同列表
router.get('/novels/:novelId/editor-contracts', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { novelId } = req.params;
    db = await mysql.createConnection(dbConfig);
    
    // 检查权限
    const hasPermission = await checkNovelPermission(
      db,
      req.admin.adminId,
      req.admin.role,
      novelId
    );
    
    if (!hasPermission) {
      return res.status(403).json({ success: false, message: '无权限访问此小说的编辑合同' });
    }
    
    const [contracts] = await db.execute(
      `SELECT 
        nec.*,
        a.name as editor_name,
        a.role as editor_role
      FROM novel_editor_contract nec
      LEFT JOIN admin a ON nec.editor_admin_id = a.id
      WHERE nec.novel_id = ?
      ORDER BY nec.created_at DESC`,
      [novelId]
    );
    
    res.json({
      success: true,
      data: contracts
    });
  } catch (error) {
    console.error('获取编辑合同列表失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// 分配小说编辑（新接口路径，符合用户要求）
router.post('/novel/assign-editor', authenticateAdmin, requireRole('super_admin', 'chief_editor'), async (req, res) => {
  let db;
  try {
    const { novel_id, editor_admin_id } = req.body;
    
    if (!novel_id || !editor_admin_id) {
      return res.status(400).json({
        success: false,
        message: '小说ID和编辑ID必填'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    // 检查小说是否存在
    const [novels] = await db.execute('SELECT id, current_editor_admin_id FROM novel WHERE id = ?', [novel_id]);
    if (novels.length === 0) {
      return res.status(404).json({ success: false, message: '小说不存在' });
    }
    
    // 检查权限（只有 super_admin 和 chief_editor 可以分配编辑）
    if (req.admin.role === 'chief_editor') {
      const hasPermission = await checkNovelPermission(
        db,
        req.admin.adminId,
        req.admin.role,
        novel_id
      );
      
      if (!hasPermission) {
        return res.status(403).json({ success: false, message: '无权限为此小说分配编辑' });
      }
    }
    
    // 检查编辑是否存在且role为editor
    const [admins] = await db.execute(
      'SELECT id, name, role FROM admin WHERE id = ? AND role = ?',
      [editor_admin_id, 'editor']
    );
    if (admins.length === 0) {
      return res.status(404).json({ success: false, message: '编辑不存在或不是编辑角色' });
    }
    
    // 更新小说的当前编辑
    await db.execute(
      'UPDATE novel SET current_editor_admin_id = ? WHERE id = ?',
      [editor_admin_id, novel_id]
    );
    
    res.json({
      success: true,
      message: '编辑分配成功',
      data: {
        novel_id: parseInt(novel_id),
        editor_admin_id: parseInt(editor_admin_id)
      }
    });
  } catch (error) {
    console.error('分配编辑失败:', error);
    res.status(500).json({ success: false, message: '操作失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// 指定编辑（创建编辑合同，保留旧接口路径以兼容）
router.post('/novels/:novelId/assign-editor', authenticateAdmin, requireRole('super_admin', 'chief_editor', 'editor'), async (req, res) => {
  let db;
  try {
    const { novelId } = req.params;
    const { editor_admin_id, role, share_type, share_percent, start_date, end_date, start_chapter_id, end_chapter_id } = req.body;
    
    if (!editor_admin_id || !start_date) {
      return res.status(400).json({
        success: false,
        message: '编辑ID和开始日期必填'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    // 检查小说是否存在
    const [novels] = await db.execute('SELECT id, current_editor_admin_id FROM novel WHERE id = ?', [novelId]);
    if (novels.length === 0) {
      return res.status(404).json({ success: false, message: '小说不存在' });
    }
    
    // 检查权限（只有 super_admin 和 chief_editor 可以分配编辑）
    if (req.admin.role !== 'super_admin' && req.admin.role !== 'chief_editor') {
      return res.status(403).json({ success: false, message: '只有超级管理员和主编可以分配编辑' });
    }
    
    // 如果是 chief_editor，检查是否有权限管理此小说
    if (req.admin.role === 'chief_editor') {
      const hasPermission = await checkNovelPermission(
        db,
        req.admin.adminId,
        req.admin.role,
        req.admin.supervisor_admin_id,
        novelId
      );
      
      if (!hasPermission) {
        return res.status(403).json({ success: false, message: '无权限为此小说分配编辑' });
      }
    }
    
    // 检查编辑是否存在且role为editor
    const [admins] = await db.execute(
      'SELECT id, name, role FROM admin WHERE id = ? AND role IN ("editor", "super_admin")',
      [editor_admin_id]
    );
    if (admins.length === 0) {
      return res.status(404).json({ success: false, message: '编辑不存在或不是编辑角色' });
    }
    
    await db.beginTransaction();
    
    try {
      // 结束当前活跃的合同
      await db.execute(
        `UPDATE novel_editor_contract 
         SET end_date = NOW(), status = 'ended' 
         WHERE novel_id = ? AND status = 'active'`,
        [novelId]
      );
      
      // 创建新合同
      const [result] = await db.execute(
        `INSERT INTO novel_editor_contract 
         (novel_id, editor_admin_id, role, share_type, share_percent, start_date, end_date, start_chapter_id, end_chapter_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [
          novelId,
          editor_admin_id,
          role || 'editor',
          share_type || 'percent_of_book',
          share_percent || null,
          start_date,
          end_date || null,
          start_chapter_id || null,
          end_chapter_id || null
        ]
      );
      
      // 更新小说的当前编辑
      await db.execute(
        'UPDATE novel SET current_editor_admin_id = ? WHERE id = ?',
        [editor_admin_id, novelId]
      );
      
      await db.commit();
      
      res.json({
        success: true,
        message: '编辑指定成功',
        data: { contractId: result.insertId }
      });
    } catch (error) {
      await db.rollback();
      throw error;
    }
  } catch (error) {
    console.error('指定编辑失败:', error);
    res.status(500).json({ success: false, message: '操作失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// 结束编辑合同（统一调用 terminateContract）
router.post('/editor-contracts/:contractId/end', authenticateAdmin, requireRole('super_admin'), async (req, res) => {
  try {
    const result = await editorContractService.terminateContract(parseInt(req.params.contractId, 10));
    res.json({ 
      success: true, 
      message: '合同已结束',
      data: result 
    });
  } catch (error) {
    console.error('结束合同失败:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || '终止合同失败' 
    });
  }
});

// 获取所有编辑列表（用于下拉选择）
// ==================== 编辑管理 ====================

// 获取所有编辑列表（包含上级主编信息）
router.get('/list-editors', authenticateAdmin, async (req, res) => {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    const [editors] = await db.execute(
      `SELECT 
         id, 
         name, 
         role, 
         status
       FROM admin
       WHERE role = 'editor' AND status = 1
       ORDER BY name ASC`
    );
    
    res.json({
      success: true,
      data: editors.map(e => ({
        id: e.id,
        name: e.name,
        role: e.role,
        status: e.status
      }))
    });
  } catch (error) {
    console.error('获取编辑列表失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// 获取所有主编列表
router.get('/list-chief-editors', authenticateAdmin, async (req, res) => {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    const [chiefEditors] = await db.execute(
      `SELECT 
         id, 
         name, 
         role, 
         status
       FROM admin
       WHERE role = 'chief_editor' AND status = 1
       ORDER BY name ASC`
    );
    
    res.json({
      success: true,
      data: chiefEditors.map(e => ({
        id: e.id,
        name: e.name,
        role: e.role,
        status: e.status
      }))
    });
  } catch (error) {
    console.error('获取主编列表失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// 更新编辑的上级主管（新接口路径，符合用户要求）

router.get('/editors', authenticateAdmin, async (req, res) => {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    const [editors] = await db.execute(
      `SELECT id, name, role, status 
       FROM admin 
       WHERE role IN ('editor', 'chief_editor', 'super_admin') AND status = 1
       ORDER BY name ASC`
    );
    
    res.json({
      success: true,
      data: editors.map(e => ({
        id: e.id,
        name: e.name,
        role: e.role
      }))
    });
  } catch (error) {
    console.error('获取编辑列表失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// ==================== 编辑基础收入-4（基于 reader_spending）====================

const { generateEditorBaseIncomeForMonth } = require('../services/editorBaseIncomeService');

// 生成编辑基础收入
router.post('/editor-base-income/generate', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const admin = req.admin;
    if (!admin || (admin.role !== 'super_admin' && admin.role !== 'finance')) {
      return res.status(403).json({ 
        success: false, 
        message: '无权限，只有超级管理员或财务可以生成编辑基础收入' 
      });
    }

    const { month } = req.body; // 'YYYY-MM'
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ 
        success: false, 
        message: 'month 参数格式不正确，应为 YYYY-MM' 
      });
    }

    const result = await generateEditorBaseIncomeForMonth(month);

    return res.json({
      success: true,
      message: `编辑基础收入已生成：${month}`,
      data: result
    });
  } catch (error) {
    console.error('生成编辑基础收入失败:', error);
    return res.status(500).json({ 
      success: false, 
      message: '生成编辑基础收入失败', 
      error: error.message 
    });
  }
});

// 查询编辑基础收入列表
router.get('/editor-base-income', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { month, editorKeyword, novelKeyword, page = 1, pageSize = 50 } = req.query;
    
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ 
        success: false, 
        message: 'month 参数格式不正确，应为 YYYY-MM' 
      });
    }
    
    const settlementMonth = `${month}-01`;
    db = await mysql.createConnection(dbConfig);
    
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSizeNum = Math.max(1, Math.min(1000, parseInt(pageSize, 10) || 50));
    const offset = Math.max(0, (pageNum - 1) * pageSizeNum);

    // 动态构建 SQL 和参数
    let whereConditions = ['eim.month = ?'];
    let queryParams = [settlementMonth];
    
    // 编辑关键词过滤
    if (editorKeyword && typeof editorKeyword === 'string' && editorKeyword.trim()) {
      whereConditions.push('(a.name LIKE ? OR a.real_name LIKE ?)');
      const editorPattern = `%${editorKeyword.trim()}%`;
      queryParams.push(editorPattern, editorPattern);
    }
    
    // 小说关键词过滤
    if (novelKeyword && typeof novelKeyword === 'string' && novelKeyword.trim()) {
      whereConditions.push('n.title LIKE ?');
      queryParams.push(`%${novelKeyword.trim()}%`);
    }
    
    // 关联 admin, novel 方便前端展示编辑名和小说名
    // 注意：LIMIT 和 OFFSET 直接拼接，因为已经验证是安全的整数
    const sql = `SELECT
         eim.*,
         a.name AS editor_name,
         a.real_name AS editor_real_name,
         n.title AS novel_title
       FROM editor_income_monthly eim
       LEFT JOIN admin a ON eim.editor_admin_id = a.id
       LEFT JOIN novel n ON eim.novel_id = n.id
       WHERE ${whereConditions.join(' AND ')}
       ORDER BY eim.editor_admin_id, eim.novel_id, eim.source_type, eim.role, eim.source_spend_id
       LIMIT ${pageSizeNum} OFFSET ${offset}`;
    
    const [rows] = await db.execute(sql, queryParams);

    // 计算汇总统计
    const [statsRows] = await db.execute(
      `SELECT
         COUNT(*) AS total_records,
         COALESCE(SUM(eim.editor_income_usd), 0) AS total_editor_income_usd,
         COUNT(DISTINCT eim.editor_admin_id) AS editor_count,
         COUNT(DISTINCT eim.novel_id) AS novel_count
       FROM editor_income_monthly eim
       WHERE eim.month = ?`,
      [settlementMonth]
    );
    
    const stats = statsRows[0] || {
      total_records: 0,
      total_editor_income_usd: 0,
      editor_count: 0,
      novel_count: 0
    };

    return res.json({
      success: true,
      data: rows,
      stats
    });
  } catch (error) {
    console.error('查询编辑基础收入失败:', error);
    return res.status(500).json({ 
      success: false, 
      message: '查询编辑基础收入失败', 
      error: error.message 
    });
  } finally {
    if (db) await db.end();
  }
});

// 删除当月编辑基础收入
router.delete('/editor-base-income', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const admin = req.admin;
    if (!admin || (admin.role !== 'super_admin' && admin.role !== 'finance')) {
      return res.status(403).json({ 
        success: false, 
        message: '无权限，只有超级管理员或财务可以删除编辑基础收入' 
      });
    }

    const { month } = req.query;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ 
        success: false, 
        message: 'month 参数格式不正确，应为 YYYY-MM' 
      });
    }
    
    const settlementMonth = `${month}-01`;
    db = await mysql.createConnection(dbConfig);

    const [result] = await db.execute(
      `DELETE FROM editor_income_monthly WHERE month = ?`,
      [settlementMonth]
    );

    return res.json({
      success: true,
      message: `已删除 ${month} 的编辑基础收入记录`,
      data: {
        deleted: result.affectedRows || 0
      }
    });
  } catch (error) {
    console.error('删除编辑基础收入失败:', error);
    return res.status(500).json({ 
      success: false, 
      message: '删除编辑基础收入失败', 
      error: error.message 
    });
  } finally {
    if (db) await db.end();
  }
});

// ==================== 编辑收入计算（旧逻辑，基于 novel_income_monthly）====================

// 计算单本小说的 Champion 收入分配
router.post('/editor-income/calculate-champion', authenticateAdmin, requireRole('super_admin', 'finance'), async (req, res) => {
  try {
    const { novel_id, month } = req.body;

    if (!novel_id || !month) {
      return res.status(400).json({
        success: false,
        message: '小说ID和月份必填'
      });
    }

    const result = await editorIncomeService.calculateChampionIncomeForNovel(
      parseInt(novel_id),
      month
    );

    res.json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('计算 Champion 收入分配失败:', error);
    res.status(500).json({
      success: false,
      message: '计算失败',
      error: error.message
    });
  }
});

// 批量计算多本小说的 Champion 收入分配
router.post('/editor-income/batch-calculate-champion', authenticateAdmin, requireRole('super_admin', 'finance'), async (req, res) => {
  try {
    const { novel_ids, month } = req.body;

    if (!novel_ids || !Array.isArray(novel_ids) || novel_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: '小说ID列表必填'
      });
    }

    if (!month) {
      return res.status(400).json({
        success: false,
        message: '月份必填'
      });
    }

    const result = await editorIncomeService.calculateChampionIncomeForNovels(
      novel_ids.map(id => parseInt(id)),
      month
    );

    res.json({
      success: true,
      message: `已处理 ${result.total} 本小说，成功 ${result.success.length} 本，失败 ${result.failed.length} 本`,
      data: result
    });
  } catch (error) {
    console.error('批量计算 Champion 收入分配失败:', error);
    res.status(500).json({
      success: false,
      message: '批量计算失败',
      error: error.message
    });
  }
});

// ============================================
// 管理员账号管理接口（仅 super_admin 可访问）
// ============================================

// 获取管理员列表（分页 + 筛选）
router.get('/admin-users', authenticateAdmin, requireRole('super_admin'), async (req, res) => {
  await adminUserController.getAdminList(req, res);
});

// 获取单个管理员详情
router.get('/admin-users/:id', authenticateAdmin, requireRole('super_admin'), async (req, res) => {
  await adminUserController.getAdminById(req, res);
});

// 创建新管理员
router.post('/admin-users', authenticateAdmin, requireRole('super_admin'), async (req, res) => {
  await adminUserController.createAdmin(req, res);
});

// 更新管理员
router.put('/admin-users/:id', authenticateAdmin, requireRole('super_admin'), async (req, res) => {
  await adminUserController.updateAdmin(req, res);
});

// 更新管理员状态（启用/禁用）
router.patch('/admin-users/:id/status', authenticateAdmin, requireRole('super_admin'), async (req, res) => {
  await adminUserController.updateAdminStatus(req, res);
});

// ============================================
// 编辑合同管理接口（仅 super_admin 可访问）
// ============================================

// 获取合同列表（分页 + 筛选 + 排序）
router.get('/editor-contracts', authenticateAdmin, requireRole('super_admin'), async (req, res) => {
  try {
    const result = await editorContractService.getContractList(req.query);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('获取合同列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取合同列表失败',
      error: error.message
    });
  }
});

// 检查是否存在活跃合同（用于前端校验）
router.get('/editor-contracts/check-active', authenticateAdmin, requireRole('super_admin'), async (req, res) => {
  try {
    const { novel_id, role } = req.query;
    if (!novel_id || !role) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数：novel_id 和 role'
      });
    }
    
    const db = await mysql.createConnection(dbConfig);
    try {
      const [rows] = await db.execute(
        'SELECT id FROM novel_editor_contract WHERE novel_id = ? AND role = ? AND status = ?',
        [novel_id, role, 'active']
      );
      
      res.json({
        success: true,
        data: {
          hasActive: rows.length > 0,
          contractId: rows.length > 0 ? rows[0].id : null
        }
      });
    } finally {
      await db.end();
    }
  } catch (error) {
    console.error('检查活跃合同失败:', error);
    res.status(500).json({
      success: false,
      message: '检查活跃合同失败',
      error: error.message
    });
  }
});

// 获取单个合同详情
router.get('/editor-contracts/:id', authenticateAdmin, requireRole('super_admin'), async (req, res) => {
  try {
    const contract = await editorContractService.getContractById(parseInt(req.params.id));
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: '合同不存在'
      });
    }
    res.json({
      success: true,
      data: contract
    });
  } catch (error) {
    console.error('获取合同详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取合同详情失败',
      error: error.message
    });
  }
});

// 创建新合同
router.post('/editor-contracts', authenticateAdmin, requireRole('super_admin'), async (req, res) => {
  try {
    const contract = await editorContractService.createContract(req.body);
    res.json({
      success: true,
      message: '创建成功',
      data: contract
    });
  } catch (error) {
    console.error('创建合同失败:', error);
    // 检查是否是冲突错误，返回友好的错误信息
    const errorMessage = error.message || '创建合同失败';
    if (errorMessage.includes('已有有效的') || errorMessage.includes('请先结束旧合同')) {
      res.status(400).json({
        success: false,
        message: '当前已有有效的编辑合同，请先结束旧合同',
        error: errorMessage
      });
    } else {
      res.status(500).json({
        success: false,
        message: '创建合同失败',
        error: errorMessage
      });
    }
  }
});

// 更新合同
router.put('/editor-contracts/:id', authenticateAdmin, requireRole('super_admin'), async (req, res) => {
  try {
    const contract = await editorContractService.updateContract(parseInt(req.params.id), req.body);
    res.json({
      success: true,
      message: '更新成功',
      data: contract
    });
  } catch (error) {
    console.error('更新合同失败:', error);
    res.status(500).json({
      success: false,
      message: '更新合同失败',
      error: error.message
    });
  }
});

// 终止合同
router.patch('/editor-contracts/:id/terminate', authenticateAdmin, requireRole('super_admin'), async (req, res) => {
  try {
    const contract = await editorContractService.terminateContract(parseInt(req.params.id));
    res.json({
      success: true,
      message: '合同已终止',
      data: contract
    });
  } catch (error) {
    console.error('终止合同失败:', error);
    res.status(500).json({
      success: false,
      message: '终止合同失败',
      error: error.message
    });
  }
});

// ============================================
// 小说合同审批接口（仅 super_admin 可访问）
// ============================================

// 获取小说列表（用于合同审批）
router.get('/novels-for-contract-approval', authenticateAdmin, requireRole('super_admin'), async (req, res) => {
  try {
    const result = await novelContractApprovalService.getNovelListForApproval(req.query);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('获取小说列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取小说列表失败',
      error: error.message
    });
  }
});

// 获取某本小说的编辑分配信息（用于弹窗）
router.get('/novels/:id/editor-assignment', authenticateAdmin, requireRole('super_admin'), async (req, res) => {
  try {
    const result = await novelContractApprovalService.getEditorAssignment(parseInt(req.params.id));
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('获取编辑分配信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取编辑分配信息失败',
      error: error.message
    });
  }
});

// 保存编辑分配（完善版，包含合同维护）
router.post('/novels/:id/editor-assignment', authenticateAdmin, requireRole('super_admin'), async (req, res) => {
  try {
    const { chief_editor_admin_id, current_editor_admin_id } = req.body;
    await novelContractApprovalService.saveEditorAssignment(
      parseInt(req.params.id),
      {
        chief_editor_admin_id: chief_editor_admin_id || null,
        current_editor_admin_id: current_editor_admin_id || null
      }
    );
    res.json({
      success: true,
      message: '编辑分配已更新'
    });
  } catch (error) {
    console.error('保存编辑分配失败:', error);
    res.status(500).json({
      success: false,
      message: '保存编辑分配失败',
      error: error.message
    });
  }
});

// 分配编辑给小说（保留旧接口以兼容）
router.post('/novels/:id/assign-editor', authenticateAdmin, requireRole('super_admin'), async (req, res) => {
  try {
    const { current_editor_admin_id, chief_editor_admin_id } = req.body;
    await novelContractApprovalService.saveEditorAssignment(
      parseInt(req.params.id),
      {
        chief_editor_admin_id: chief_editor_admin_id || null,
        current_editor_admin_id: current_editor_admin_id || null
      }
    );
    res.json({
      success: true,
      message: '分配成功'
    });
  } catch (error) {
    console.error('分配编辑失败:', error);
    res.status(500).json({
      success: false,
      message: '分配编辑失败',
      error: error.message
    });
  }
});

// 获取某小说的所有编辑申请
router.get('/novels/:id/applications', authenticateAdmin, requireRole('super_admin'), async (req, res) => {
  try {
    const applications = await editorApplicationService.getApplicationsByNovelId(parseInt(req.params.id));
    res.json({
      success: true,
      data: applications
    });
  } catch (error) {
    console.error('获取申请列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取申请列表失败',
      error: error.message
    });
  }
});

// 审批编辑申请
router.post('/editor-applications/:id/handle', authenticateAdmin, requireRole('super_admin'), async (req, res) => {
  try {
    const { action, role } = req.body; // action: 'approve' | 'reject', role: 'editor' | 'chief_editor'
    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'action 参数无效'
      });
    }
    
    await editorApplicationService.handleApplication(
      parseInt(req.params.id),
      req.admin.adminId,
      action,
      role || 'editor'
    );
    
    res.json({
      success: true,
      message: action === 'approve' ? '申请已通过' : '申请已拒绝'
    });
  } catch (error) {
    console.error('审批申请失败:', error);
    res.status(500).json({
      success: false,
      message: '审批申请失败',
      error: error.message
    });
  }
});

// ============================================
// 新小说池接口
// ============================================

// 获取新小说池列表（新申请、审核中、未分配编辑的小说）
// 所有编辑、总编、超管都可以访问
router.get('/new-novel-pool', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { status = 'all', keyword, page = 1, pageSize = 20 } = req.query;
    const currentAdminId = req.admin.adminId; // 当前登录的管理员ID
    
    db = await mysql.createConnection(dbConfig);
    
    // 构建基础查询条件：新申请、审核中、未分配编辑的小说
    // 注意：这里不应用权限过滤，所有编辑都可以看到新小说池
    const whereConditions = [
      "n.review_status IN ('created', 'submitted', 'reviewing')",
      "n.current_editor_admin_id IS NULL",
      "n.chief_editor_admin_id IS NULL"
    ];
    const queryParams = [];
    
    // 状态筛选
    if (status && status !== 'all') {
      whereConditions.push('n.review_status = ?');
      queryParams.push(status);
    }
    
    // 关键词搜索（小说名、作者名、ID）
    if (keyword) {
      whereConditions.push('(n.title LIKE ? OR n.author LIKE ? OR n.id = ?)');
      const keywordPattern = `%${keyword}%`;
      queryParams.push(keywordPattern, keywordPattern, keyword);
    }
    
    // 过滤掉有 active 编辑合同的小说
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';
    
    // 分页参数
    const pageNum = parseInt(page) || 1;
    const pageSizeNum = parseInt(pageSize) || 20;
    const offset = (pageNum - 1) * pageSizeNum;
    
    // 主查询：获取新小说池列表，并统计待审章节数量，同时查询当前用户的申请状态
    const listQuery = `
      SELECT 
        n.id,
        n.title,
        n.author,
        n.review_status,
        n.description,
        n.cover,
        n.created_at,
        MAX(u.username) as author_name,
        MAX(u.pen_name) as pen_name,
        (
          SELECT COUNT(*) 
          FROM chapter c 
          WHERE c.novel_id = n.id 
            AND c.review_status IN ('submitted', 'reviewing', 'pending_chief')
        ) as pending_chapter_count,
        GROUP_CONCAT(DISTINCT g.chinese_name ORDER BY g.id SEPARATOR ',') as genre_names,
        (
          SELECT status 
          FROM editor_novel_application 
          WHERE novel_id = n.id 
            AND editor_admin_id = ?
          ORDER BY created_at DESC 
          LIMIT 1
        ) as application_status
      FROM novel n
      LEFT JOIN user u ON n.user_id = u.id
      LEFT JOIN novel_genre_relation ngr ON n.id = ngr.novel_id
      LEFT JOIN genre g ON (ngr.genre_id_1 = g.id OR ngr.genre_id_2 = g.id)
      LEFT JOIN novel_editor_contract c ON c.novel_id = n.id AND c.status = 'active'
      ${whereClause}
        AND c.id IS NULL
      GROUP BY n.id
      ORDER BY n.created_at DESC
      LIMIT ${pageSizeNum} OFFSET ${offset}
    `;
    
    const allParams = [currentAdminId, ...queryParams];
    const [novels] = await db.execute(listQuery, allParams);
    
    // 获取总数
    const countQuery = `
      SELECT COUNT(DISTINCT n.id) as total
      FROM novel n
      LEFT JOIN novel_editor_contract c ON c.novel_id = n.id AND c.status = 'active'
      ${whereClause}
        AND c.id IS NULL
    `;
    const [countResult] = await db.execute(countQuery, queryParams);
    const total = countResult[0].total;
    
    // 处理标签数据和申请状态
    const processedNovels = novels.map(novel => {
      const genres = novel.genre_names ? novel.genre_names.split(',').filter(g => g && g !== 'null') : [];
      return {
        ...novel,
        genres: genres,
        pending_chapter_count: parseInt(novel.pending_chapter_count) || 0,
        application_status: novel.application_status || null // 当前用户的申请状态：pending/approved/rejected/cancelled 或 null
      };
    });
    
    res.json({
      success: true,
      data: {
        list: processedNovels,
        total: total,
        page: pageNum,
        pageSize: pageSizeNum
      }
    });
    
  } catch (error) {
    console.error('获取新小说池列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取新小说池列表失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取新小说池中某本小说的详情（包含待审章节列表）
router.get('/new-novel-pool/:novelId', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { novelId } = req.params;
    
    db = await mysql.createConnection(dbConfig);
    
    // 获取小说基本信息
    const [novels] = await db.execute(
      `SELECT 
        n.*,
        u.username as author_name,
        u.pen_name as author_pen_name,
        GROUP_CONCAT(DISTINCT g.chinese_name ORDER BY g.id SEPARATOR ',') as genre_names,
        GROUP_CONCAT(DISTINCT p.name ORDER BY p.created_at SEPARATOR ',') as protagonist_names
       FROM novel n
       LEFT JOIN user u ON n.user_id = u.id
       LEFT JOIN novel_genre_relation ngr ON n.id = ngr.novel_id
       LEFT JOIN genre g ON (ngr.genre_id_1 = g.id OR ngr.genre_id_2 = g.id)
       LEFT JOIN protagonist p ON n.id = p.novel_id
       WHERE n.id = ?
       GROUP BY n.id`,
      [novelId]
    );
    
    if (novels.length === 0) {
      return res.status(404).json({
        success: false,
        message: '小说不存在'
      });
    }
    
    const novel = novels[0];
    
    // 获取待审章节列表
    const [chapters] = await db.execute(
      `SELECT 
        c.id,
        c.novel_id,
        c.volume_id,
        c.chapter_number,
        c.title,
        c.word_count,
        c.review_status,
        c.created_at,
        v.title as volume_name
       FROM chapter c
       LEFT JOIN volume v ON c.volume_id = v.id
       WHERE c.novel_id = ? 
         AND c.review_status IN ('submitted', 'reviewing', 'pending_chief')
       ORDER BY c.chapter_number ASC, c.created_at ASC`,
      [novelId]
    );
    
    // 处理标签和主角数据
    const genres = novel.genre_names ? novel.genre_names.split(',').filter(g => g && g !== 'null') : [];
    const protagonists = novel.protagonist_names ? novel.protagonist_names.split(',').filter(p => p) : [];
    
    res.json({
      success: true,
      data: {
        novel: {
          ...novel,
          genres: genres,
          protagonists: protagonists,
          application_status: novel.application_status || null // 当前用户的申请状态
        },
        pendingChapters: chapters
      }
    });
    
  } catch (error) {
    console.error('获取新小说详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取新小说详情失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 申请成为新小说的责任编辑
router.post('/new-novel-pool/:novelId/apply-editor', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { novelId } = req.params;
    const { reason } = req.body;
    const editorAdminId = req.admin.adminId;
    
    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: '申请理由不能为空'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    // 校验小说是否仍然符合新小说池条件
    const [novels] = await db.execute(
      `SELECT id, review_status, current_editor_admin_id, chief_editor_admin_id
       FROM novel 
       WHERE id = ?`,
      [novelId]
    );
    
    if (novels.length === 0) {
      return res.status(404).json({
        success: false,
        message: '小说不存在'
      });
    }
    
    const novel = novels[0];
    
    // 检查小说是否仍然符合新小说池条件
    if (!['created', 'submitted', 'reviewing'].includes(novel.review_status)) {
      return res.status(400).json({
        success: false,
        message: '该小说已通过审核或状态已变更，无法申请'
      });
    }
    
    if (novel.current_editor_admin_id || novel.chief_editor_admin_id) {
      return res.status(400).json({
        success: false,
        message: '该小说已分配编辑，无法申请'
      });
    }
    
    // 检查是否已有 active 编辑合同
    const [contracts] = await db.execute(
      'SELECT id FROM novel_editor_contract WHERE novel_id = ? AND status = ?',
      [novelId, 'active']
    );
    
    if (contracts.length > 0) {
      return res.status(400).json({
        success: false,
        message: '该小说已有有效编辑合同，无法申请'
      });
    }
    
    // 检查是否已存在 pending 状态的申请
    const [existing] = await db.execute(
      'SELECT id FROM editor_novel_application WHERE novel_id = ? AND editor_admin_id = ? AND status = ?',
      [novelId, editorAdminId, 'pending']
    );
    
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: '你已申请过该小说的责任编辑，请等待审批'
      });
    }
    
    // 插入申请记录
    const [result] = await db.execute(
      'INSERT INTO editor_novel_application (novel_id, editor_admin_id, reason, status) VALUES (?, ?, ?, ?)',
      [novelId, editorAdminId, reason.trim(), 'pending']
    );
    
    res.json({
      success: true,
      message: '申请已提交，等待后台审批',
      data: {
        applicationId: result.insertId
      }
    });
    
  } catch (error) {
    console.error('提交编辑申请失败:', error);
    res.status(500).json({
      success: false,
      message: '提交申请失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// ==================== 编辑注册 + 邮箱验证 ====================

// 导入 admin 邮箱验证模块
const adminEmailVerification = require('./adminEmailVerification');
const { verifyAdminCode } = require('./adminEmailVerification');

// 注册 admin 邮箱验证路由
router.use('/email-verification', adminEmailVerification);

/**
 * 编辑注册接口
 * POST /api/admin/register-editor
 */
router.post('/register-editor', async (req, res) => {
  let db;
  try {
    const { name, email, password, confirmPassword, phone, real_name, verificationCode } = req.body;
    
    // 1. 基本校验
    if (!name || !email || !password || !verificationCode) {
      return res.status(400).json({
        success: false,
        message: '用户名、邮箱、密码和验证码不能为空'
      });
    }
    
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: '两次输入的密码不一致'
      });
    }
    
    // 2. 邮箱格式校验
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: '邮箱格式不正确'
      });
    }
    
    // 3. 验证验证码
    if (!verifyAdminCode(email, verificationCode)) {
      return res.status(400).json({
        success: false,
        message: '验证码错误或已过期'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    // 4. 检查 name 和 email 是否已存在
    const [existingAdmins] = await db.execute(
      'SELECT id FROM admin WHERE name = ? OR email = ?',
      [name, email]
    );
    
    if (existingAdmins.length > 0) {
      return res.status(400).json({
        success: false,
        message: '用户名或邮箱已被使用'
      });
    }
    
    // 5. 密码哈希
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 6. 插入 admin 记录
    await db.execute(
      `INSERT INTO admin (name, email, password, phone, real_name, role, level, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'editor', 1, 1, NOW())`,
      [name, email, hashedPassword, phone || null, real_name || null]
    );
    
    res.json({
      success: true,
      message: '注册成功，请使用该账号登录后台'
    });
    
  } catch (error) {
    console.error('编辑注册错误:', error);
    res.status(500).json({
      success: false,
      message: '注册失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// ==================== admin 收款账户管理接口 ====================

/**
 * 获取 admin 收款账户列表
 * GET /api/admin/payout-account/list
 */
router.get('/payout-account/list', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const adminId = req.admin.adminId;
    
    db = await mysql.createConnection(dbConfig);
    
    const [accounts] = await db.execute(
      'SELECT * FROM admin_payout_account WHERE admin_id = ? AND status = "active" ORDER BY is_default DESC, created_at DESC',
      [adminId]
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
          status: acc.status,
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

/**
 * 创建或更新 admin 收款账户
 * POST /api/admin/payout-account/save
 */
router.post('/payout-account/save', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const adminId = req.admin.adminId;
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
          'UPDATE admin_payout_account SET is_default = 0 WHERE admin_id = ?',
          [adminId]
        );
      }
      
      if (id) {
        // 更新现有账户
        await db.execute(
          `UPDATE admin_payout_account 
           SET method = ?, account_label = ?, account_data = ?, is_default = ?, updated_at = NOW()
           WHERE id = ? AND admin_id = ?`,
          [method, account_label, JSON.stringify(account_data), is_default ? 1 : 0, id, adminId]
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
          `INSERT INTO admin_payout_account (admin_id, method, account_label, account_data, is_default, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
          [adminId, method, account_label, JSON.stringify(account_data), is_default ? 1 : 0]
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

/**
 * 删除 admin 收款账户
 * DELETE /api/admin/payout-account/:accountId
 */
router.delete('/payout-account/:accountId', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const adminId = req.admin.adminId;
    const accountId = parseInt(req.params.accountId);
    
    if (isNaN(accountId)) {
      return res.status(400).json({
        success: false,
        message: '账户ID无效'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    // 检查账户是否存在且属于当前 admin
    const [account] = await db.execute(
      'SELECT is_default FROM admin_payout_account WHERE id = ? AND admin_id = ? AND status = "active"',
      [accountId, adminId]
    );
    
    if (account.length === 0) {
      return res.status(404).json({
        success: false,
        message: '账户不存在'
      });
    }
    
    // 检查是否是唯一的默认账户
    if (account[0].is_default === 1) {
      const [otherAccounts] = await db.execute(
        'SELECT COUNT(*) as count FROM admin_payout_account WHERE admin_id = ? AND id != ? AND status = "active"',
        [adminId, accountId]
      );
      
      if (otherAccounts[0].count === 0) {
        return res.status(400).json({
          success: false,
          message: '不能删除唯一的默认账户，请先添加其他账户'
        });
      }
    }
    
    // 物理删除（和 user 端保持一致）
    await db.execute(
      'DELETE FROM admin_payout_account WHERE id = ? AND admin_id = ?',
      [accountId, adminId]
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

/**
 * 设置默认 admin 收款账户
 * PUT /api/admin/payout-account/:accountId/set-default
 */
router.put('/payout-account/:accountId/set-default', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const adminId = req.admin.adminId;
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
      // 检查账户是否存在且属于当前 admin
      const [account] = await db.execute(
        'SELECT id FROM admin_payout_account WHERE id = ? AND admin_id = ? AND status = "active"',
        [accountId, adminId]
      );
      
      if (account.length === 0) {
        await db.rollback();
        return res.status(404).json({
          success: false,
          message: '账户不存在'
        });
      }
      
      // 取消其他默认账户
      await db.execute(
        'UPDATE admin_payout_account SET is_default = 0 WHERE admin_id = ?',
        [adminId]
      );
      
      // 设置当前账户为默认
      await db.execute(
        'UPDATE admin_payout_account SET is_default = 1 WHERE id = ? AND admin_id = ?',
        [accountId, adminId]
      );
      
      await db.commit();
      
      res.json({
        success: true,
        message: '已设置为默认账户'
      });
    } catch (error) {
      await db.rollback();
      throw error;
    }
  } catch (error) {
    console.error('设置默认账户错误:', error);
    res.status(500).json({
      success: false,
      message: '设置失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// ========== 编辑收入相关接口（管理员查看自己的收入） ==========

// 工具函数：解析月份格式
function parseMonthForEditor(month) {
  if (!month) return null;
  if (month.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return month;
  }
  if (month.match(/^\d{4}-\d{2}$/)) {
    return `${month}-01`;
  }
  return month;
}

// 获取编辑参与的作品列表
router.get('/editor-income/novels', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const adminId = req.admin.adminId;
    db = await mysql.createConnection(dbConfig);
    
    // 查询该编辑参与的所有作品（从editor_income_monthly或chapter表）
    const [novels] = await db.execute(
      `SELECT DISTINCT n.id, n.title
       FROM novel n
       INNER JOIN chapter c ON c.novel_id = n.id
       WHERE (c.editor_admin_id = ? OR c.chief_editor_admin_id = ?)
       ORDER BY n.title`,
      [adminId, adminId]
    );
    
    res.json({
      success: true,
      data: novels
    });
  } catch (error) {
    console.error('获取编辑作品列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取编辑收入汇总
router.get('/editor-income/summary', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const adminId = req.admin.adminId;
    const { month, novel_id, role } = req.query;
    
    if (!month) {
      return res.status(400).json({
        success: false,
        message: '请指定月份（格式：2025-10-01）'
      });
    }
    
    const monthStart = parseMonthForEditor(month);
    if (!monthStart) {
      return res.status(400).json({
        success: false,
        message: '月份格式错误'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    // 构建查询条件
    let whereClause = 'editor_admin_id = ? AND month = ?';
    const params = [adminId, monthStart];
    
    if (novel_id && novel_id !== 'all') {
      whereClause += ' AND novel_id = ?';
      params.push(parseInt(novel_id));
    }
    
    if (role && role !== 'all') {
      whereClause += ' AND role = ?';
      params.push(role);
    }
    
    // 查询总收入
    const [totalResult] = await db.execute(
      `SELECT 
        COALESCE(SUM(editor_income_usd), 0) as total_income_usd,
        COALESCE(SUM(CASE WHEN role = 'chief_editor' THEN editor_income_usd ELSE 0 END), 0) as chief_editor_income_usd,
        COALESCE(SUM(CASE WHEN role = 'editor' THEN editor_income_usd ELSE 0 END), 0) as editor_income_usd,
        COUNT(DISTINCT novel_id) as novel_count
       FROM editor_income_monthly
       WHERE ${whereClause}`,
      params
    );
    
    const result = totalResult[0];
    
    res.json({
      success: true,
      data: {
        total_income_usd: parseFloat(result.total_income_usd || 0),
        chief_editor_income_usd: parseFloat(result.chief_editor_income_usd || 0),
        editor_income_usd: parseFloat(result.editor_income_usd || 0),
        novel_count: parseInt(result.novel_count || 0)
      }
    });
  } catch (error) {
    console.error('获取编辑收入汇总错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 按作品汇总编辑收入
router.get('/editor-income/by-novel', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const adminId = req.admin.adminId;
    const { month, role } = req.query;
    
    if (!month) {
      return res.status(400).json({
        success: false,
        message: '请指定月份'
      });
    }
    
    const monthStart = parseMonthForEditor(month);
    if (!monthStart) {
      return res.status(400).json({
        success: false,
        message: '月份格式错误'
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    // 构建查询条件
    let whereClause = 'eim.editor_admin_id = ? AND eim.month = ?';
    const params = [adminId, monthStart];
    
    if (role && role !== 'all') {
      whereClause += ' AND eim.role = ?';
      params.push(role);
    }
    
    // 查询按作品汇总的收入，并关联结算状态
    const [results] = await db.execute(
      `SELECT 
        eim.novel_id,
        n.title as novel_title,
        eim.role,
        SUM(eim.editor_income_usd) as income_usd,
        COALESCE(esm.payout_status, 'unpaid') as payout_status
       FROM editor_income_monthly eim
       LEFT JOIN novel n ON eim.novel_id = n.id
       LEFT JOIN editor_settlement_monthly esm ON 
         esm.editor_admin_id = eim.editor_admin_id 
         AND esm.role = eim.role 
         AND esm.month = eim.month
       WHERE ${whereClause}
       GROUP BY eim.novel_id, eim.role, n.title, esm.payout_status
       ORDER BY n.title, eim.role`,
      params
    );
    
    res.json({
      success: true,
      data: results.map(row => ({
        novel_id: row.novel_id,
        novel_title: row.novel_title,
        role: row.role,
        income_usd: parseFloat(row.income_usd || 0),
        payout_status: row.payout_status
      }))
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

// 获取编辑收入明细
router.get('/editor-income/details', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const adminId = req.admin.adminId;
    const { month, novel_id, role, page = 1, pageSize = 20 } = req.query;
    
    if (!month) {
      return res.status(400).json({
        success: false,
        message: '请指定月份'
      });
    }
    
    const monthStart = parseMonthForEditor(month);
    if (!monthStart) {
      return res.status(400).json({
        success: false,
        message: '月份格式错误'
      });
    }
    
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSizeNum = Math.max(1, Math.min(100, parseInt(pageSize) || 20));
    const offset = (pageNum - 1) * pageSizeNum;
    
    db = await mysql.createConnection(dbConfig);
    
    // 构建查询条件
    let whereClause = 'eim.editor_admin_id = ? AND eim.month = ?';
    const params = [adminId, monthStart];
    
    if (novel_id && novel_id !== 'all') {
      whereClause += ' AND eim.novel_id = ?';
      params.push(parseInt(novel_id));
    }
    
    if (role && role !== 'all') {
      whereClause += ' AND eim.role = ?';
      params.push(role);
    }
    
    // 查询明细
    const [details] = await db.query(
      `SELECT 
        eim.id,
        eim.created_at as time,
        n.title as novel_title,
        eim.role,
        eim.source_type,
        eim.editor_income_usd as income_usd
       FROM editor_income_monthly eim
       LEFT JOIN novel n ON eim.novel_id = n.id
       WHERE ${whereClause}
       ORDER BY eim.created_at DESC
       LIMIT ${pageSizeNum} OFFSET ${offset}`,
      params
    );
    
    // 查询总数
    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total
       FROM editor_income_monthly eim
       WHERE ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    
    res.json({
      success: true,
      data: details.map(row => ({
        id: row.id,
        time: row.time,
        novel_title: row.novel_title,
        role: row.role,
        source_type: row.source_type,
        income_usd: parseFloat(row.income_usd || 0)
      })),
      pagination: {
        page: pageNum,
        pageSize: pageSizeNum,
        total: total,
        totalPages: Math.ceil(total / pageSizeNum)
      }
    });
  } catch (error) {
    console.error('获取编辑收入明细错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取编辑月度结算列表（管理员查看自己的）
router.get('/editor-settlement/monthly', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const adminId = req.admin.adminId;
    const { limit = 12 } = req.query;
    
    const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 12));
    
    db = await mysql.createConnection(dbConfig);
    
    const [rows] = await db.query(
      `SELECT 
        esm.month,
        esm.novel_count,
        esm.record_count,
        esm.total_income_usd,
        esm.payout_status,
        esm.payout_id,
        ep.payout_currency,
        ep.payout_amount,
        CASE 
          WHEN esm.payout_status = 'paid' THEN 0
          ELSE esm.total_income_usd
        END as unpaid_amount
       FROM editor_settlement_monthly esm
       LEFT JOIN editor_payout ep ON esm.payout_id = ep.id
       WHERE esm.editor_admin_id = ?
       ORDER BY esm.month DESC
       LIMIT ${limitNum}`,
      [adminId]
    );
    
    res.json({
      success: true,
      data: rows.map(row => ({
        month: row.month,
        novel_count: parseInt(row.novel_count || 0),
        record_count: parseInt(row.record_count || 0),
        total_income_usd: parseFloat(row.total_income_usd || 0),
        paid_amount_usd: parseFloat(row.total_income_usd || 0) - parseFloat(row.unpaid_amount || 0),
        unpaid_amount: parseFloat(row.unpaid_amount || 0),
        payout_status: row.payout_status,
        payout_currency: row.payout_currency || null,
        payout_amount: row.payout_amount ? parseFloat(row.payout_amount) : null
      }))
    });
  } catch (error) {
    console.error('获取编辑月度结算列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取编辑支付记录列表（管理员查看自己的）
router.get('/editor-payout/list', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const adminId = req.admin.adminId;
    const { page = 1, pageSize = 20 } = req.query;
    
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSizeNum = Math.max(1, Math.min(100, parseInt(pageSize) || 20));
    const offset = (pageNum - 1) * pageSizeNum;
    
    db = await mysql.createConnection(dbConfig);
    
    const [payouts] = await db.query(
      `SELECT 
        ep.*,
        esm.total_income_usd,
        pgt.provider_tx_id,
        pgt.provider as gateway_provider
       FROM editor_payout ep
       LEFT JOIN editor_settlement_monthly esm ON ep.settlement_monthly_id = esm.id
       LEFT JOIN payout_gateway_transaction pgt ON ep.gateway_tx_id = pgt.id
       WHERE ep.editor_admin_id = ?
       ORDER BY ep.month DESC, ep.created_at DESC
       LIMIT ${pageSizeNum} OFFSET ${offset}`,
      [adminId]
    );
    
    const [countResult] = await db.execute(
      'SELECT COUNT(*) as total FROM editor_payout WHERE editor_admin_id = ?',
      [adminId]
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
          total_income_usd: parseFloat(row.total_income_usd || 0),
          base_amount_usd: parseFloat(row.base_amount_usd || 0),
          payout_currency: row.payout_currency || 'USD',
          payout_amount: parseFloat(row.payout_amount || 0),
          method: row.method,
          account_label: accountLabel,
          account_data: accountData,
          provider_tx_id: row.provider_tx_id || null,
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
    console.error('获取编辑支付记录列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取编辑支付记录详情（管理员查看自己的）
router.get('/editor-payout/detail/:payoutId', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const adminId = req.admin.adminId;
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
      'SELECT * FROM editor_payout WHERE id = ? AND editor_admin_id = ?',
      [payoutId, adminId]
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
    
    // 安全解析 JSON 的辅助函数（处理字符串和对象两种情况）
    const safeParseJSON = (value, defaultValue = null) => {
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
        payout: {
          id: payout.id,
          month: payout.month,
          settlement_monthly_id: payout.settlement_monthly_id,
          base_amount_usd: parseFloat(payout.base_amount_usd || 0),
          payout_currency: payout.payout_currency || 'USD',
          payout_amount: parseFloat(payout.payout_amount || 0),
          fx_rate: parseFloat(payout.fx_rate || 1.0),
          status: payout.status,
          method: payout.method,
          account_info: safeParseJSON(payout.account_info, null),
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
          request_payload: safeParseJSON(gatewayTx.request_payload, null),
          response_payload: safeParseJSON(gatewayTx.response_payload, null),
          error_code: gatewayTx.error_code,
          error_message: gatewayTx.error_message,
          created_at: gatewayTx.created_at,
          updated_at: gatewayTx.updated_at
        } : null
      }
    });
  } catch (error) {
    console.error('获取编辑支付记录详情错误:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// ==================== 我的合同管理 ====================

// 获取当前登录编辑的合同统计
router.get('/my-contracts/summary', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const adminId = req.admin.adminId;
    db = await mysql.createConnection(dbConfig);
    
    const [stats] = await db.execute(
      `SELECT 
        COUNT(*) as total_count,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN status = 'ended' THEN 1 ELSE 0 END) as ended_count,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
        COUNT(DISTINCT novel_id) as novel_count
       FROM novel_editor_contract
       WHERE editor_admin_id = ?`,
      [adminId]
    );
    
    res.json({
      success: true,
      data: {
        total_count: parseInt(stats[0].total_count) || 0,
        active_count: parseInt(stats[0].active_count) || 0,
        ended_count: parseInt(stats[0].ended_count) || 0,
        cancelled_count: parseInt(stats[0].cancelled_count) || 0,
        novel_count: parseInt(stats[0].novel_count) || 0
      }
    });
  } catch (error) {
    console.error('获取合同统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取合同统计失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取当前登录编辑的合同列表（分页 + 筛选 + 排序）
router.get('/my-contracts', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const adminId = req.admin.adminId;
    const { 
      page = 1, 
      pageSize = 20,
      novel_id,
      role,
      status,
      sortField = 'created_at',
      sortOrder = 'DESC'
    } = req.query;
    
    db = await mysql.createConnection(dbConfig);
    
    // 构建WHERE条件
    const whereConditions = ['c.editor_admin_id = ?'];
    const queryParams = [adminId];
    
    if (novel_id) {
      whereConditions.push('c.novel_id = ?');
      queryParams.push(novel_id);
    }
    
    if (role) {
      whereConditions.push('c.role = ?');
      queryParams.push(role);
    }
    
    if (status) {
      whereConditions.push('c.status = ?');
      queryParams.push(status);
    }
    
    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    
    // 验证排序字段（防止SQL注入）
    const allowedSortFields = ['created_at', 'start_date', 'status', 'share_percent'];
    const safeSortField = allowedSortFields.includes(sortField) ? sortField : 'created_at';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    // 获取总数
    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total 
       FROM novel_editor_contract c
       ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult[0].total) || 0;
    
    // 获取列表数据
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSizeNum = Math.max(1, Math.min(100, parseInt(pageSize) || 20));
    const offset = (pageNum - 1) * pageSizeNum;
    
    // LIMIT 和 OFFSET 不能使用参数占位符，需要直接拼接（已通过 parseInt 和 Math.max/Math.min 验证，安全）
    const [rows] = await db.execute(
      `SELECT 
        c.id,
        c.novel_id,
        n.title AS novel_title,
        c.editor_admin_id,
        c.role,
        c.share_type,
        c.share_percent,
        c.start_chapter_id,
        c.end_chapter_id,
        c.start_date,
        c.end_date,
        c.status,
        c.created_at,
        c.updated_at
       FROM novel_editor_contract c
       LEFT JOIN novel n ON c.novel_id = n.id
       ${whereClause}
       ORDER BY c.${safeSortField} ${safeSortOrder}
       LIMIT ${pageSizeNum} OFFSET ${offset}`,
      queryParams
    );
    
    res.json({
      success: true,
      data: {
        list: rows,
        total,
        page: pageNum,
        pageSize: pageSizeNum
      }
    });
  } catch (error) {
    console.error('获取合同列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取合同列表失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// ==================== 菜单权限管理相关接口 ====================

// 定义所有受权限控制的菜单 key（前后端需保持一致）
const ALL_MENU_KEYS = [
  // group keys
  'group:income-editor',
  // income & editor group items
  'payment-stats',
  'author-income',
  'reader-income',
  'settlement-overview',
  'base-income',
  'author-royalty',
  'commission-transaction',
  'editor-base-income',
  'commission-settings',
  'editor-management',
  // 顶部独立菜单
  'novel-review',
  'new-novel-pool',
  'chapter-approval',
  // 底部独立菜单
  'admin-payout-account',
];

// 获取当前登录管理员可见菜单 key 列表
router.get('/menu-permissions/my', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const role = req.admin.role;
    
    db = await mysql.createConnection(dbConfig);
    const adminMenuPermissionService = new AdminMenuPermissionService(dbConfig);
    
    const allowedKeys = await adminMenuPermissionService.getAdminAllowedMenuKeys(db, role, ALL_MENU_KEYS);
    
    res.json({
      success: true,
      data: {
        role,
        allowedMenuKeys: allowedKeys
      }
    });
  } catch (error) {
    console.error('获取当前管理员菜单权限失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取菜单权限失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取某个角色的菜单权限配置（用于「账号权限管理」页面）
// 只有 super_admin 可以查看和配置
router.get('/menu-permissions/role/:role', authenticateAdmin, requireRole('super_admin'), async (req, res) => {
  let db;
  try {
    const { role } = req.params;
    const validRoles = ['chief_editor', 'editor', 'finance', 'operator'];
    
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        success: false, 
        message: '不支持的角色类型' 
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    const adminMenuPermissionService = new AdminMenuPermissionService(dbConfig);
    
    const rolePermissions = await adminMenuPermissionService.getRoleMenuPermissions(db, role);
    
    res.json({
      success: true,
      data: {
        role,
        allMenuKeys: ALL_MENU_KEYS,
        permissions: rolePermissions
      }
    });
  } catch (error) {
    console.error('获取角色菜单权限失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取角色菜单权限失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 保存某个角色的菜单权限配置
// body: { permissions: { [menuKey: string]: boolean } }
router.post('/menu-permissions/role/:role', authenticateAdmin, requireRole('super_admin'), async (req, res) => {
  let db;
  try {
    const { role } = req.params;
    const { permissions } = req.body || {};
    
    const validRoles = ['chief_editor', 'editor', 'finance', 'operator'];
    
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        success: false, 
        message: '不支持的角色类型' 
      });
    }
    
    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({ 
        success: false, 
        message: 'permissions 数据格式错误' 
      });
    }
    
    db = await mysql.createConnection(dbConfig);
    const adminMenuPermissionService = new AdminMenuPermissionService(dbConfig);
    
    await adminMenuPermissionService.saveRoleMenuPermissions(db, role, permissions);
    
    res.json({ 
      success: true, 
      message: '菜单权限保存成功' 
    });
  } catch (error) {
    console.error('保存角色菜单权限失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '保存菜单权限失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

module.exports = router;

