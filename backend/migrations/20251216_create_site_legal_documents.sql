-- 创建站点政策文档表：site_legal_documents
-- 用途：管理 Terms of Service、Privacy Policy、Cookie Policy 等政策文档
-- 说明：支持版本管理、多语言、发布状态、当前生效版本

CREATE TABLE IF NOT EXISTS `site_legal_documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `doc_key` varchar(64) NOT NULL COMMENT '文档类型：terms_of_service | privacy_policy | cookie_policy',
  `language` varchar(16) NOT NULL DEFAULT 'en' COMMENT '语言代码',
  `title` varchar(255) NOT NULL COMMENT '文档标题',
  `version` varchar(64) NOT NULL COMMENT '版本号',
  `content_md` longtext NOT NULL COMMENT 'Markdown 格式内容',
  `status` enum('draft','published','archived') NOT NULL DEFAULT 'draft' COMMENT '状态：草稿/已发布/已归档',
  `is_current` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否为当前生效版本（同一 doc_key+language 只能有一个为 1）',
  `effective_at` datetime DEFAULT NULL COMMENT '生效时间',
  `created_by` int DEFAULT NULL COMMENT '创建者 admin.id',
  `updated_by` int DEFAULT NULL COMMENT '最后更新者 admin.id',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_doc_key_lang` (`doc_key`, `language`),
  KEY `idx_status_current` (`status`, `is_current`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='站点政策文档表';

-- 插入三条默认 draft 记录（Terms/Privacy/Cookie，en）
INSERT INTO `site_legal_documents` (`doc_key`, `language`, `title`, `version`, `content_md`, `status`, `is_current`) VALUES
('terms_of_service', 'en', 'Terms of Service', '1.0.0', '# Terms of Service\n\nThis is a draft. Please edit this content.', 'draft', 0),
('privacy_policy', 'en', 'Privacy Policy', '1.0.0', '# Privacy Policy\n\nThis is a draft. Please edit this content.', 'draft', 0),
('cookie_policy', 'en', 'Cookie Policy', '1.0.0', '# Cookie Policy\n\nThis is a draft. Please edit this content.', 'draft', 0);

