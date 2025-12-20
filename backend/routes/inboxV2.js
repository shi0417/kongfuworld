const express = require('express');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');

const router = express.Router();

/**
 * Stage 2 Scaffold ONLY
 * - 必须挂鉴权中间件
 * - handler 只返回 mock/TODO（不写 DB，不做真实业务）
 *
 * Blueprint endpoints (concept):
 * - POST /api/inbox/conversation/:id/join
 * - POST /api/inbox/conversation/:id/leave
 * - POST /api/inbox/message/read
 * - GET  /api/inbox/conversation/:id
 * - GET  /api/inbox/audit?... (Admin-only)
 */

// 数据库配置（复用 v1 inbox 配置风格）
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4',
};

/**
 * Stage 2 scaffold principal resolver
 * - 显式区分 role: author | editor | admin（占位）
 * - 不做 DB 查询，不做真实权限校验
 */
const authenticateInboxPrincipal = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'Please login first' });
  }

  // Stage 2: 兼容现有两套 JWT secret（作者/管理员）
  try {
    const decoded = jwt.verify(token, 'your-secret-key');
    req.principal = {
      role: 'author',
      id: decoded.userId || decoded.id,
      // Stage 2 placeholder: allow future extension without implying behavior
      _tokenKind: 'user',
    };
    return next();
  } catch (e) {
    // ignore
  }

  try {
    const decoded = jwt.verify(token, 'admin-secret-key');
    const rawRole = decoded.role || 'editor';
    const role = rawRole === 'admin' ? 'admin' : 'editor';
    req.principal = {
      role,
      id: decoded.adminId || decoded.id,
      _tokenKind: 'admin',
      // keep for future debugging in Stage 3 (no behavioral effect in Stage 2)
      name: decoded.name,
      level: decoded.level,
    };
    return next();
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

const requireAdminOnly = (req, res, next) => {
  if (!req.principal) {
    return res.status(500).json({ success: false, message: 'principal missing' });
  }
  if (req.principal.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin only' });
  }
  return next();
};

const requireEditorOrAdmin = (req, res, next) => {
  if (!req.principal) {
    return res.status(500).json({ success: false, message: 'principal missing' });
  }
  if (req.principal.role !== 'editor' && req.principal.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Editor or Admin only' });
  }
  return next();
};

const requireAuthorOnly = (req, res, next) => {
  if (!req.principal) {
    return res.status(500).json({ success: false, message: 'principal missing' });
  }
  if (req.principal.role !== 'author') {
    return res.status(403).json({ success: false, message: 'Author only' });
  }
  return next();
};

async function isAuthorParticipant(db, conversationId, userId) {
  const [rows] = await db.execute(
    `SELECT 1
     FROM conversation_participants cp
     WHERE cp.conversation_id = ?
       AND cp.user_id = ?
       AND (cp.left_at IS NULL OR cp.left_at > NOW())
     LIMIT 1`,
    [conversationId, userId]
  );
  return rows.length > 0;
}

async function getConversationOrNull(db, conversationId) {
  const [rows] = await db.execute(
    `SELECT id, subject, status
     FROM conversations
     WHERE id = ?
     LIMIT 1`,
    [conversationId]
  );
  return rows.length > 0 ? rows[0] : null;
}

async function upsertEditorParticipant(db, conversationId, adminId) {
  // conversation_participants.role enum does not include "editor" in v1 schema,
  // so we store editor/admin participants as role='admin' (Stage 3B scope).
  const [rows] = await db.execute(
    `SELECT id, left_at
     FROM conversation_participants
     WHERE conversation_id = ?
       AND admin_id = ?
     LIMIT 1`,
    [conversationId, adminId]
  );

  if (rows.length === 0) {
    await db.execute(
      `INSERT INTO conversation_participants (conversation_id, admin_id, role, joined_at, left_at)
       VALUES (?, ?, 'admin', NOW(), NULL)`,
      [conversationId, adminId]
    );
    return { changed: true, wasNew: true };
  }

  const existing = rows[0];
  if (existing.left_at === null) {
    return { changed: false, wasNew: false };
  }

  await db.execute(
    `UPDATE conversation_participants
     SET left_at = NULL, joined_at = NOW()
     WHERE id = ?`,
    [existing.id]
  );
  // Re-join is idempotent; we treat as "changed" but not "new".
  return { changed: true, wasNew: false };
}

async function leaveEditorParticipant(db, conversationId, adminId) {
  const [rows] = await db.execute(
    `SELECT id, left_at
     FROM conversation_participants
     WHERE conversation_id = ?
       AND admin_id = ?
     LIMIT 1`,
    [conversationId, adminId]
  );

  if (rows.length === 0) {
    return { changed: false, existed: false };
  }

  const existing = rows[0];
  if (existing.left_at !== null) {
    return { changed: false, existed: true };
  }

  await db.execute(
    `UPDATE conversation_participants
     SET left_at = NOW()
     WHERE id = ?`,
    [existing.id]
  );
  return { changed: true, existed: true };
}

async function insertSystemMessageBestEffort(db, conversationId, content) {
  // system message MUST NOT write message_read_states
  try {
    // Idempotency: avoid duplicate system message with same content in same conversation.
    const [existsRows] = await db.execute(
      `SELECT id
       FROM messages
       WHERE conversation_id = ?
         AND sender_type = 'system'
         AND internal_note = 0
         AND content = ?
       LIMIT 1`,
      [conversationId, content]
    );
    if (existsRows.length > 0) return { inserted: false, reason: 'already-exists' };

    await db.execute(
      `INSERT INTO messages (conversation_id, sender_type, content, internal_note)
       VALUES (?, 'system', ?, 0)`,
      [conversationId, content]
    );
    return { inserted: true };
  } catch (e) {
    console.warn('[inboxV2] system message insert failed (non-blocking):', e);
    return { inserted: false, reason: 'error' };
  }
}

async function insertAuditBestEffort(db, auditRow) {
  // Stage 3C: best-effort only; failures must NOT affect main flow
  // meta_json MUST NOT include message.content or other sensitive payloads
  try {
    // Normalize & validate actor_type/action (P1 hardening)
    const allowedActorTypes = new Set(['author', 'editor', 'admin']);
    if (!allowedActorTypes.has(auditRow.actor_type)) {
      console.warn('[inboxV2] audit skipped: invalid actor_type:', auditRow.actor_type);
      return;
    }

    const allowedActions = new Set(['JOIN_CONVERSATION', 'LEAVE_CONVERSATION', 'MARK_READ']);
    if (!allowedActions.has(auditRow.action)) {
      console.warn('[inboxV2] audit skipped: invalid action:', auditRow.action);
      return;
    }

    const metaJson = auditRow.meta ? JSON.stringify(auditRow.meta) : null;
    await db.execute(
      `INSERT INTO inbox_audit_logs
        (conversation_id, actor_type, actor_user_id, actor_admin_id, action, meta_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        auditRow.conversation_id ?? null,
        auditRow.actor_type,
        auditRow.actor_user_id ?? null,
        auditRow.actor_admin_id ?? null,
        auditRow.action,
        metaJson,
      ]
    );
  } catch (e) {
    console.warn('[inboxV2] audit insert failed (non-blocking):', e);
  }
}

// POST /api/inbox/conversation/:id/join (Editor/Admin)
router.post('/conversation/:id/join', authenticateInboxPrincipal, requireEditorOrAdmin, async (req, res) => {
  let db;
  try {
    const conversationId = parseInt(req.params.id, 10);
    if (!Number.isFinite(conversationId) || conversationId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid conversation id' });
    }
    const adminId = req.principal.id;

    db = await mysql.createConnection(dbConfig);

    const conv = await getConversationOrNull(db, conversationId);
    if (!conv) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    // Idempotent join
    const { changed, wasNew } = await upsertEditorParticipant(db, conversationId, adminId);

    // System message: best-effort, does not block join success.
    // Fixed template content (with name placeholder):
    const displayName = req.principal.name || 'Editor';
    const systemContent = `Editor ${displayName} joined the conversation.`;
    // Blueprint requirement: same editor repeat join should not duplicate system message.
    // We only emit system join message on first-ever join row creation.
    if (wasNew) {
      await insertSystemMessageBestEffort(db, conversationId, systemContent);
    }

    // Audit: best-effort, admin-only readable; write failure must not affect success.
    await insertAuditBestEffort(db, {
      conversation_id: conversationId,
      actor_type: req.principal.role === 'admin' ? 'admin' : 'editor',
      actor_admin_id: adminId,
      action: 'JOIN_CONVERSATION',
      meta: { changed, was_new: wasNew },
    });

    return res.json({ success: true, data: { joined: true, changed } });
  } catch (e) {
    console.error('[inboxV2] join failed:', e);
    return res.status(500).json({ success: false, message: 'Join failed' });
  } finally {
    if (db) await db.end();
  }
});

// POST /api/inbox/conversation/:id/leave (Editor/Admin)
router.post('/conversation/:id/leave', authenticateInboxPrincipal, requireEditorOrAdmin, async (req, res) => {
  let db;
  try {
    const conversationId = parseInt(req.params.id, 10);
    if (!Number.isFinite(conversationId) || conversationId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid conversation id' });
    }
    const adminId = req.principal.id;

    db = await mysql.createConnection(dbConfig);

    const conv = await getConversationOrNull(db, conversationId);
    if (!conv) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    // Idempotent leave
    const { changed } = await leaveEditorParticipant(db, conversationId, adminId);

    // System message: best-effort, does not block leave success.
    const displayName = req.principal.name || 'Editor';
    const systemContent = `Editor ${displayName} left the conversation.`;
    if (changed) {
      await insertSystemMessageBestEffort(db, conversationId, systemContent);
    }

    // Audit: best-effort
    await insertAuditBestEffort(db, {
      conversation_id: conversationId,
      actor_type: req.principal.role === 'admin' ? 'admin' : 'editor',
      actor_admin_id: adminId,
      action: 'LEAVE_CONVERSATION',
      meta: { changed },
    });

    return res.json({ success: true, data: { left: true, changed } });
  } catch (e) {
    console.error('[inboxV2] leave failed:', e);
    return res.status(500).json({ success: false, message: 'Leave failed' });
  } finally {
    if (db) await db.end();
  }
});

// GET /api/inbox/conversations (Author-only) - unread count aggregated from message_read_states
router.get('/conversations', authenticateInboxPrincipal, requireAuthorOnly, async (req, res) => {
  let db;
  try {
    const userId = req.principal.id;
    const { page = 1, limit = 20 } = req.query;
    const limitValue = Math.max(1, Math.min(50, parseInt(limit, 10) || 20));
    const pageValue = Math.max(1, parseInt(page, 10) || 1);
    const offsetValue = (pageValue - 1) * limitValue;

    db = await mysql.createConnection(dbConfig);

    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total
       FROM conversations c
       INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
       WHERE cp.user_id = ?
         AND (cp.left_at IS NULL OR cp.left_at > NOW())`,
      [userId]
    );

    // TODO(Stage 3B): implement unread_count aggregation
    // Stage 3A: unread_count in list is a placeholder (0) to avoid shipping partial aggregation logic.
    const [rows] = await db.execute(
      `SELECT
        c.id,
        c.subject,
        c.status,
        c.updated_at,
        0 as unread_count
      FROM conversations c
      INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
      WHERE cp.user_id = ?
        AND (cp.left_at IS NULL OR cp.left_at > NOW())
      ORDER BY c.updated_at DESC
      LIMIT ${limitValue} OFFSET ${offsetValue}`,
      [userId]
    );

    return res.json({
      success: true,
      data: {
        conversations: rows,
        pagination: {
          page: pageValue,
          limit: limitValue,
          total: countRows[0]?.total || 0,
          totalPages: Math.ceil((countRows[0]?.total || 0) / limitValue),
        },
      },
    });
  } catch (e) {
    console.error('[inboxV2] list conversations failed:', e);
    return res.status(500).json({ success: false, message: 'Failed to load conversations' });
  } finally {
    if (db) await db.end();
  }
});

