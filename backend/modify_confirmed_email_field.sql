-- 修改confirmed_email字段类型，从tinyint改为varchar，用于存储确认的邮箱地址
-- 执行时间: 2025-01-XX

-- 步骤1: 修改字段类型
ALTER TABLE `user` 
MODIFY COLUMN `confirmed_email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '已验证的邮箱地址';

-- 步骤2: 更新现有数据（将值为1的记录更新为对应的email值）
-- 注意：需要先执行步骤1，然后执行此更新
UPDATE `user` SET `confirmed_email` = `email` WHERE `confirmed_email` = 1 AND `email` IS NOT NULL;
UPDATE `user` SET `confirmed_email` = NULL WHERE `confirmed_email` = 1 AND `email` IS NULL;

