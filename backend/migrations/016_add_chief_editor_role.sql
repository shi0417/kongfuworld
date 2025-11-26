-- 添加 chief_editor 角色到 admin 表的 role 枚举
-- 升级 admin 表：添加主编角色

-- 修改 role 枚举，添加 'chief_editor'
ALTER TABLE `admin`
  MODIFY COLUMN `role` ENUM('super_admin','chief_editor','editor','finance','operator') DEFAULT 'editor';

