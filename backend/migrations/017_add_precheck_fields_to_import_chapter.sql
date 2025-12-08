-- 迁移017：为 novel_import_chapter 表添加预检查字段
-- 执行时间：2025-12-08
-- 说明：支持自动预检查，标记疑似有问题的章节

-- 注意：如果字段已存在，执行时会报错，可以忽略或手动检查

ALTER TABLE `novel_import_chapter`
  ADD COLUMN `has_issue` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否有疑似问题（标题/正文广告/异常）',
  ADD COLUMN `issue_tags` VARCHAR(255) DEFAULT NULL COMMENT '问题标签，逗号分隔，例如 title_suspect,ad_line',
  ADD COLUMN `issue_summary` VARCHAR(255) DEFAULT NULL COMMENT '简要说明，如"标题含网址; 正文含广告语"';

-- 添加索引以便快速筛选有问题的章节
ALTER TABLE `novel_import_chapter`
  ADD INDEX `idx_has_issue` (`has_issue`);

