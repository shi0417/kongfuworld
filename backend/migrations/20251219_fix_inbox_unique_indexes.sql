-- 修复站内信表的唯一约束（MySQL UNIQUE 对 NULL 不生效，导致重复行）
-- 目标：
-- 1) 清理 conversation_reads / conversation_participants 中重复的 user 侧与 admin 侧记录
-- 2) 用更合理的唯一索引替换原 uk_conversation_user(conversation_id,user_id,admin_id)
--    - user侧：UNIQUE(conversation_id, user_id)
--    - admin侧：UNIQUE(conversation_id, admin_id)

START TRANSACTION;

-- =========================
-- 1) 清理重复的 conversation_reads
-- =========================

-- user侧：同一 conversation_id + user_id 只保留 id 最大的一条
DELETE r
FROM conversation_reads r
JOIN conversation_reads r2
  ON r.conversation_id = r2.conversation_id
 AND r.user_id = r2.user_id
 AND r.user_id IS NOT NULL
 AND r2.user_id IS NOT NULL
 AND r.id < r2.id;

-- admin侧：同一 conversation_id + admin_id 只保留 id 最大的一条
DELETE r
FROM conversation_reads r
JOIN conversation_reads r2
  ON r.conversation_id = r2.conversation_id
 AND r.admin_id = r2.admin_id
 AND r.admin_id IS NOT NULL
 AND r2.admin_id IS NOT NULL
 AND r.id < r2.id;

-- =========================
-- 2) 清理重复的 conversation_participants
-- =========================

-- user侧：同一 conversation_id + user_id 只保留 id 最大的一条
DELETE p
FROM conversation_participants p
JOIN conversation_participants p2
  ON p.conversation_id = p2.conversation_id
 AND p.user_id = p2.user_id
 AND p.user_id IS NOT NULL
 AND p2.user_id IS NOT NULL
 AND p.id < p2.id;

-- admin侧：同一 conversation_id + admin_id 只保留 id 最大的一条
DELETE p
FROM conversation_participants p
JOIN conversation_participants p2
  ON p.conversation_id = p2.conversation_id
 AND p.admin_id = p2.admin_id
 AND p.admin_id IS NOT NULL
 AND p2.admin_id IS NOT NULL
 AND p.id < p2.id;

-- =========================
-- 3) 重建唯一索引
-- =========================

-- conversation_reads
ALTER TABLE conversation_reads DROP INDEX uk_conversation_user;
ALTER TABLE conversation_reads
  ADD UNIQUE INDEX uk_reads_conversation_user (conversation_id, user_id),
  ADD UNIQUE INDEX uk_reads_conversation_admin (conversation_id, admin_id);

-- conversation_participants
ALTER TABLE conversation_participants DROP INDEX uk_conversation_user;
ALTER TABLE conversation_participants
  ADD UNIQUE INDEX uk_participants_conversation_user (conversation_id, user_id),
  ADD UNIQUE INDEX uk_participants_conversation_admin (conversation_id, admin_id);

COMMIT;


