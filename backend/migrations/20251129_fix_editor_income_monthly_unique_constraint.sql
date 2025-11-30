-- 修改 editor_income_monthly 表：删除唯一约束，添加新字段
-- 执行时间：2025-11-29
-- 说明：允许同一编辑+小说+月份有多条记录，添加 source_spend_id、chapter_id、字数统计字段

-- 1. 删除旧的唯一约束
ALTER TABLE `editor_income_monthly` DROP INDEX `uniq_editor_month_novel`;

-- 2. 添加新字段（如果不存在）
ALTER TABLE `editor_income_monthly`
  ADD COLUMN IF NOT EXISTS `source_spend_id` bigint DEFAULT NULL COMMENT '对应 reader_spending.id' AFTER `month`,
  ADD COLUMN IF NOT EXISTS `chapter_id` int DEFAULT NULL COMMENT '对应章节ID（source_type = chapter_unlock 时使用）' AFTER `source_type`,
  ADD COLUMN IF NOT EXISTS `total_word_count` int NOT NULL DEFAULT '0' COMMENT '本次分配使用的总字数（subscription 为小说所有已审核章节的字数之和；chapter_unlock 为该章节字数）' AFTER `chapter_count_editor`,
  ADD COLUMN IF NOT EXISTS `editor_word_count` int NOT NULL DEFAULT '0' COMMENT '本次分配中该编辑负责的字数' AFTER `total_word_count`;

-- 3. 添加新索引（用于查询优化）
ALTER TABLE `editor_income_monthly`
  ADD INDEX IF NOT EXISTS `idx_month_source_spend` (`month`, `source_spend_id`),
  ADD INDEX IF NOT EXISTS `idx_source_spend_id` (`source_spend_id`),
  ADD INDEX IF NOT EXISTS `idx_chapter_id` (`chapter_id`);

-- 注意：MySQL 不支持 IF NOT EXISTS，如果字段/索引已存在会报错
-- 如果字段/索引已存在，请手动注释掉对应的语句后执行

