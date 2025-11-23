-- 为comment表的target_type字段添加'review'类型
-- 用于支持对评价(review)的回复功能

ALTER TABLE `comment` 
MODIFY COLUMN `target_type` enum('novel','chapter','paragraph','review') COLLATE utf8mb4_unicode_ci NOT NULL;

