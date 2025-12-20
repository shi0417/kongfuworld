const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

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

    req.userId = userId;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: '身份验证失败' });
  }
};

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/inbox');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|rar/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  }
});

// 检查用户是否为会话参与者
const checkParticipant = async (db, conversationId, userId) => {
  const [rows] = await db.execute(
    'SELECT id FROM conversation_participants WHERE conversation_id = ? AND user_id = ? AND (left_at IS NULL OR left_at > NOW())',
    [conversationId, userId]
  );
  return rows.length > 0;
};

// GET /api/writer/inbox/conversations - 获取会话列表
router.get('/conversations', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const userId = req.userId;
    const { tab = 'all', search = '', page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    db = await mysql.createConnection(dbConfig);
    
    let whereClause = `cp.user_id = ? AND (cp.left_at IS NULL OR cp.left_at > NOW())`;
    const params = [userId];
    
    // Tab过滤
    if (tab === 'unread') {
      whereClause += ` AND (cr.unread_count IS NULL OR cr.unread_count > 0)`;
    } else if (tab === 'in_progress') {
      whereClause += ` AND c.status = 'in_progress'`;
    } else if (tab === 'closed') {
      whereClause += ` AND c.status IN ('resolved', 'closed')`;
    }
    
    // 搜索
    if (search) {
      whereClause += ` AND c.subject LIKE ?`;
      params.push(`%${search}%`);
    }
    
    // 获取会话列表
    // LIMIT 和 OFFSET 需要直接插入数值，不能使用占位符（MySQL 兼容性问题）
    const limitValue = parseInt(limit);
    const offsetValue = parseInt(offset);
    const [conversations] = await db.execute(
      `SELECT 
        c.id,
        c.subject,
        c.category,
        c.status,
        c.priority,
        c.related_novel_id,
        c.created_at,
        c.updated_at,
        COALESCE(cr.unread_count, 0) as unread_count,
        cr.last_read_at,
        (
          SELECT content FROM messages m 
          WHERE m.conversation_id = c.id 
            AND m.internal_note = 0 
          ORDER BY m.created_at DESC 
          LIMIT 1
        ) as last_message_content,
        (
          SELECT created_at FROM messages m 
          WHERE m.conversation_id = c.id 
            AND m.internal_note = 0 
          ORDER BY m.created_at DESC 
          LIMIT 1
        ) as last_message_at,
        n.title as novel_title
      FROM conversations c
      INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
      LEFT JOIN conversation_reads cr ON c.id = cr.conversation_id AND cr.user_id = ?
      LEFT JOIN novel n ON c.related_novel_id = n.id
      WHERE ${whereClause}
      ORDER BY c.updated_at DESC
      LIMIT ${limitValue} OFFSET ${offsetValue}`,
      // 参数顺序：
      // 1) cr.user_id = ?
      // 2) whereClause 内 cp.user_id = ?（以及可选的 subject LIKE ?）
      [userId, ...params]
    );
    
    // 获取总数
    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total
      FROM conversations c
      INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
      LEFT JOIN conversation_reads cr ON c.id = cr.conversation_id AND cr.user_id = ?
      WHERE ${whereClause}`,
      [userId, ...params]
    );
    
    res.json({
      success: true,
      data: {
        conversations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countRows[0].total,
          totalPages: Math.ceil(countRows[0].total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('获取会话列表失败:', error);
    res.status(500).json({ success: false, message: '获取会话列表失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// POST /api/writer/inbox/conversations - 创建新会话
router.post('/conversations', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const userId = req.userId;
    const { subject, category = 'general', related_novel_id = null, content } = req.body;
    
    if (!subject || !content) {
      return res.status(400).json({ success: false, message: '主题和内容不能为空' });
    }
    
    db = await mysql.createConnection(dbConfig);
    await db.beginTransaction();
    
    try {
      // 创建会话
      const [result] = await db.execute(
        `INSERT INTO conversations (subject, category, status, created_by, related_novel_id)
         VALUES (?, ?, 'open', ?, ?)`,
        [subject, category, userId, related_novel_id]
      );
      
      const conversationId = result.insertId;
      
      // 添加参与者（作者）
      await db.execute(
        `INSERT INTO conversation_participants (conversation_id, user_id, role)
         VALUES (?, ?, 'author')`,
        [conversationId, userId]
      );
      
      // 创建第一条消息
      const [messageResult] = await db.execute(
        `INSERT INTO messages (conversation_id, sender_id, sender_type, content, internal_note)
         VALUES (?, ?, 'author', ?, 0)`,
        [conversationId, userId, content]
      );
      
      // 初始化已读状态
      await db.execute(
        `INSERT INTO conversation_reads (conversation_id, user_id, last_read_message_id, unread_count)
         VALUES (?, ?, ?, 0)`,
        [conversationId, userId, messageResult.insertId]
      );
      
      await db.commit();
      
      res.json({
        success: true,
        data: { conversationId, messageId: messageResult.insertId },
        message: '会话创建成功'
      });
    } catch (error) {
      await db.rollback();
      throw error;
    }
  } catch (error) {
    console.error('创建会话失败:', error);
    res.status(500).json({ success: false, message: '创建会话失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// GET /api/writer/inbox/conversations/:id/messages - 获取会话消息
router.get('/conversations/:id/messages', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const userId = req.userId;
    const conversationId = parseInt(req.params.id);
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    db = await mysql.createConnection(dbConfig);
    
    // 检查参与者权限
    const isParticipant = await checkParticipant(db, conversationId, userId);
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: '无权访问此会话' });
    }
    
    // 获取消息列表（排除内部备注）
    // LIMIT 和 OFFSET 需要直接插入数值
    const limitValue = parseInt(limit);
    const offsetValue = parseInt(offset);
    const [messages] = await db.execute(
      `SELECT 
        m.id,
        m.conversation_id,
        m.sender_id,
        m.sender_admin_id,
        m.sender_type,
        m.content,
        m.created_at,
        u.username as sender_name,
        u.pen_name as sender_pen_name,
        a.name as sender_admin_name,
        (
          SELECT COUNT(*) FROM message_attachments ma WHERE ma.message_id = m.id
        ) as attachment_count
      FROM messages m
      LEFT JOIN user u ON m.sender_id = u.id
      LEFT JOIN admin a ON m.sender_admin_id = a.id
      WHERE m.conversation_id = ? AND m.internal_note = 0
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT ${limitValue} OFFSET ${offsetValue}`,
      [conversationId]
    );
    
    // 获取附件
    const messageIds = messages.map(m => m.id);
    let attachments = [];
    if (messageIds.length > 0) {
      const [attRows] = await db.execute(
        `SELECT id, message_id, file_name, file_path, file_size, file_type, created_at
         FROM message_attachments
         WHERE message_id IN (${messageIds.map(() => '?').join(',')})`,
        messageIds
      );
      attachments = attRows;
    }
    
    // 按消息分组附件
    const attachmentsByMessage = {};
    attachments.forEach(att => {
      if (!attachmentsByMessage[att.message_id]) {
        attachmentsByMessage[att.message_id] = [];
      }
      attachmentsByMessage[att.message_id].push(att);
    });
    
    messages.forEach(msg => {
      msg.attachments = attachmentsByMessage[msg.id] || [];
      msg.sender_display_name = msg.sender_pen_name || msg.sender_name || msg.sender_admin_name || '系统';
    });
    
    // 获取总数
    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total
       FROM messages
       WHERE conversation_id = ? AND internal_note = 0`,
      [conversationId]
    );
    
    res.json({
      success: true,
      data: {
        messages: messages.reverse(), // 反转以显示从旧到新
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countRows[0].total,
          totalPages: Math.ceil(countRows[0].total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('获取消息失败:', error);
    res.status(500).json({ success: false, message: '获取消息失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// POST /api/writer/inbox/conversations/:id/messages - 发送消息
router.post('/conversations/:id/messages', authenticateAuthor, upload.array('attachments', 5), async (req, res) => {
  let db;
  try {
    const userId = req.userId;
    const conversationId = parseInt(req.params.id);
    const { content } = req.body;
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ success: false, message: '消息内容不能为空' });
    }
    
    db = await mysql.createConnection(dbConfig);
    await db.beginTransaction();
    
    try {
      // 检查参与者权限
      const isParticipant = await checkParticipant(db, conversationId, userId);
      if (!isParticipant) {
        return res.status(403).json({ success: false, message: '无权访问此会话' });
      }
      
      // 创建消息
      const [messageResult] = await db.execute(
        `INSERT INTO messages (conversation_id, sender_id, sender_type, content, internal_note)
         VALUES (?, ?, 'author', ?, 0)`,
        [conversationId, userId, content.trim()]
      );
      
      const messageId = messageResult.insertId;
      
      // 处理附件
      const attachments = [];
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const [attResult] = await db.execute(
            `INSERT INTO message_attachments (message_id, file_name, file_path, file_size, file_type, uploaded_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [messageId, file.originalname, file.path, file.size, file.mimetype, userId]
          );
          attachments.push({
            id: attResult.insertId,
            file_name: file.originalname,
            file_path: file.path,
            file_size: file.size,
            file_type: file.mimetype
          });
        }
      }
      
      // 更新会话时间
      await db.execute(
        `UPDATE conversations SET updated_at = NOW() WHERE id = ?`,
        [conversationId]
      );
      
      // 更新其他参与者的未读数
      await db.execute(
        `UPDATE conversation_reads 
         SET unread_count = unread_count + 1 
         WHERE conversation_id = ? AND user_id != ?`,
        [conversationId, userId]
      );
      
      await db.commit();
      
      res.json({
        success: true,
        data: { messageId, attachments },
        message: '消息发送成功'
      });
    } catch (error) {
      await db.rollback();
      throw error;
    }
  } catch (error) {
    console.error('发送消息失败:', error);
    res.status(500).json({ success: false, message: '发送消息失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// POST /api/writer/inbox/conversations/:id/read - 标记会话为已读
router.post('/conversations/:id/read', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const userId = req.userId;
    const conversationId = parseInt(req.params.id);
    
    db = await mysql.createConnection(dbConfig);
    
    // 检查参与者权限
    const isParticipant = await checkParticipant(db, conversationId, userId);
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: '无权访问此会话' });
    }
    
    // 获取最后一条消息ID
    const [lastMessage] = await db.execute(
      `SELECT id FROM messages 
       WHERE conversation_id = ? AND internal_note = 0 
       ORDER BY created_at DESC, id DESC LIMIT 1`,
      [conversationId]
    );
    
    const lastMessageId = lastMessage.length > 0 ? lastMessage[0].id : null;
    
    // 更新或插入已读状态
    await db.execute(
      `INSERT INTO conversation_reads (conversation_id, user_id, last_read_message_id, unread_count, last_read_at)
       VALUES (?, ?, ?, 0, NOW())
       ON DUPLICATE KEY UPDATE 
         last_read_message_id = ?,
         unread_count = 0,
         last_read_at = NOW()`,
      [conversationId, userId, lastMessageId, lastMessageId]
    );
    
    res.json({ success: true, message: '已标记为已读' });
  } catch (error) {
    console.error('标记已读失败:', error);
    res.status(500).json({ success: false, message: '标记已读失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// GET /api/writer/inbox/unread-count - 获取未读消息数
router.get('/unread-count', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const userId = req.userId;
    
    db = await mysql.createConnection(dbConfig);
    
    const [result] = await db.execute(
      `SELECT COALESCE(SUM(cr.unread_count), 0) as total_unread
       FROM conversation_reads cr
       INNER JOIN conversation_participants cp ON cr.conversation_id = cp.conversation_id
       WHERE cp.user_id = ? AND (cp.left_at IS NULL OR cp.left_at > NOW())`,
      [userId]
    );
    
    res.json({
      success: true,
      data: { unreadCount: parseInt(result[0].total_unread) }
    });
  } catch (error) {
    console.error('获取未读数失败:', error);
    res.status(500).json({ success: false, message: '获取未读数失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// POST /api/writer/inbox/conversations/:id/resolve - 标记会话为已解决（作者侧）
router.post('/conversations/:id/resolve', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const userId = req.userId;
    const conversationId = parseInt(req.params.id);
    
    db = await mysql.createConnection(dbConfig);
    
    // 检查参与者权限
    const isParticipant = await checkParticipant(db, conversationId, userId);
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: '无权访问此会话' });
    }
    
    // 更新会话状态
    await db.execute(
      `UPDATE conversations 
       SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
       WHERE id = ? AND created_by = ?`,
      [conversationId, userId]
    );
    
    res.json({ success: true, message: '会话已标记为已解决' });
  } catch (error) {
    console.error('标记已解决失败:', error);
    res.status(500).json({ success: false, message: '标记已解决失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

module.exports = router;

