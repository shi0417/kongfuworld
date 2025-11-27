-- 迁移023：为 chapter 表添加 chief_editor_admin_id 字段
-- 目的：记录最终审核该章节的主编 ID，用于结算

-- 检查并添加 chief_editor_admin_id 字段（如果不存在）
ALTER TABLE `chapter`
  ADD COLUMN `chief_editor_admin_id` INT NULL COMMENT '最终审核该章节的主编 ID（如果需要主编终审）' AFTER `editor_admin_id`;

-- 添加外键约束
ALTER TABLE `chapter`
  ADD CONSTRAINT `fk_chapter_chief_editor_admin`
    FOREIGN KEY (`chief_editor_admin_id`) REFERENCES `admin`(`id`) ON DELETE SET NULL;

-- 添加索引
CREATE INDEX `idx_chapter_chief_editor_admin_id` ON `chapter`(`chief_editor_admin_id`);

