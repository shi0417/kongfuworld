-- 修改 novel_genre_relation 表结构
-- 1. 删除触发器（如果存在）
DROP TRIGGER IF EXISTS `sync_genre_relation_fields`;
DROP TRIGGER IF EXISTS `sync_genre_relation_fields_update`;

-- 2. 删除外键约束
ALTER TABLE `novel_genre_relation` 
DROP FOREIGN KEY IF EXISTS `novel_genre_relation_ibfk_2`;

-- 3. 删除旧索引
ALTER TABLE `novel_genre_relation` 
DROP INDEX IF EXISTS `unique_novel_genre`,
DROP INDEX IF EXISTS `genre_id`;

-- 4. 删除冗余字段
ALTER TABLE `novel_genre_relation` 
DROP COLUMN IF EXISTS `genre_name`,
DROP COLUMN IF EXISTS `genre_chinese_name`;

-- 5. 重命名 genre_id 为 genre_id_1
ALTER TABLE `novel_genre_relation` 
CHANGE COLUMN `genre_id` `genre_id_1` int NOT NULL;

-- 6. 添加 genre_id_2 字段
ALTER TABLE `novel_genre_relation` 
ADD COLUMN `genre_id_2` int DEFAULT NULL COMMENT '第二类型ID' AFTER `genre_id_1`;

-- 7. 添加 updated_at 字段
ALTER TABLE `novel_genre_relation` 
ADD COLUMN `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间' AFTER `created_at`;

-- 8. 创建唯一索引 (id, novel_id)
ALTER TABLE `novel_genre_relation` 
ADD UNIQUE KEY `unique_id_novel` (`id`, `novel_id`);

-- 9. 重新创建外键约束（genre_id_1）
ALTER TABLE `novel_genre_relation` 
ADD CONSTRAINT `novel_genre_relation_ibfk_2` 
FOREIGN KEY (`genre_id_1`) REFERENCES `genre` (`id`) ON DELETE CASCADE;

-- 10. 添加 genre_id_2 的外键约束
ALTER TABLE `novel_genre_relation` 
ADD CONSTRAINT `novel_genre_relation_ibfk_3` 
FOREIGN KEY (`genre_id_2`) REFERENCES `genre` (`id`) ON DELETE SET NULL;

