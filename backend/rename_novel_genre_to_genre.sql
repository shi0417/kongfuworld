-- 将 novel_genre 表重命名为 genre
-- 注意：需要先删除相关的外键约束，重命名表，然后重新创建外键约束

-- 1. 删除 novel_genre_relation 表中的外键约束（引用 novel_genre）
ALTER TABLE `novel_genre_relation` 
DROP FOREIGN KEY IF EXISTS `novel_genre_relation_ibfk_2`;

-- 2. 重命名表
RENAME TABLE `novel_genre` TO `genre`;

-- 3. 重新创建外键约束
ALTER TABLE `novel_genre_relation` 
ADD CONSTRAINT `novel_genre_relation_ibfk_2` 
FOREIGN KEY (`genre_id`) REFERENCES `genre` (`id`) ON DELETE CASCADE;

