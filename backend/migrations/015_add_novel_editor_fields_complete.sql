-- Novel 表结构升级：添加编辑和主编字段
-- 迁移文件：015_add_novel_editor_fields_complete.sql
-- 
-- 说明：
-- 1. current_editor_admin_id 字段可能已存在（来自之前的迁移）
-- 2. chief_editor_admin_id 字段需要添加
-- 3. 本文件确保两个字段都存在，并创建必要的外键和索引

-- ============================================
-- 1. 添加 current_editor_admin_id 字段（如果不存在）
-- ============================================
-- 注意：如果字段已存在，此语句会失败，但迁移脚本会处理

ALTER TABLE `novel`
  ADD COLUMN `current_editor_admin_id` INT NULL COMMENT '该小说当前责任编辑 admin_id（若无则为NULL）'
  AFTER `user_id`;

-- ============================================
-- 2. 添加 chief_editor_admin_id 字段（如果不存在）
-- ============================================

ALTER TABLE `novel`
  ADD COLUMN `chief_editor_admin_id` INT NULL COMMENT '该小说当前主编 admin_id（若无则为NULL）'
  AFTER `current_editor_admin_id`;

-- ============================================
-- 3. 添加 current_editor_admin_id 的外键约束（如果不存在）
-- ============================================
-- 注意：如果约束已存在，会报错，迁移脚本会处理

ALTER TABLE `novel`
  ADD CONSTRAINT `fk_novel_current_editor`
    FOREIGN KEY (`current_editor_admin_id`) REFERENCES `admin`(`id`)
    ON DELETE SET NULL;

-- ============================================
-- 4. 添加 chief_editor_admin_id 的外键约束（如果不存在）
-- ============================================

ALTER TABLE `novel`
  ADD CONSTRAINT `fk_novel_chief_editor`
    FOREIGN KEY (`chief_editor_admin_id`) REFERENCES `admin`(`id`)
    ON DELETE SET NULL;

-- ============================================
-- 5. 创建索引以提高查询性能
-- ============================================

CREATE INDEX `idx_novel_current_editor_admin_id` ON `novel`(`current_editor_admin_id`);
CREATE INDEX `idx_novel_chief_editor_admin_id` ON `novel`(`chief_editor_admin_id`);

