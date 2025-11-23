-- 删除novel表中的total_chapters字段，改用chapters字段
-- 执行时间: 2025-01-XX

-- 检查字段是否存在，如果存在则删除
-- 注意：这个操作会删除数据，请确保数据已经迁移到chapters字段

ALTER TABLE `novel` DROP COLUMN IF EXISTS `total_chapters`;

-- 如果MySQL版本不支持IF EXISTS，可以使用以下方式：
-- SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS 
--                WHERE TABLE_SCHEMA = 'kongfuworld' 
--                AND TABLE_NAME = 'novel' 
--                AND COLUMN_NAME = 'total_chapters');
-- SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE `novel` DROP COLUMN `total_chapters`', 'SELECT "Column does not exist"');
-- PREPARE stmt FROM @sqlstmt;
-- EXECUTE stmt;
-- DEALLOCATE PREPARE stmt;

