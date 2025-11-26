-- 创建编辑申请成为小说编辑的表
-- 用于编辑申请成为某本小说的编辑/主编

CREATE TABLE IF NOT EXISTS `editor_novel_application` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `novel_id` INT NOT NULL COMMENT '小说ID',
  `editor_admin_id` INT NOT NULL COMMENT '申请编辑的 admin_id',
  `reason` TEXT NULL COMMENT '编辑自我推荐理由',
  `status` ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending' COMMENT '申请状态',
  `handled_by_admin_id` INT NULL COMMENT '审批人 admin_id',
  `handled_at` DATETIME NULL COMMENT '审批时间',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '申请时间',
  KEY `idx_novel` (`novel_id`),
  KEY `idx_editor` (`editor_admin_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_apply_novel` FOREIGN KEY (`novel_id`) REFERENCES `novel`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_apply_editor` FOREIGN KEY (`editor_admin_id`) REFERENCES `admin`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_apply_handler` FOREIGN KEY (`handled_by_admin_id`) REFERENCES `admin`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='编辑申请成为小说编辑表';

