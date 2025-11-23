-- 查询 pricing_promotion 表的结构，特别是 promotion_type 字段的 ENUM 值
SELECT 
    COLUMN_NAME,
    COLUMN_TYPE,
    COLUMN_DEFAULT,
    IS_NULLABLE,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'pricing_promotion'
  AND COLUMN_NAME = 'promotion_type';

