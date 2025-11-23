-- 将 genre 表中的 description 字段重命名为 chinese_name
ALTER TABLE `genre` 
CHANGE COLUMN `description` `chinese_name` text COLLATE utf8mb4_unicode_ci COMMENT '中文名称';

