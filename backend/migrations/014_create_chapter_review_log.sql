-- Phase 3: 创建章节审核日志表
-- 记录章节审核的完整历史

CREATE TABLE IF NOT EXISTS `chapter_review_log` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `chapter_id` INT NOT NULL COMMENT '章节ID',
  `admin_id` INT NOT NULL COMMENT '审核人ID',
  `admin_role` ENUM('editor','chief_editor','super_admin') NOT NULL COMMENT '审核人角色',
  `action` ENUM('submit','start_review','approved','rejected','reviewing') NOT NULL COMMENT '审核动作',
  `comment` TEXT NULL COMMENT '审核备注',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  KEY `idx_chapter` (`chapter_id`),
  KEY `idx_admin` (`admin_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_review_log_chapter` FOREIGN KEY (`chapter_id`) REFERENCES `chapter`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_review_log_admin` FOREIGN KEY (`admin_id`) REFERENCES `admin`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='章节审核日志表';

