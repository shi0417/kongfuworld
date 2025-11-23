-- 收费系统重构：添加按字数计价和促销系统支持
-- 执行时间：2025-01-XX

-- 创建存储过程来安全地添加字段（如果不存在）
DELIMITER $$

DROP PROCEDURE IF EXISTS AddColumnIfNotExists$$
CREATE PROCEDURE AddColumnIfNotExists(
    IN tableName VARCHAR(64),
    IN columnName VARCHAR(64),
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
        SET @sql = CONCAT('ALTER TABLE ', tableName, ' ADD COLUMN ', columnName, ' ', columnDefinition);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$

DROP PROCEDURE IF EXISTS DropColumnIfExists$$
CREATE PROCEDURE DropColumnIfExists(
    IN tableName VARCHAR(64),
    IN columnName VARCHAR(64)
)
BEGIN
    DECLARE columnExists INT DEFAULT 0;
    
    SELECT COUNT(*) INTO columnExists
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = tableName
      AND COLUMN_NAME = columnName;
    
    IF columnExists > 0 THEN
        SET @sql = CONCAT('ALTER TABLE ', tableName, ' DROP COLUMN ', columnName);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$

DELIMITER ;

-- 1. 修改 unlockprice 表，添加新字段
CALL AddColumnIfNotExists('unlockprice', 'karma_per_1000', 'INT NOT NULL DEFAULT 6 COMMENT ''每1000字需要的karma数量'' AFTER novel_id');
CALL AddColumnIfNotExists('unlockprice', 'min_karma', 'INT NOT NULL DEFAULT 5 COMMENT ''单章价格下限'' AFTER karma_per_1000');
CALL AddColumnIfNotExists('unlockprice', 'max_karma', 'INT NOT NULL DEFAULT 30 COMMENT ''单章价格上限'' AFTER min_karma');
CALL AddColumnIfNotExists('unlockprice', 'default_free_chapters', 'INT NOT NULL DEFAULT 50 COMMENT ''前多少章免费'' AFTER max_karma');
CALL AddColumnIfNotExists('unlockprice', 'pricing_style', 'ENUM(''per_word'') NOT NULL DEFAULT ''per_word'' COMMENT ''计价模式'' AFTER default_free_chapters');

-- 删除旧字段（如果存在）
CALL DropColumnIfExists('unlockprice', 'fixed_style');
CALL DropColumnIfExists('unlockprice', 'fixed_cost');
CALL DropColumnIfExists('unlockprice', 'random_cost_min');
CALL DropColumnIfExists('unlockprice', 'random_cost_max');

-- 清理存储过程
DROP PROCEDURE IF EXISTS AddColumnIfNotExists;
DROP PROCEDURE IF EXISTS DropColumnIfExists;

-- 2. 创建 pricing_promotion 表（促销活动表）
CREATE TABLE IF NOT EXISTS pricing_promotion (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  novel_id INT NOT NULL COMMENT '小说ID',
  promotion_type ENUM('discount', 'free') NOT NULL DEFAULT 'discount' COMMENT '促销类型',
  discount_value DECIMAL(10,4) NOT NULL COMMENT '折扣值 0~1，0=限时免费，0.8=8折，1.0=原价',
  start_at DATETIME NOT NULL COMMENT '活动开始时间',
  end_at DATETIME NOT NULL COMMENT '活动结束时间',
  status ENUM('pending', 'approved', 'rejected', 'scheduled', 'active', 'expired') 
         NOT NULL DEFAULT 'pending' COMMENT '活动状态',
  created_by INT NOT NULL COMMENT '发起人user_id',
  created_role ENUM('author', 'admin') NOT NULL DEFAULT 'author' COMMENT '发起人角色',
  approved_by INT NULL COMMENT '审核人user_id',
  approved_at DATETIME NULL COMMENT '审核时间',
  remark VARCHAR(255) NULL COMMENT '备注/审核意见',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_promotion_novel_time (novel_id, start_at, end_at),
  INDEX idx_promotion_status (status),
  FOREIGN KEY (novel_id) REFERENCES novel(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='促销活动表';

-- 3. 自动统计 word_count 为 0 或 NULL 的章节字数
-- 将 word_count 为 0 或 NULL 的章节，根据 content 字段自动计算字数（去除空格）
UPDATE chapter 
SET word_count = LENGTH(REPLACE(COALESCE(content, ''), ' ', ''))
WHERE (word_count IS NULL OR word_count = 0) 
  AND content IS NOT NULL 
  AND content != '';
