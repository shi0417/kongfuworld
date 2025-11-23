-- 创建 protagonist（主角名）表
CREATE TABLE IF NOT EXISTS `protagonist` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主角ID',
  `novel_id` int NOT NULL COMMENT '小说ID',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '主角名',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_novel_id` (`novel_id`),
  CONSTRAINT `protagonist_ibfk_novel` FOREIGN KEY (`novel_id`) REFERENCES `novel` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='主角名表';

