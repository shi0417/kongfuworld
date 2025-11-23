-- 为 chapter 表添加 release_date 字段
-- 执行日期：2025-01-XX

ALTER TABLE `chapter` 
  ADD COLUMN `release_date` datetime DEFAULT NULL COMMENT '发布日期' AFTER `is_released`;

