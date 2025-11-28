-- 迁移024：删除 chapter 表中的 review_admin_id 字段
-- review_admin_id 已被 editor_admin_id + chief_editor_admin_id 替代，因此删除冗余字段

-- 注意：MySQL 不支持 DROP FOREIGN KEY IF EXISTS 和 DROP COLUMN IF EXISTS 语法
-- 如果外键/索引/字段不存在，执行会报错，但迁移脚本会捕获并忽略这些错误

-- 1. 删除外键约束（如果存在）
ALTER TABLE `chapter`
  DROP FOREIGN KEY `fk_chapter_review_admin`;

-- 2. 删除索引（如果存在）
DROP INDEX `idx_chapter_review_admin_id` ON `chapter`;

-- 3. 删除字段
ALTER TABLE `chapter`
  DROP COLUMN `review_admin_id`;

