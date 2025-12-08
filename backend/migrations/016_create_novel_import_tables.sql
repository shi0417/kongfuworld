-- 迁移016：创建小说导入批次和章节草稿表
-- 执行时间：2025-12-08
-- 说明：支持导入预览功能，允许用户在翻译前编辑章节信息

-- 表一：novel_import_batch（导入批次表）
CREATE TABLE IF NOT EXISTS `novel_import_batch` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `novel_id` INT NOT NULL COMMENT '小说ID',
  `created_by_admin_id` INT NOT NULL COMMENT '创建批次的管理员ID',
  `source_file_name` VARCHAR(255) DEFAULT NULL COMMENT '源文件名（如果从文件导入）',
  `source_type` ENUM('text','file') NOT NULL DEFAULT 'text' COMMENT '来源类型：文本或文件',
  `status` ENUM('draft','confirmed','translating','completed','failed') NOT NULL DEFAULT 'draft' COMMENT '批次状态',
  `total_chapters` INT NOT NULL DEFAULT 0 COMMENT '总章节数',
  `notes` TEXT DEFAULT NULL COMMENT '备注',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_novel_status` (`novel_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='小说导入批次表';

-- 表二：novel_import_chapter（导入章节草稿表）
CREATE TABLE IF NOT EXISTS `novel_import_chapter` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `batch_id` INT NOT NULL COMMENT '批次ID',
  `novel_id` INT NOT NULL COMMENT '小说ID',
  `chapter_number` INT NOT NULL COMMENT '章节号',
  `volume_id` INT DEFAULT NULL COMMENT '卷ID',
  `raw_title` VARCHAR(255) NOT NULL COMMENT '原始标题（从文档分出来的）',
  `raw_content` LONGTEXT NOT NULL COMMENT '原始内容（从文档分出来的）',
  `clean_title` VARCHAR(255) DEFAULT NULL COMMENT '清洗后的标题（AI或人工清洗）',
  `clean_content` LONGTEXT DEFAULT NULL COMMENT '清洗后的内容（AI或人工清洗）',
  `en_title` VARCHAR(255) DEFAULT NULL COMMENT '翻译后的英文标题',
  `en_content` LONGTEXT DEFAULT NULL COMMENT '翻译后的英文内容',
  `word_count` INT NOT NULL DEFAULT 0 COMMENT '字数',
  `unlock_price` INT NOT NULL DEFAULT 0 COMMENT '解锁价格（karma）',
  `key_cost` INT NOT NULL DEFAULT 0 COMMENT '钥匙消耗',
  `is_advance` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否预读',
  `unlock_priority` ENUM('free','key','karma','subscription') NOT NULL DEFAULT 'free' COMMENT '解锁优先级',
  `review_status` ENUM('draft','submitted','reviewing','approved','rejected') NOT NULL DEFAULT 'draft' COMMENT '审核状态',
  `is_released` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已发布',
  `release_date` DATETIME DEFAULT NULL COMMENT '发布日期',
  `status` ENUM('draft','ready_for_translation','translating','translated','imported','skipped','duplicate_existing') NOT NULL DEFAULT 'draft' COMMENT '章节状态',
  `chapter_id` INT DEFAULT NULL COMMENT '导入 chapter 表后填入的章节ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_batch` (`batch_id`),
  KEY `idx_novel_chapter` (`novel_id`,`chapter_number`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='导入章节草稿表';

