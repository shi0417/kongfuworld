-- 升级 admin 表：添加角色系统、状态字段、显示名称
-- 并将密码改为哈希存储

-- 1. 添加新字段
ALTER TABLE `admin`
  ADD COLUMN `role` ENUM('super_admin', 'editor', 'finance', 'operator') DEFAULT 'editor' AFTER `level`,
  ADD COLUMN `status` TINYINT(1) DEFAULT 1 AFTER `role`,
  ADD COLUMN `display_name` VARCHAR(100) DEFAULT NULL AFTER `name`;

-- 2. 为现有管理员设置默认角色（根据level判断，level=1设为super_admin）
UPDATE `admin` SET `role` = 'super_admin' WHERE `level` = 1;
UPDATE `admin` SET `role` = 'editor' WHERE `role` IS NULL OR `role` = '';

-- 3. 设置display_name默认值（如果没有则使用name）
UPDATE `admin` SET `display_name` = `name` WHERE `display_name` IS NULL;

-- 4. 注意：密码哈希迁移需要通过Node.js脚本执行（见006_migrate_admin_passwords.js）

