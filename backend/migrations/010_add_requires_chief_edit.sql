-- Phase 3: 小说主编终审开关 + 章节审核流程
-- 在 novel 表增加 requires_chief_edit 字段，用于控制是否需要主编终审

-- 添加字段：是否需要主编终审
ALTER TABLE `novel`
  ADD COLUMN `requires_chief_edit` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否需要主编终审（0=不需要，1=需要）';

-- 添加索引以提高查询性能
CREATE INDEX `idx_requires_chief_edit` ON `novel`(`requires_chief_edit`);

