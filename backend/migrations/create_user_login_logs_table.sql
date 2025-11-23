-- 创建用户登录日志表
-- 用于记录用户每次登录的IP地址和相关信息

CREATE TABLE IF NOT EXISTS `user_login_logs` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键，自增',
  `user_id` int NOT NULL COMMENT '用户ID，外键关联user表',
  `ip_address` varchar(45) NOT NULL COMMENT 'IP地址（支持IPv4和IPv6）',
  `login_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '登录时间',
  `login_method` enum('password', 'google', 'facebook', 'apple', 'register') NOT NULL DEFAULT 'password' COMMENT '登录方式',
  `user_agent` text COMMENT '用户代理字符串（浏览器/设备信息）',
  `device_type` varchar(50) DEFAULT NULL COMMENT '设备类型（desktop, mobile, tablet等）',
  `location` varchar(100) DEFAULT NULL COMMENT '地理位置（通过IP解析，如：US, CN等）',
  `login_status` enum('success', 'failed') NOT NULL DEFAULT 'success' COMMENT '登录状态',
  `session_id` varchar(255) DEFAULT NULL COMMENT '会话ID',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_ip_address` (`ip_address`),
  KEY `idx_login_time` (`login_time`),
  KEY `idx_user_login_time` (`user_id`, `login_time`),
  CONSTRAINT `fk_user_login_logs_user_id` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户登录日志表';

