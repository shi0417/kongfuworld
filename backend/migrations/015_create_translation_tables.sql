-- 创建翻译任务表和章节翻译表
-- 用于支持 AI 批量翻译导入功能

-- 翻译任务表
CREATE TABLE IF NOT EXISTS `translation_task` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `novel_id` INT NOT NULL COMMENT '小说ID',
  `source_language` VARCHAR(10) DEFAULT 'zh' COMMENT '源语言',
  `target_language` VARCHAR(10) DEFAULT 'en' COMMENT '目标语言',
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending/running/completed/failed',
  `total_chapters` INT DEFAULT 0 COMMENT '总章节数',
  `completed_chapters` INT DEFAULT 0 COMMENT '已完成章节数',
  `failed_chapters` INT DEFAULT 0 COMMENT '失败章节数',
  `created_by_admin_id` INT DEFAULT NULL COMMENT '发起任务的管理员ID',
  `error_message` TEXT DEFAULT NULL COMMENT '整体任务错误说明',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_novel_status` (`novel_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='翻译任务表';

-- 章节翻译表
CREATE TABLE IF NOT EXISTS `chapter_translation` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `novel_id` INT NOT NULL COMMENT '小说ID',
  `chapter_id` INT DEFAULT NULL COMMENT '导入后关联 chapter.id；导入前可暂为 NULL',
  `chapter_number` INT NOT NULL COMMENT '章节号（与原文对应）',
  `language` VARCHAR(10) NOT NULL COMMENT '目标语言，如 en',
  `title` VARCHAR(255) NOT NULL COMMENT '翻译后的标题',
  `content` MEDIUMTEXT NOT NULL COMMENT '翻译后的正文',
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending/translated/imported/failed 等',
  `task_id` INT DEFAULT NULL COMMENT '关联翻译任务ID',
  `error_message` TEXT DEFAULT NULL COMMENT '失败原因记录',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_novel_lang` (`novel_id`, `language`),
  KEY `idx_task` (`task_id`),
  KEY `idx_chapter_id` (`chapter_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='章节翻译表';

