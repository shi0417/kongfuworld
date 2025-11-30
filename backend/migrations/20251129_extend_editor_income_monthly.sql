-- 扩展 editor_income_monthly 表，支持更详细的收入来源记录
-- 执行时间：2025-11-29
-- 说明：为「编辑基础收入-4」功能添加字段，支持区分章节解锁/订阅来源，记录章节统计和合同信息

ALTER TABLE `editor_income_monthly`
  ADD COLUMN IF NOT EXISTS `source_type` enum('chapter_unlock','subscription','mixed') NOT NULL DEFAULT 'mixed' COMMENT '收入来源类型：章节解锁/订阅/混合' AFTER `month`,
  ADD COLUMN IF NOT EXISTS `chapter_count_total` int NOT NULL DEFAULT 0 COMMENT '该小说当期用于分配的总章节数（订阅分配时用）' AFTER `source_type`,
  ADD COLUMN IF NOT EXISTS `chapter_count_editor` int NOT NULL DEFAULT 0 COMMENT '该编辑审核的章节数（订阅分配时用）' AFTER `chapter_count_total`,
  ADD COLUMN IF NOT EXISTS `contract_share_percent` decimal(8,4) DEFAULT NULL COMMENT '从 novel_editor_contract 取到的基础分成比例' AFTER `editor_share_percent`,
  ADD COLUMN IF NOT EXISTS `role` enum('chief_editor','editor','proofreader') DEFAULT NULL COMMENT '本条记录中该管理员的角色' AFTER `editor_admin_id`;

-- 注意：MySQL 不支持 IF NOT EXISTS，如果字段已存在会报错
-- 如果字段已存在，请手动注释掉对应的 ADD COLUMN 语句后执行

