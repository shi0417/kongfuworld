-- 删除 admin 表中的 display_name 和 supervisor_admin_id 字段

-- 1. 删除外键约束（如果存在）
ALTER TABLE `admin` DROP FOREIGN KEY IF EXISTS `fk_admin_supervisor`;

-- 2. 删除索引（如果存在）
DROP INDEX IF EXISTS `idx_supervisor_admin_id` ON `admin`;

-- 3. 删除字段
ALTER TABLE `admin` DROP COLUMN IF EXISTS `display_name`;
ALTER TABLE `admin` DROP COLUMN IF EXISTS `supervisor_admin_id`;

