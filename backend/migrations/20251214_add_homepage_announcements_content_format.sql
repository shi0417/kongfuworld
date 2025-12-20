-- 为 homepage_announcements 增加 content_format（markdown/html）
-- 说明：旧表（20251213_create_homepage_announcements.sql）未包含该字段
-- 若已存在该字段，此脚本会报 Duplicate column；可忽略或先检查 information_schema

ALTER TABLE `homepage_announcements`
ADD COLUMN `content_format` ENUM('markdown','html') NOT NULL DEFAULT 'markdown'
AFTER `content`;


