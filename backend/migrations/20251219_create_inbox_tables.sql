-- 站内信系统数据库表结构
-- 执行时间：2025-12-19

-- 1. 会话表
CREATE TABLE IF NOT EXISTS `conversations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `subject` varchar(255) NOT NULL COMMENT '会话主题',
  `category` enum('contract','recommendation','settlement','general') NOT NULL DEFAULT 'general' COMMENT '分类：contract=签约, recommendation=推荐, settlement=结算, general=一般',
  `status` enum('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open' COMMENT '状态：open=待处理, in_progress=进行中, resolved=已解决, closed=已关闭',
  `priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal' COMMENT '优先级',
  `assigned_to` int DEFAULT NULL COMMENT '分配给的管理员ID（admin.id）',
  `related_novel_id` int DEFAULT NULL COMMENT '关联的小说ID（novel.id）',
  `internal_note` text COMMENT '内部备注（仅管理员可见）',
  `created_by` int NOT NULL COMMENT '创建者用户ID（user.id）',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `resolved_at` datetime DEFAULT NULL COMMENT '解决时间',
  `closed_at` datetime DEFAULT NULL COMMENT '关闭时间',
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_category` (`category`),
  KEY `idx_assigned_to` (`assigned_to`),
  KEY `idx_created_by` (`created_by`),
  KEY `idx_related_novel` (`related_novel_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_conversations_assigned_to` FOREIGN KEY (`assigned_to`) REFERENCES `admin` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_conversations_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_conversations_novel` FOREIGN KEY (`related_novel_id`) REFERENCES `novel` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会话表';

-- 2. 会话参与者表
CREATE TABLE IF NOT EXISTS `conversation_participants` (
  `id` int NOT NULL AUTO_INCREMENT,
  `conversation_id` int NOT NULL COMMENT '会话ID',
  `user_id` int DEFAULT NULL COMMENT '用户ID（user.id，作者）',
  `admin_id` int DEFAULT NULL COMMENT '管理员ID（admin.id，编辑/运营）',
  `role` enum('author','admin','system') NOT NULL DEFAULT 'author' COMMENT '角色：author=作者, admin=管理员, system=系统',
  `joined_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '加入时间',
  `left_at` datetime DEFAULT NULL COMMENT '离开时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_conversation_user` (`conversation_id`, `user_id`, `admin_id`),
  KEY `idx_conversation_id` (`conversation_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_admin_id` (`admin_id`),
  CONSTRAINT `fk_participants_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_participants_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_participants_admin` FOREIGN KEY (`admin_id`) REFERENCES `admin` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会话参与者表';

-- 3. 消息表
CREATE TABLE IF NOT EXISTS `messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `conversation_id` int NOT NULL COMMENT '会话ID',
  `sender_id` int DEFAULT NULL COMMENT '发送者用户ID（user.id）',
  `sender_admin_id` int DEFAULT NULL COMMENT '发送者管理员ID（admin.id）',
  `sender_type` enum('author','admin','system') NOT NULL COMMENT '发送者类型',
  `content` text NOT NULL COMMENT '消息内容',
  `internal_note` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否为内部备注（仅管理员可见）',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_conversation_id` (`conversation_id`),
  KEY `idx_conversation_created` (`conversation_id`, `id`),
  KEY `idx_sender_user` (`sender_id`),
  KEY `idx_sender_admin` (`sender_admin_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_messages_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_messages_sender_user` FOREIGN KEY (`sender_id`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_messages_sender_admin` FOREIGN KEY (`sender_admin_id`) REFERENCES `admin` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='消息表';

-- 4. 消息附件表
CREATE TABLE IF NOT EXISTS `message_attachments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `message_id` int NOT NULL COMMENT '消息ID',
  `file_name` varchar(255) NOT NULL COMMENT '文件名',
  `file_path` varchar(500) NOT NULL COMMENT '文件路径',
  `file_size` bigint NOT NULL COMMENT '文件大小（字节）',
  `file_type` varchar(100) DEFAULT NULL COMMENT '文件类型（MIME）',
  `uploaded_by` int DEFAULT NULL COMMENT '上传者ID（user.id 或 admin.id）',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_message_id` (`message_id`),
  CONSTRAINT `fk_attachments_message` FOREIGN KEY (`message_id`) REFERENCES `messages` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='消息附件表';

-- 5. 会话已读状态表
CREATE TABLE IF NOT EXISTS `conversation_reads` (
  `id` int NOT NULL AUTO_INCREMENT,
  `conversation_id` int NOT NULL COMMENT '会话ID',
  `user_id` int DEFAULT NULL COMMENT '用户ID（user.id）',
  `admin_id` int DEFAULT NULL COMMENT '管理员ID（admin.id）',
  `last_read_message_id` int DEFAULT NULL COMMENT '最后已读消息ID',
  `last_read_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '最后阅读时间',
  `unread_count` int NOT NULL DEFAULT 0 COMMENT '未读消息数',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_conversation_user` (`conversation_id`, `user_id`, `admin_id`),
  KEY `idx_conversation_id` (`conversation_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_admin_id` (`admin_id`),
  CONSTRAINT `fk_reads_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reads_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reads_admin` FOREIGN KEY (`admin_id`) REFERENCES `admin` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reads_message` FOREIGN KEY (`last_read_message_id`) REFERENCES `messages` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会话已读状态表';

-- 6. 会话关联表（可选，用于关联其他实体）
CREATE TABLE IF NOT EXISTS `conversation_links` (
  `id` int NOT NULL AUTO_INCREMENT,
  `conversation_id` int NOT NULL COMMENT '会话ID',
  `link_type` enum('novel','chapter','contract','payment') NOT NULL COMMENT '关联类型',
  `link_id` int NOT NULL COMMENT '关联实体ID',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_conversation_id` (`conversation_id`),
  KEY `idx_link` (`link_type`, `link_id`),
  CONSTRAINT `fk_links_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会话关联表';

