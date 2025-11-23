-- 为user表添加作者相关字段
-- 执行时间: 2025-01-XX

-- 1. 添加 is_author 字段（是否是作者）
ALTER TABLE `user` 
ADD COLUMN `is_author` tinyint(1) DEFAULT 0 COMMENT '是否是作者' 
AFTER `is_vip`;

-- 2. 添加 pen_name 字段（笔名）
ALTER TABLE `user` 
ADD COLUMN `pen_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '笔名' 
AFTER `is_author`;

-- 3. 添加 bio 字段（作者简介）
ALTER TABLE `user` 
ADD COLUMN `bio` text COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '作者简介' 
AFTER `pen_name`;

-- 4. 添加 confirmed_email 字段（已验证的邮箱地址）
-- 注意：如果字段已存在为tinyint类型，需要先运行 modify_confirmed_email_field.sql 修改字段类型
ALTER TABLE `user` 
ADD COLUMN `confirmed_email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '已验证的邮箱地址' 
AFTER `email`;

-- 5. 添加 social_links 字段（社交媒体链接，JSON格式）
ALTER TABLE `user` 
ADD COLUMN `social_links` json DEFAULT NULL COMMENT '社交媒体链接' 
AFTER `settings_json`;

-- 为pen_name添加索引（如果需要按笔名搜索）
ALTER TABLE `user` 
ADD INDEX `idx_pen_name` (`pen_name`);

-- 为is_author添加索引（用于查询作者列表）
ALTER TABLE `user` 
ADD INDEX `idx_is_author` (`is_author`);

