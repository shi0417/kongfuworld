-- 为 novel 表添加推荐语和语言字段
-- recommendation: 推荐语（text类型，可空）
-- languages: 支持的语言（varchar(255)，可空，多个语言用逗号分隔，如：en,zh,es）

-- 添加推荐语字段
ALTER TABLE `novel` 
ADD COLUMN `recommendation` text COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '推荐语' AFTER `description`;

-- 添加 languages 字段
ALTER TABLE `novel` 
ADD COLUMN `languages` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '支持的语言（如：en,zh,es，多个语言用逗号分隔）' AFTER `recommendation`;

