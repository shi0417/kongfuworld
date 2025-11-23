-- 在 genre 表中插入 "other" 类型
-- 如果已存在则忽略

INSERT IGNORE INTO `genre` (`name`, `slug`, `chinese_name`, `is_active`) VALUES
('other', 'other', '其他小说', 1);

