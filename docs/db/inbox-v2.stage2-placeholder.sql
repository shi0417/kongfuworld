-- Stage 2 Scaffold ONLY (DO NOT EXECUTE)
-- Inbox v2 schema placeholder
-- 目标：记录“消息级已读（message-level read state）”与“Admin-only 审计”
--
-- 注意：
-- - 本文件仅作为设计占位，不应在 Stage 2 执行迁移
-- - 不应修改/删除现有表（v1 inbox 已存在 conversations/messages/...）

-- 1) 消息级已读状态（推荐独立表，支持多读者：author / 多 editor / admin）
-- TODO(Stage 3): 根据现有 user/admin 表结构确定 reader 的维度与外键策略
CREATE TABLE IF NOT EXISTS `message_read_states` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `message_id` INT NOT NULL,
  `reader_type` ENUM('author','editor','admin') NOT NULL,
  `reader_user_id` INT NULL,
  `reader_admin_id` INT NULL,
  `read_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_message_reader_user` (`message_id`, `reader_type`, `reader_user_id`),
  UNIQUE KEY `uk_message_reader_admin` (`message_id`, `reader_type`, `reader_admin_id`),
  KEY `idx_message_id` (`message_id`),
  KEY `idx_reader_user` (`reader_user_id`),
  KEY `idx_reader_admin` (`reader_admin_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Inbox v2: message-level read state（占位）';

-- 2) 审计日志（Admin-only 可读；Editor 行为也会记录但不可读）
CREATE TABLE IF NOT EXISTS `inbox_audit_logs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `conversation_id` INT NULL,
  `actor_type` ENUM('author','editor','admin','system') NOT NULL,
  `actor_user_id` INT NULL,
  `actor_admin_id` INT NULL,
  `action` VARCHAR(50) NOT NULL,
  `payload_json` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_conversation_id` (`conversation_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Inbox v2: admin-only audit logs（占位）';

-- 3) sender_type 扩展（概念占位）
-- Blueprint: sender_type = author | editor | system
-- 现有 v1 messages.sender_type 可能是 author|admin|system（需在 Stage 3 评估迁移路径）
-- TODO(Stage 3): 评估是否需要扩展 enum 或使用 VARCHAR 替代 enum
-- ALTER TABLE `messages` MODIFY COLUMN `sender_type` ...;


