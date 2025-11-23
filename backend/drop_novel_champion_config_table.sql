-- 删除 novel_champion_config 表
-- 该表已不再使用，所有配置信息现在只存储在 novel_champion_tiers 表中

-- 1. 删除表（如果存在）
DROP TABLE IF EXISTS `novel_champion_config`;

