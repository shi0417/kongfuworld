-- 创建draft表，用于存储作者上传时定时保存的内容
-- 数据库名: kongfuworld
-- 执行前请先备份数据库

CREATE TABLE IF NOT EXISTS `draft` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '草稿ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `novel_id` int NOT NULL COMMENT '小说ID',
  `chapter_id` int DEFAULT NULL COMMENT '章节ID（编辑已有章节时关联，新建章节时为NULL）',
  `chapter_number` int NOT NULL COMMENT '章节号',
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '章节标题',
  `content` text COLLATE utf8mb4_unicode_ci COMMENT '章节内容',
  `translator_note` text COLLATE utf8mb4_unicode_ci COMMENT '译者备注/作者有话说',
  `word_count` int DEFAULT '0' COMMENT '字数统计',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间（定时保存时间）',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_novel_id` (`novel_id`),
  KEY `idx_chapter_id` (`chapter_id`),
  KEY `idx_user_novel_chapter` (`user_id`, `novel_id`, `chapter_number`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `draft_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `draft_ibfk_2` FOREIGN KEY (`novel_id`) REFERENCES `novel` (`id`) ON DELETE CASCADE,
  CONSTRAINT `draft_ibfk_3` FOREIGN KEY (`chapter_id`) REFERENCES `chapter` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='草稿表，存储作者定时保存的章节内容';

