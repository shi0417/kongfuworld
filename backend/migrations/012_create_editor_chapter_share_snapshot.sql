-- Phase 4: 章节归属快照表
-- 记录每一章最终归属哪个责任编辑，用于分成统计

CREATE TABLE IF NOT EXISTS `editor_chapter_share_snapshot` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `novel_id` INT NOT NULL,
  `chapter_id` INT NOT NULL,
  `editor_admin_id` INT NOT NULL COMMENT '该章节最终归属的责任编辑',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_chapter` (`chapter_id`),
  KEY `idx_editor_novel` (`editor_admin_id`, `novel_id`),
  CONSTRAINT `fk_snapshot_novel` FOREIGN KEY (`novel_id`) REFERENCES `novel`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_snapshot_chapter` FOREIGN KEY (`chapter_id`) REFERENCES `chapter`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_snapshot_editor` FOREIGN KEY (`editor_admin_id`) REFERENCES `admin`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uniq_chapter` (`chapter_id`) COMMENT '每章只生成一条记录'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

