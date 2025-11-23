-- 创建用户解锁章节费用设定表
-- 表名: unlockprice
-- 用途: 设定用户解锁章节的费用（固定费用或随机费用）

CREATE TABLE IF NOT EXISTS `unlockprice` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL COMMENT '用户ID',
  `novel_id` int NOT NULL COMMENT '小说ID',
  `fixed_style` tinyint(1) NOT NULL DEFAULT 1 COMMENT '费用模式（0=随机，1=固定）',
  `fixed_cost` int NOT NULL DEFAULT 20 COMMENT '固定费用值',
  `random_cost_min` int DEFAULT NULL COMMENT '随机费用最小值',
  `random_cost_max` int DEFAULT NULL COMMENT '随机费用最大值',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_novel_id` (`novel_id`),
  KEY `idx_user_novel` (`user_id`, `novel_id`),
  CONSTRAINT `unlockprice_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `unlockprice_ibfk_2` FOREIGN KEY (`novel_id`) REFERENCES `novel` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户解锁章节费用设定表';

