-- 为 novel 表添加 champion_is_active 字段，控制该小说的 champion 功能选项卡是否集成到该小说里
-- 默认值为 0（不启用），1 表示启用

ALTER TABLE `novel` 
ADD COLUMN `champion_is_active` tinyint(1) 
DEFAULT 0 
COMMENT '控制该小说的 champion 功能选项卡是否集成到该小说里，0=不启用，1=启用'
AFTER `review_status`;

-- 为现有小说设置默认值为 0（不启用）
UPDATE `novel` 
SET `champion_is_active` = 0 
WHERE `champion_is_active` IS NULL;

