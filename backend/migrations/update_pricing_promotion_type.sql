-- 更新 pricing_promotion 表的 promotion_type 字段
-- 如果表已经存在且 promotion_type 字段是 'novel_discount'，需要更新为支持 'discount' 和 'free'

-- 方法1：如果表不存在，直接创建（已在 add_pricing_system_fields.sql 中处理）
-- 方法2：如果表已存在，需要修改 ENUM 值

-- 检查并修改 promotion_type 字段
ALTER TABLE pricing_promotion 
MODIFY COLUMN promotion_type ENUM('discount', 'free') NOT NULL DEFAULT 'discount' COMMENT '促销类型';

