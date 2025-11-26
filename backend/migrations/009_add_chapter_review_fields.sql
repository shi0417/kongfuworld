-- Phase 3: 章节审核逻辑增强 - 添加审核人和负责编辑字段
-- 在审核章节时记录"谁审核的""谁负责该章节"，为后面字数统计和分成打基础

-- 1. 添加字段
ALTER TABLE `chapter`
  ADD COLUMN `editor_admin_id` INT NULL COMMENT '负责审核该章节的编辑' AFTER `review_status`;

ALTER TABLE `chapter`
  ADD COLUMN `review_admin_id` INT NULL COMMENT '最终审核人ID' AFTER `editor_admin_id`;

ALTER TABLE `chapter`
  ADD COLUMN `reviewed_at` DATETIME NULL COMMENT '审核时间' AFTER `review_admin_id`;

-- 2. 添加外键约束
ALTER TABLE `chapter`
  ADD CONSTRAINT `fk_chapter_editor_admin` 
    FOREIGN KEY (`editor_admin_id`) REFERENCES `admin`(`id`) ON DELETE SET NULL;

ALTER TABLE `chapter`
  ADD CONSTRAINT `fk_chapter_review_admin` 
    FOREIGN KEY (`review_admin_id`) REFERENCES `admin`(`id`) ON DELETE SET NULL;

-- 3. 添加索引以提高查询性能
CREATE INDEX `idx_chapter_editor_admin_id` ON `chapter`(`editor_admin_id`);
CREATE INDEX `idx_chapter_review_admin_id` ON `chapter`(`review_admin_id`);
CREATE INDEX `idx_chapter_reviewed_at` ON `chapter`(`reviewed_at`);

