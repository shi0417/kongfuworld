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

// 中间件：验证管理员身份
const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ success: false, message: '请先登录' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, 'admin-secret-key');
    const adminId = decoded.adminId || decoded.id;

    if (!adminId) {
      return res.status(401).json({ success: false, message: '请先登录' });
    }

    req.adminId = adminId;
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
  limits: { fileSize: 10 * 1024 * 1024 },
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

// GET /api/admin/inbox/conversations - 获取会话列表（管理员端）
router.get('/conversations', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const adminId = req.adminId;
    const { status, category, assigned_to, search = '', page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    db = await mysql.createConnection(dbConfig);
    
    let whereClause = '1=1';
    const params = [];
    
    if (status) {
      whereClause += ' AND c.status = ?';
      params.push(status);
    }
    
    if (category) {
      whereClause += ' AND c.category = ?';
      params.push(category);
    }
    
    if (assigned_to) {
      if (assigned_to === 'me') {
        whereClause += ' AND c.assigned_to = ?';
        params.push(adminId);
      } else if (assigned_to === 'unassigned') {
        whereClause += ' AND c.assigned_to IS NULL';
      } else {
        whereClause += ' AND c.assigned_to = ?';
        params.push(parseInt(assigned_to));
      }
    }
    
    if (search) {
      whereClause += ' AND c.subject LIKE ?';
      params.push(`%${search}%`);
    }
    
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
        c.assigned_to,
        (
          SELECT cp2.admin_id
          FROM conversation_participants cp2
          WHERE cp2.conversation_id = c.id
            AND cp2.admin_id IS NOT NULL
            AND (cp2.left_at IS NULL OR cp2.left_at > NOW())
          ORDER BY cp2.joined_at DESC, cp2.id DESC
          LIMIT 1
        ) as active_assigned_admin_id,
        (
          SELECT a2.name
          FROM conversation_participants cp2
          INNER JOIN admin a2 ON a2.id = cp2.admin_id
          WHERE cp2.conversation_id = c.id
            AND cp2.admin_id IS NOT NULL
            AND (cp2.left_at IS NULL OR cp2.left_at > NOW())
          ORDER BY cp2.joined_at DESC, cp2.id DESC
          LIMIT 1
        ) as active_assigned_admin_name,
        c.related_novel_id,
        c.created_at,
        c.updated_at,
        c.created_by,
        u.username as author_name,
        u.pen_name as author_pen_name,
        a.name as assigned_admin_name,
        n.title as novel_title,
        (
          SELECT COUNT(*) FROM messages m 
          WHERE m.conversation_id = c.id 
            AND m.internal_note = 0
        ) as message_count,
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
        ) as last_message_at
      FROM conversations c
      LEFT JOIN user u ON c.created_by = u.id
      LEFT JOIN admin a ON c.assigned_to = a.id
      LEFT JOIN novel n ON c.related_novel_id = n.id
      WHERE ${whereClause}
      ORDER BY c.updated_at DESC
      LIMIT ${limitValue} OFFSET ${offsetValue}`,
      params
    );
    
    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total
      FROM conversations c
      WHERE ${whereClause}`,
      params
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

// GET /api/admin/inbox/conversations/:id - 获取会话详情（包含内部备注）
router.get('/conversations/:id', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const conversationId = parseInt(req.params.id);
    
    db = await mysql.createConnection(dbConfig);
    
    const [conversations] = await db.execute(
      `SELECT 
        c.*,
        u.username as author_name,
        u.pen_name as author_pen_name,
        a.name as assigned_admin_name,
        n.title as novel_title
      FROM conversations c
      LEFT JOIN user u ON c.created_by = u.id
      LEFT JOIN admin a ON c.assigned_to = a.id
      LEFT JOIN novel n ON c.related_novel_id = n.id
      WHERE c.id = ?`,
      [conversationId]
    );
    
    if (conversations.length === 0) {
      return res.status(404).json({ success: false, message: '会话不存在' });
    }
    
    res.json({ success: true, data: conversations[0] });
  } catch (error) {
    console.error('获取会话详情失败:', error);
    res.status(500).json({ success: false, message: '获取会话详情失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// GET /api/admin/inbox/conversations/:id/messages - 获取消息（包含内部备注）
router.get('/conversations/:id/messages', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const conversationId = parseInt(req.params.id);
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    db = await mysql.createConnection(dbConfig);
    
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
        m.internal_note,
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
      WHERE m.conversation_id = ?
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT ${limitValue} OFFSET ${offsetValue}`,
      [conversationId]
    );
    
    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total FROM messages WHERE conversation_id = ?`,
      [conversationId]
    );
    
    res.json({
      success: true,
      data: {
        messages: messages.reverse(),
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

// POST /api/admin/inbox/conversations/:id/assign - 分配负责人
router.post('/conversations/:id/assign', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const conversationId = parseInt(req.params.id);
    const { assigned_to } = req.body;
    const adminId = req.adminId;
    
    db = await mysql.createConnection(dbConfig);
    
    await db.execute(
      `UPDATE conversations 
       SET assigned_to = ?, updated_at = NOW()
       WHERE id = ?`,
      [assigned_to || null, conversationId]
    );
    
    res.json({ success: true, message: '分配成功' });
  } catch (error) {
    console.error('分配失败:', error);
    res.status(500).json({ success: false, message: '分配失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// POST /api/admin/inbox/conversations/:id/status - 更新状态
router.post('/conversations/:id/status', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const conversationId = parseInt(req.params.id);
    const { status } = req.body;
    
    if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({ success: false, message: '无效的状态' });
    }
    
    db = await mysql.createConnection(dbConfig);
    
    const updateFields = ['status = ?', 'updated_at = NOW()'];
    const updateValues = [status];
    
    if (status === 'resolved') {
      updateFields.push('resolved_at = NOW()');
    } else if (status === 'closed') {
      updateFields.push('closed_at = NOW()');
    }
    
    await db.execute(
      `UPDATE conversations SET ${updateFields.join(', ')} WHERE id = ?`,
      [...updateValues, conversationId]
    );
    
    res.json({ success: true, message: '状态更新成功' });
  } catch (error) {
    console.error('更新状态失败:', error);
    res.status(500).json({ success: false, message: '更新状态失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// POST /api/admin/inbox/conversations/:id/internal-note - 添加内部备注
router.post('/conversations/:id/internal-note', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const conversationId = parseInt(req.params.id);
    const { content } = req.body;
    const adminId = req.adminId;
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ success: false, message: '备注内容不能为空' });
    }
    
    db = await mysql.createConnection(dbConfig);
    await db.beginTransaction();
    
    try {
      const [messageResult] = await db.execute(
        `INSERT INTO messages (conversation_id, sender_admin_id, sender_type, content, internal_note)
         VALUES (?, ?, 'admin', ?, 1)`,
        [conversationId, adminId, content.trim()]
      );
      
      await db.execute(
        `UPDATE conversations SET updated_at = NOW() WHERE id = ?`,
        [conversationId]
      );
      
      await db.commit();
      
      res.json({
        success: true,
        data: { messageId: messageResult.insertId },
        message: '内部备注添加成功'
      });
    } catch (error) {
      await db.rollback();
      throw error;
    }
  } catch (error) {
    console.error('添加内部备注失败:', error);
    res.status(500).json({ success: false, message: '添加内部备注失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// POST /api/admin/inbox/conversations/:id/messages - 发送消息（管理员）
router.post('/conversations/:id/messages', authenticateAdmin, upload.array('attachments', 5), async (req, res) => {
  let db;
  try {
    const conversationId = parseInt(req.params.id);
    const { content } = req.body;
    const adminId = req.adminId;
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ success: false, message: '消息内容不能为空' });
    }
    
    db = await mysql.createConnection(dbConfig);
    await db.beginTransaction();
    
    try {
      // 确保管理员是参与者
      const [participants] = await db.execute(
        'SELECT id FROM conversation_participants WHERE conversation_id = ? AND admin_id = ?',
        [conversationId, adminId]
      );
      
      if (participants.length === 0) {
        await db.execute(
          `INSERT INTO conversation_participants (conversation_id, admin_id, role)
           VALUES (?, ?, 'admin')`,
          [conversationId, adminId]
        );
      }
      
      const [messageResult] = await db.execute(
        `INSERT INTO messages (conversation_id, sender_admin_id, sender_type, content, internal_note)
         VALUES (?, ?, 'admin', ?, 0)`,
        [conversationId, adminId, content.trim()]
      );
      
      const messageId = messageResult.insertId;
      
      // 处理附件
      const attachments = [];
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const [attResult] = await db.execute(
            `INSERT INTO message_attachments (message_id, file_name, file_path, file_size, file_type, uploaded_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [messageId, file.originalname, file.path, file.size, file.mimetype, adminId]
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
      
      await db.execute(
        `UPDATE conversations SET updated_at = NOW() WHERE id = ?`,
        [conversationId]
      );
      
      // 更新作者的未读数
      await db.execute(
        `UPDATE conversation_reads 
         SET unread_count = unread_count + 1 
         WHERE conversation_id = ? AND user_id IS NOT NULL`,
        [conversationId]
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

module.exports = router;

