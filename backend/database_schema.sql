-- 数据库表结构SQL语句
-- 数据库名: kongfuworld
-- 导出时间: 2025/7/16 14:32:34


-- 表: chapter
CREATE TABLE `chapter` (
  `id` int NOT NULL AUTO_INCREMENT,
  `novel_id` int NOT NULL,
  `volume_id` int NOT NULL,
  `chapter_number` int NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `translator_note` text COLLATE utf8mb4_unicode_ci,
  `is_advance` tinyint(1) DEFAULT '0' COMMENT '是否为预读章节（0=否，1=预读）',
  `unlock_price` int DEFAULT '0' COMMENT '解锁所需钥匙数量（0表示免费）',
  `review_status` enum('submitted','reviewing','approved','rejected','draft') DEFAULT 'submitted' COMMENT '审核状态: submitted=提交中, reviewing=审核中, approved=审核通过, rejected=审核不通过, draft=草稿',
  `is_released` tinyint(1) DEFAULT '1' COMMENT '是否已发布（0=未发布，1=已发布）',
  `release_date` datetime DEFAULT NULL COMMENT '发布日期',
  PRIMARY KEY (`id`),
  KEY `novel_id` (`novel_id`),
  CONSTRAINT `chapter_ibfk_1` FOREIGN KEY (`novel_id`) REFERENCES `novel` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: chapter_unlock
CREATE TABLE `chapter_unlock` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `chapter_id` int NOT NULL,
  `unlock_type` enum('key','karma','wtu') COLLATE utf8mb4_unicode_ci NOT NULL,
  `unlocked_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`,`chapter_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: comment
CREATE TABLE `comment` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `target_id` int NOT NULL COMMENT '章节ID，comment表只存储章节评论',
  `novel_id` int DEFAULT NULL COMMENT '小说ID，从chapter表关联获取',
  `parent_comment_id` int DEFAULT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `likes` int DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_novel_id` (`novel_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: favorite
CREATE TABLE `favorite` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `novel_id` int NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: notifications
CREATE TABLE `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,//用户ID
  `novel_id` int DEFAULT NULL,  //小说ID
  `chapter_id` int DEFAULT NULL,//章节ID
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL, //标题
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,//消息
  `type` enum('news','unlock','chapter','comment','system') COLLATE utf8mb4_unicode_ci NOT NULL,//类型
  `link` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,//链接
  `is_read` tinyint(1) DEFAULT '0',//是否已读
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,//创建时间
  PRIMARY KEY (`id`)//主键
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: novel
CREATE TABLE `novel` (
  `id` int NOT NULL AUTO_INCREMENT,//小说ID
  `user_id` int DEFAULT NULL COMMENT '作者用户ID',//作者用户ID，外键关联user表
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,//小说标题
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL, //状态
  `cover` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,//封面图片
  `rating` int DEFAULT '0',//评分
  `reviews` int DEFAULT '0',//评论数
  `author` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,//作者
  `translator` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,//翻译者
  `description` text COLLATE utf8mb4_unicode_ci,//简介
  `recommendation` text COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '推荐语',//推荐语
  `languages` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '支持的语言（如：en,zh,es，多个语言用逗号分隔）',//支持的语言
  `chapters` int DEFAULT '0',//章节数
  `licensed_from` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,//版权来源
  `review_status` enum('created','submitted','reviewing','approved','published','unlisted','archived','locked') DEFAULT 'created' COMMENT '审核状态: created=草稿/已创建, submitted=已提交, reviewing=审核中, approved=审核通过, published=已上架, unlisted=已下架, archived=已归档, locked=已锁定/违规锁定',//审核状态
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_review_status` (`review_status`),
  CONSTRAINT `novel_ibfk_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: payment_record
CREATE TABLE `payment_record` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `payment_method` enum('alipay','wechat','paypal','stripe') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending','completed','failed') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `type` enum('recharge','chapter_purchase','champion_subscribe','karma_reward') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'recharge',
  `description` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `payment_record_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: reading_log
CREATE TABLE `reading_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `chapter_id` int NOT NULL,
  `read_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: review
CREATE TABLE `review` (
  `id` int NOT NULL AUTO_INCREMENT,
  `parent_id` int DEFAULT NULL COMMENT '父评论ID，用于存储对该评论的子评论',
  `novel_id` int NOT NULL,
  `user_id` int NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci,
  `rating` int DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `likes` int DEFAULT '0',
  `comments` int DEFAULT '0',
  `views` int DEFAULT '0',
  `is_recommended` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `novel_id` (`novel_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `review_ibfk_1` FOREIGN KEY (`novel_id`) REFERENCES `novel` (`id`),
  CONSTRAINT `review_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: subscription
CREATE TABLE `subscription` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `novel_id` int NOT NULL,
  `start_date` datetime DEFAULT NULL,
  `end_date` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: user
CREATE TABLE `user` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `avatar` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_vip` tinyint(1) DEFAULT '0',
  `is_author` tinyint(1) DEFAULT '0' COMMENT '是否是作者',
  `pen_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '笔名',
  `bio` text COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '作者简介',
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `confirmed_email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '已验证的邮箱地址',
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `balance` decimal(10,2) DEFAULT '0.00',
  `points` int DEFAULT '0',
  `vip_expire_at` datetime DEFAULT NULL,
  `karma` int DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `last_login_at` datetime DEFAULT NULL,
  `status` enum('active','banned') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `settings_json` json DEFAULT NULL,
  `social_links` json DEFAULT NULL COMMENT '社交媒体链接',
  `referrer_id` int DEFAULT NULL COMMENT '推荐人用户ID',
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_pen_name` (`pen_name`),
  KEY `idx_is_author` (`is_author`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: languages
CREATE TABLE `languages` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '语言ID',
  `language` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '语言名称',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_language` (`language`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='语言表';

-- 表: protagonist
CREATE TABLE `protagonist` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主角ID',
  `novel_id` int NOT NULL COMMENT '小说ID',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '主角名',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_novel_id` (`novel_id`),
  CONSTRAINT `protagonist_ibfk_novel` FOREIGN KEY (`novel_id`) REFERENCES `novel` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='主角名表';

-- 表: volume
CREATE TABLE `volume` (
  `id` int NOT NULL AUTO_INCREMENT,
  `novel_id` int NOT NULL,
  `volume_id` int NOT NULL COMMENT '卷ID（用于关联章节）',
  `title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '卷标题',
  `start_chapter` int DEFAULT NULL COMMENT '起始章节号',
  `end_chapter` int DEFAULT NULL COMMENT '结束章节号',
  `chapter_count` int DEFAULT 0 COMMENT '章节数量',
  PRIMARY KEY (`id`),
  KEY `novel_id` (`novel_id`),
  CONSTRAINT `volume_ibfk_1` FOREIGN KEY (`novel_id`) REFERENCES `novel` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 表: randomNotes
CREATE TABLE `randomNotes` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '随记ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `novel_id` int NOT NULL COMMENT '小说ID',
  `random_note` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '随记内容',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_novel_id` (`novel_id`),
  KEY `idx_user_novel` (`user_id`, `novel_id`),
  CONSTRAINT `randomNotes_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `randomNotes_ibfk_2` FOREIGN KEY (`novel_id`) REFERENCES `novel` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='随记表';

-- 表: draft
CREATE TABLE `draft` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '草稿ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `novel_id` int NOT NULL COMMENT '小说ID',
  `chapter_id` int DEFAULT NULL COMMENT '章节ID（编辑已有章节时关联，新建章节时为NULL）',
  `chapter_number` int NOT NULL COMMENT '章节号',
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '章节标题',
  `content` text COLLATE utf8mb4_unicode_ci COMMENT '章节内容',
  `translator_note` text COLLATE utf8mb4_unicode_ci COMMENT '译者备注/作者有话说',
  `word_count` int DEFAULT '0' COMMENT '字数统计',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间（定时保存时间）',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_novel_id` (`novel_id`),
  KEY `idx_chapter_id` (`chapter_id`),
  KEY `idx_user_novel_chapter` (`user_id`, `novel_id`, `chapter_number`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `draft_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `draft_ibfk_2` FOREIGN KEY (`novel_id`) REFERENCES `novel` (`id`) ON DELETE CASCADE,
  CONSTRAINT `draft_ibfk_3` FOREIGN KEY (`chapter_id`) REFERENCES `chapter` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='草稿表，存储作者定时保存的章节内容';

-- 表: scheduledrelease
CREATE TABLE `scheduledrelease` (
  `id` int NOT NULL AUTO_INCREMENT,
  `novel_id` int NOT NULL COMMENT '小说ID',
  `chapter_id` int NOT NULL COMMENT '章节ID',
  `release_time` datetime NOT NULL COMMENT '计划发布时间',
  `is_released` tinyint(1) DEFAULT '0' COMMENT '是否已发布（0=未发布，1=已发布）',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_novel_id` (`novel_id`),
  KEY `idx_chapter_id` (`chapter_id`),
  KEY `idx_release_time` (`release_time`),
  KEY `idx_is_released` (`is_released`),
  CONSTRAINT `scheduledrelease_ibfk_1` FOREIGN KEY (`novel_id`) REFERENCES `novel` (`id`) ON DELETE CASCADE,
  CONSTRAINT `scheduledrelease_ibfk_2` FOREIGN KEY (`chapter_id`) REFERENCES `chapter` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='定时发布管理表';

-- 表: report
CREATE TABLE `report` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键，自增',
  `user_id` int NOT NULL COMMENT '举报用户的ID',
  `type` enum('review','comment','paragraph_comment') NOT NULL COMMENT '举报类型：review=评价, comment=评论, paragraph_comment=段落评论',
  `remark_id` int NOT NULL COMMENT '被举报内容的ID（根据type对应review.id、comment.id或paragraph_comment.id）',
  `report` enum('Spoilers','Abuse or harassment','Spam','Copyright infringement','Discrimination (racism, sexism, etc.)','Request to delete a comment that you created') NOT NULL COMMENT '举报原因',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_type_remark_id` (`type`, `remark_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `report_ibfk_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户举报表';
