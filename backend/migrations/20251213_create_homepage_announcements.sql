-- 创建首页公告表：homepage_announcements
-- 用途：Wuxiaworld 风格首页 V2 - Announcements 模块数据源
-- 说明：支持 is_active + 时间窗（start_date/end_date）+ display_order 排序

CREATE TABLE IF NOT EXISTS `homepage_announcements` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL COMMENT '公告标题',
  `content` text NULL COMMENT '公告内容（可选）',
  `link_url` varchar(500) NULL COMMENT '跳转链接（可选）',
  `display_order` int NOT NULL DEFAULT 0 COMMENT '显示顺序（越小越靠前）',
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  `start_date` datetime DEFAULT NULL COMMENT '开始展示时间',
  `end_date` datetime DEFAULT NULL COMMENT '结束展示时间',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_active_order` (`is_active`, `display_order`),
  KEY `idx_active_window` (`is_active`, `start_date`, `end_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='首页公告（V2）';


