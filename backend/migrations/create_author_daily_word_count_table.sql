-- 创建作者每日更新字数变更记录表
-- 用于记录每次章节发布/重新发布时的字数变更
-- 支持同一章节多次修改，日历统计时按日期聚合 SUM(word_delta)

CREATE TABLE IF NOT EXISTS `author_daily_word_count` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `author_id` INT NOT NULL COMMENT 'user.id，作者',
  `novel_id` INT NOT NULL COMMENT 'novel.id，作品',
  `chapter_id` INT NOT NULL COMMENT 'chapter.id，章节',
  `date` DATE NOT NULL COMMENT '自然日（按发布日期）',
  `word_count_before` INT NOT NULL DEFAULT 0 COMMENT '本次发布前，该章节已发布版本的字数（没有历史发布则为0）',
  `word_count_after` INT NOT NULL DEFAULT 0 COMMENT '本次发布后，该章节当前版本的字数',
  `word_delta` INT NOT NULL DEFAULT 0 COMMENT '本次发布实际增加字数 = after - before',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_author_date` (`author_id`, `date`),
  KEY `idx_author_novel_date` (`author_id`, `novel_id`, `date`),
  KEY `idx_chapter` (`chapter_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='作者每日更新字数变更记录表';

