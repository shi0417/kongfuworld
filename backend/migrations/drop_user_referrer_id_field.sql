-- 删除user表中的referrer_id字段
-- 因为已经使用referrals表来管理推荐关系

-- 首先删除外键约束（如果存在）
SET @fk_name = (
  SELECT CONSTRAINT_NAME 
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'user' 
    AND COLUMN_NAME = 'referrer_id'
    AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);

SET @sql = IF(@fk_name IS NOT NULL, 
  CONCAT('ALTER TABLE `user` DROP FOREIGN KEY `', @fk_name, '`'),
  'SELECT "No foreign key found"'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 删除索引（如果存在）
ALTER TABLE `user` DROP INDEX IF EXISTS `idx_referrer_id`;

-- 删除referrer_id字段
ALTER TABLE `user` DROP COLUMN IF EXISTS `referrer_id`;

