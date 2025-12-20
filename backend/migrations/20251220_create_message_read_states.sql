-- Inbox v2 Stage 3A: Message-level Read State (Author-only)
-- 注意：
-- - 本阶段只实现 author 侧消息级已读
-- - 仅写 message_read_states；不改动 v1 inbox 表与语义

CREATE TABLE IF NOT EXISTS `message_read_states` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `message_id` INT NOT NULL COMMENT 'messages.id',
  `reader_user_id` INT NOT NULL COMMENT 'user.id (author)',
  `read_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'read timestamp',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_message_reader_user` (`message_id`, `reader_user_id`),
  KEY `idx_reader_user` (`reader_user_id`, `read_at`),
  KEY `idx_message_id` (`message_id`),
  CONSTRAINT `fk_mrs_message` FOREIGN KEY (`message_id`) REFERENCES `messages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_mrs_reader_user` FOREIGN KEY (`reader_user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Inbox v2: author message-level read state';


