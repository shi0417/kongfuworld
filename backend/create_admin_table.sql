-- 创建 admin 表
CREATE TABLE IF NOT EXISTS `admin` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '管理员用户名',
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '密码（明文存储，实际应该使用哈希）',
  `level` int DEFAULT 1 COMMENT '管理员级别（1=普通管理员，2=超级管理员）',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入初始管理员数据
INSERT INTO `admin` (`id`, `name`, `password`, `level`) VALUES
(1, 'adminshi', '123456', 1)
ON DUPLICATE KEY UPDATE `name`=`name`;

