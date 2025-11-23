-- 为novel表添加created_at字段
-- 如果字段已存在，此操作会失败，需要手动处理

ALTER TABLE `novel`
ADD COLUMN `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间' AFTER `review_status`;

-- 为已存在的记录设置默认创建时间（使用当前时间）
UPDATE `novel` SET `created_at` = NOW() WHERE `created_at` IS NULL;

