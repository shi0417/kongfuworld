-- 创建 languages 表
CREATE TABLE IF NOT EXISTS `languages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `language` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '语言名称',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_language` (`language`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='语言表';

-- 插入默认语言数据
INSERT INTO `languages` (`language`) VALUES
('Chinese'),
('Korean'),
('English')
ON DUPLICATE KEY UPDATE `language` = VALUES(`language`);

