-- 迁移脚本：删除comment表的target_type字段，并删除target_type=review的数据
-- 执行时间: 2025-01-XX
-- 说明：comment表以后只存储章节评论的子评论和母评论，不再需要target_type字段

-- 1. 删除target_type=review的数据（这些数据将迁移到review表）
DELETE FROM `comment` WHERE `target_type` = 'review';

-- 2. 删除target_type字段
ALTER TABLE `comment` DROP COLUMN `target_type`;

