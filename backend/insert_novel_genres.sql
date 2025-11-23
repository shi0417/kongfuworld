-- 插入小说类型到 genre 表
-- 如果类型不存在则插入，如果存在则忽略

INSERT IGNORE INTO `genre` (`name`, `slug`, `chinese_name`, `is_active`) VALUES
('Cheat Systems', 'cheat-systems', '作弊系统', 1),
('Comedy', 'comedy', '喜剧小说', 1),
('Cultivation', 'cultivation', '修仙小说', 1),
('Fantasy', 'fantasy', '奇幻小说', 1),
('LitRPG', 'litrpg', '游戏小说', 1),
('Mystery', 'mystery', '悬疑小说', 1),
('Romance', 'romance', '言情小说', 1),
('Sci-fi', 'sci-fi', '科幻小说', 1),
('Slice of Life', 'slice-of-life', '日常小说', 1),
('Sports', 'sports', '体育小说', 1),
('Thriller', 'thriller', '惊悚小说', 1);

-- 更新 Sci-Fi 为 Sci-fi（如果存在）
UPDATE `genre` SET `name` = 'Sci-fi' WHERE `name` = 'Sci-Fi';

