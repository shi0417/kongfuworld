-- 创建randomNotes表（随记表）
-- 数据库名: kongfuworld

CREATE TABLE IF NOT EXISTS `randomNotes` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '随记ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `novel_id` int NOT NULL COMMENT '小说ID',
  `random_note` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '随记内容',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_novel_id` (`novel_id`),
  KEY `idx_user_novel` (`user_id`, `novel_id`),
  CONSTRAINT `randomNotes_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `randomNotes_ibfk_2` FOREIGN KEY (`novel_id`) REFERENCES `novel` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='随记表';

