-- 创建定时发布管理表和添加章节发布状态字段
-- 执行日期：2025-01-XX

-- 1. 为 chapter 表添加 is_released 字段
ALTER TABLE `chapter` 
  ADD COLUMN `is_released` tinyint(1) DEFAULT '1' COMMENT '是否已发布（0=未发布，1=已发布）' AFTER `review_status`;

-- 2. 创建 scheduledrelease 表
CREATE TABLE IF NOT EXISTS `scheduledrelease` (
  `id` int NOT NULL AUTO_INCREMENT,
  `novel_id` int NOT NULL COMMENT '小说ID',
  `chapter_id` int NOT NULL COMMENT '章节ID',
  `release_time` datetime NOT NULL COMMENT '计划发布时间',
  `is_released` tinyint(1) DEFAULT '0' COMMENT '是否已发布（0=未发布，1=已发布）',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_novel_id` (`novel_id`),
  KEY `idx_chapter_id` (`chapter_id`),
  KEY `idx_release_time` (`release_time`),
  KEY `idx_is_released` (`is_released`),
  CONSTRAINT `scheduledrelease_ibfk_1` FOREIGN KEY (`novel_id`) REFERENCES `novel` (`id`) ON DELETE CASCADE,
  CONSTRAINT `scheduledrelease_ibfk_2` FOREIGN KEY (`chapter_id`) REFERENCES `chapter` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='定时发布管理表';

-- 3. 初始化现有章节的 is_released 字段
-- 对于已审核通过的章节，设置为已发布
UPDATE `chapter` 
SET `is_released` = 1 
WHERE `review_status` = 'approved';

-- 对于草稿和待审核的章节，设置为未发布
UPDATE `chapter` 
SET `is_released` = 0 
WHERE `review_status` IN ('draft', 'submitted', 'reviewing');

