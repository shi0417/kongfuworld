-- 升级 admin 表：添加主编角色和上级主管字段
-- Phase A: 管理员体系升级 + 编辑分工结构

-- 1. 修改 role 枚举，添加 'chief_editor'
ALTER TABLE `admin`
  MODIFY COLUMN `role` ENUM('super_admin','chief_editor','editor','finance','operator') DEFAULT 'editor';

-- 2. 添加 supervisor_admin_id 字段（上级主管ID）
ALTER TABLE `admin`
  ADD COLUMN `supervisor_admin_id` INT NULL AFTER `role`,
  ADD CONSTRAINT `fk_admin_supervisor` 
    FOREIGN KEY (`supervisor_admin_id`) 
    REFERENCES `admin`(`id`) 
    ON DELETE SET NULL;

-- 3. 添加索引以提高查询性能
CREATE INDEX `idx_supervisor_admin_id` ON `admin`(`supervisor_admin_id`);
CREATE INDEX `idx_role` ON `admin`(`role`);