// POST /api/inbox/message/read (Author-only, idempotent) - batch message_ids
router.post('/message/read', authenticateInboxPrincipal, requireAuthorOnly, async (req, res) => {
  let db;
  try {
    const userId = req.principal.id;
    const messageIdsRaw = req.body?.message_ids;
    if (!Array.isArray(messageIdsRaw) || messageIdsRaw.length === 0) {
      return res.status(400).json({ success: false, message: 'message_ids is required' });
    }

    // sanitize + unique + cap
    const messageIds = Array.from(
      new Set(
        messageIdsRaw
          .map((v) => parseInt(v, 10))
          .filter((n) => Number.isFinite(n) && n > 0)
      )
    ).slice(0, 200);

    if (messageIds.length === 0) {
      return res.status(400).json({ success: false, message: 'message_ids must be positive integers' });
    }

    db = await mysql.createConnection(dbConfig);

    // Only mark eligible messages:
    // - author must be participant
    // - exclude system messages
    // - exclude author's own messages (implicitly read)
    const placeholders = messageIds.map(() => '?').join(',');
    const [eligibleRows] = await db.execute(
      `SELECT m.id, m.conversation_id
       FROM messages m
       INNER JOIN conversation_participants cp
         ON cp.conversation_id = m.conversation_id
        AND cp.user_id = ?
        AND (cp.left_at IS NULL OR cp.left_at > NOW())
       WHERE m.id IN (${placeholders})
         AND m.internal_note = 0
         AND m.sender_type <> 'system'
         AND m.sender_type <> 'author'`,
      [userId, ...messageIds]
    );

    const eligibleIds = eligibleRows.map((r) => r.id);
    if (eligibleIds.length === 0) {
      // Audit (best-effort): record summary only (no message content)
      await insertAuditBestEffort(db, {
        conversation_id: null,
        actor_type: 'author',
        actor_user_id: userId,
        action: 'MARK_READ',
        meta: { requested_count: messageIds.length, eligible_count: 0 },
      });
      return res.json({ success: true, data: { inserted: 0, requested: messageIds.length } });
    }

    const valuesSql = eligibleIds.map(() => '(?, ?, NOW())').join(',');
    const insertParams = eligibleIds.flatMap((id) => [id, userId]);

    // Idempotent: unique(message_id, reader_user_id) + INSERT IGNORE
    await db.execute(
      `INSERT IGNORE INTO message_read_states (message_id, reader_user_id, read_at)
       VALUES ${valuesSql}`,
      insertParams
    );

    // Audit (best-effort): per conversation summary only, no message ids/content
    const countsByConversation = new Map();
    for (const row of eligibleRows) {
      const cid = row.conversation_id;
      countsByConversation.set(cid, (countsByConversation.get(cid) || 0) + 1);
    }
    for (const [cid, cnt] of countsByConversation.entries()) {
      await insertAuditBestEffort(db, {
        conversation_id: cid,
        actor_type: 'author',
        actor_user_id: userId,
        action: 'MARK_READ',
        meta: { requested_count: messageIds.length, eligible_count: cnt },
      });
    }

    return res.json({
      success: true,
      data: { inserted: eligibleIds.length, requested: messageIds.length },
    });
  } catch (e) {
    console.error('[inboxV2] mark read failed:', e);
    return res.status(500).json({ success: false, message: 'Failed to mark messages as read' });
  } finally {
    if (db) await db.end();
  }
});

