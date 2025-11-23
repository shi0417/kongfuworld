-- 为 novel 表添加 user_id 字段，用于存储作者的 id 信息
-- 添加外键约束关联到 user 表

ALTER TABLE `novel` 
ADD COLUMN `user_id` int DEFAULT NULL COMMENT '作者用户ID' AFTER `id`,
ADD INDEX `idx_user_id` (`user_id`),
ADD CONSTRAINT `novel_ibfk_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL;

