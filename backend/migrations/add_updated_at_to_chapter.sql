-- 为 chapter 表添加 updated_at 字段
-- 执行日期：2025-11-24

ALTER TABLE `chapter` 
  ADD COLUMN `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间' AFTER `created_at`;

-- 将现有记录的 updated_at 设置为 created_at 的值
UPDATE `chapter` 
SET `updated_at` = `created_at` 
WHERE `updated_at` IS NULL;

