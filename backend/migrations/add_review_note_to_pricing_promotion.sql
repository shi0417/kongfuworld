-- 为 pricing_promotion 表添加 review_note 字段（平台回复）
-- 用于运营审核后给作者的回复

-- 使用存储过程安全添加字段
DELIMITER $$

DROP PROCEDURE IF EXISTS AddColumnIfNotExists$$
CREATE PROCEDURE AddColumnIfNotExists(
    IN tableName VARCHAR(255),
    IN columnName VARCHAR(255),
    IN columnDefinition TEXT
)
BEGIN
    DECLARE columnExists INT DEFAULT 0;
    
    SELECT COUNT(*) INTO columnExists
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = tableName
      AND COLUMN_NAME = columnName;
    
    IF columnExists = 0 THEN
        SET @sql = CONCAT('ALTER TABLE `', tableName, '` ADD COLUMN `', columnName, '` ', columnDefinition);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$

DELIMITER ;

-- 添加 review_note 字段
CALL AddColumnIfNotExists('pricing_promotion', 'review_note', 'TEXT NULL COMMENT ''平台回复：运营审核后给作者的回复'' AFTER remark');

-- 清理存储过程
DROP PROCEDURE IF EXISTS AddColumnIfNotExists;

