-- 为 novel 表添加 chief_editor_admin_id 字段
-- 注意：current_editor_admin_id 字段已存在，只需添加 chief_editor_admin_id

-- 1. 检查并添加 chief_editor_admin_id 字段（如果不存在）
-- 如果字段已存在，此语句会失败，但迁移脚本会处理

ALTER TABLE `novel`
  ADD COLUMN `chief_editor_admin_id` INT NULL COMMENT '该小说当前主编 admin_id（若无则为NULL）'
  AFTER `current_editor_admin_id`;

-- 2. 添加外键约束（如果不存在）
-- 注意：如果约束已存在，会报错，迁移脚本会处理

ALTER TABLE `novel`
  ADD CONSTRAINT `fk_novel_chief_editor`
    FOREIGN KEY (`chief_editor_admin_id`) REFERENCES `admin`(`id`)
    ON DELETE SET NULL;

-- 3. 创建索引以提高查询性能
CREATE INDEX `idx_novel_chief_editor_admin_id` ON `novel`(`chief_editor_admin_id`);

