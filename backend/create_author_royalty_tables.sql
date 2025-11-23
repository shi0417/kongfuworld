-- 作者分成方案和合同表
-- 用于支持不同作者/不同作品/不同时间段的作者分成比例

-- 1. 作者分成方案模板表
CREATE TABLE IF NOT EXISTS `author_royalty_plan` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL COMMENT '方案名称，如：Default 50% / VIP 60%',
  `royalty_percent` DECIMAL(10,8) NOT NULL COMMENT '作者分成比例（高精度）：0.50000000表示50%，0.60000000表示60%',
  `is_default` TINYINT NOT NULL DEFAULT 0 COMMENT '是否当前全站默认方案',
  `owner_user_id` BIGINT NULL COMMENT '若为定制方案，可填拥有者user_id',
  `start_date` DATETIME NOT NULL COMMENT '生效开始时间',
  `end_date` DATETIME NULL COMMENT '结束时间（NULL表示仍有效）',
  `remark` VARCHAR(255) NULL COMMENT '备注',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_is_default` (`is_default`),
  KEY `idx_start_date` (`start_date`),
  KEY `idx_owner_user_id` (`owner_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='作者分成方案模板表';

-- 2. 作品-分成方案"合同"表
CREATE TABLE IF NOT EXISTS `novel_royalty_contract` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `novel_id` INT NOT NULL COMMENT '小说ID',
  `author_id` INT NOT NULL COMMENT '作者用户ID',
  `plan_id` BIGINT NOT NULL COMMENT '对应author_royalty_plan.id',
  `effective_from` DATETIME NOT NULL COMMENT '合同生效时间',
  `effective_to` DATETIME NULL COMMENT '合同结束时间（NULL表示仍有效）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_nrc_novel` FOREIGN KEY (`novel_id`) REFERENCES `novel` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_nrc_author` FOREIGN KEY (`author_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_nrc_plan` FOREIGN KEY (`plan_id`) REFERENCES `author_royalty_plan` (`id`) ON DELETE CASCADE,
  KEY `idx_nrc_novel_time` (`novel_id`, `effective_from`, `effective_to`),
  KEY `idx_nrc_author` (`author_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='作品-分成方案合同表';

-- 插入默认的作者分成方案（50%）
INSERT INTO `author_royalty_plan` (`name`, `royalty_percent`, `is_default`, `start_date`) 
VALUES ('Default 50%', 0.5000, 1, '2025-01-01 00:00:00')
ON DUPLICATE KEY UPDATE `name`=`name`;

