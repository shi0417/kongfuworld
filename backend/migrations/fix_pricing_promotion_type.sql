-- 修复 pricing_promotion 表的 promotion_type 字段
-- 将 ENUM('novel_discount') 更新为 ENUM('discount', 'free')

ALTER TABLE pricing_promotion 
MODIFY COLUMN promotion_type ENUM('discount', 'free') NOT NULL DEFAULT 'discount' COMMENT '促销类型';

-- 如果表中有旧数据，将 'novel_discount' 转换为 'discount'
UPDATE pricing_promotion 
SET promotion_type = 'discount' 
WHERE promotion_type = 'novel_discount';

