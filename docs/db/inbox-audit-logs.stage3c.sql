-- Inbox v2 Stage 3C: Admin-only audit logs
-- 注意：
-- - 本文件放在 docs/db/，避免被自动迁移系统误执行
-- - 需要手动执行（见 backend/scripts/execute_inbox_audit_logs_stage3c.js）
-- - meta_json 不得包含 message.content 等敏感内容

CREATE TABLE IF NOT EXISTS `inbox_audit_logs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `conversation_id` INT NULL,
  `actor_type` ENUM('author','editor','admin','system') NOT NULL,
  `actor_user_id` INT NULL,
  `actor_admin_id` INT NULL,
  `action` VARCHAR(50) NOT NULL,
  `meta_json` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_conversation_id` (`conversation_id`, `id`),
  KEY `idx_created_at` (`created_at`, `id`),
  KEY `idx_action` (`action`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Inbox v2: admin-only audit logs';