// GET /api/inbox/conversation/:id (Author: own only; Admin/Editor: allow)
router.get('/conversation/:id', authenticateInboxPrincipal, requireAuthorOnly, async (req, res) => {
  /**
   * Stage 3A invariant:
   * - This endpoint MUST be read-only.
   * - Do NOT write message_read_states here.
   * - All read-state writes must go through POST /api/inbox/message/read.
   */
  let db;
  try {
    const userId = req.principal.id;
    const conversationId = parseInt(req.params.id, 10);
    if (!Number.isFinite(conversationId) || conversationId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid conversation id' });
    }

    const { page = 1, limit = 50 } = req.query;
    const limitValue = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const pageValue = Math.max(1, parseInt(page, 10) || 1);
    const offsetValue = (pageValue - 1) * limitValue;

    db = await mysql.createConnection(dbConfig);

    const isParticipant = await isAuthorParticipant(db, conversationId, userId);
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'Not a participant' });
    }

    const [convRows] = await db.execute(
      `SELECT id, subject, status, updated_at
       FROM conversations
       WHERE id = ?
       LIMIT 1`,
      [conversationId]
    );
    if (convRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total
       FROM messages
       WHERE conversation_id = ?
         AND internal_note = 0`,
      [conversationId]
    );

    const [messageRows] = await db.execute(
      `SELECT
        m.id,
        m.conversation_id,
        m.sender_type,
        m.sender_id,
        m.sender_admin_id,
        m.content,
        m.created_at,
        CASE
          WHEN m.sender_type = 'system' THEN NULL
          WHEN m.sender_type = 'author' THEN 1
          WHEN rs.id IS NULL THEN 0
          ELSE 1
        END AS is_read,
        rs.read_at
      FROM messages m
      LEFT JOIN message_read_states rs
        ON rs.message_id = m.id
       AND rs.reader_user_id = ?
      WHERE m.conversation_id = ?
        AND m.internal_note = 0
      ORDER BY m.created_at ASC
      LIMIT ${limitValue} OFFSET ${offsetValue}`,
      [userId, conversationId]
    );

    return res.json({
      success: true,
      data: {
        conversation: convRows[0],
        messages: messageRows,
        pagination: {
          page: pageValue,
          limit: limitValue,
          total: countRows[0]?.total || 0,
          totalPages: Math.ceil((countRows[0]?.total || 0) / limitValue),
        },
      },
    });
  } catch (e) {
    console.error('[inboxV2] get conversation failed:', e);
    return res.status(500).json({ success: false, message: 'Failed to load conversation' });
  } finally {
    if (db) await db.end();
  }
});

// GET /api/inbox/audit?conversation_id=... (Admin-only)
router.get('/audit', authenticateInboxPrincipal, requireAdminOnly, async (req, res) => {
  let db;
  try {
    const { conversation_id, page = 1, limit = 20 } = req.query;
    const limitValue = Math.max(1, Math.min(50, parseInt(limit, 10) || 20));
    const pageValue = Math.max(1, parseInt(page, 10) || 1);
    const offsetValue = (pageValue - 1) * limitValue;

    const where = [];
    const params = [];
    if (typeof conversation_id !== 'undefined') {
      const cid = parseInt(String(conversation_id), 10);
      // P1: strict validation, never allow NaN to reach SQL params
      if (!Number.isFinite(cid) || cid <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid conversation_id' });
      }
      where.push('l.conversation_id = ?');
      params.push(cid);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    db = await mysql.createConnection(dbConfig);

    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total
       FROM inbox_audit_logs l
       ${whereSql}`,
      params
    );

    const [rows] = await db.execute(
      `SELECT
        l.id,
        l.conversation_id,
        l.actor_type,
        l.actor_user_id,
        l.actor_admin_id,
        l.action,
        l.meta_json,
        l.created_at,
        u.username as actor_user_name,
        a.name as actor_admin_name
      FROM inbox_audit_logs l
      LEFT JOIN user u ON u.id = l.actor_user_id
      LEFT JOIN admin a ON a.id = l.actor_admin_id
      ${whereSql}
      ORDER BY l.id DESC
      LIMIT ${limitValue} OFFSET ${offsetValue}`,
      params
    );

    return res.json({
      success: true,
      data: {
        logs: rows,
        pagination: {
          page: pageValue,
          limit: limitValue,
          total: countRows[0]?.total || 0,
          totalPages: Math.ceil((countRows[0]?.total || 0) / limitValue),
        },
      },
    });
  } catch (e) {
    console.error('[inboxV2] audit query failed:', e);
    return res.status(500).json({ success: false, message: 'Failed to load audit logs' });
  } finally {
    if (db) await db.end();
  }
});

module.exports = router;


