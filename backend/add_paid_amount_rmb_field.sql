-- 为 user_income_monthly 表添加 paid_amount_rmb 字段
-- 用于记录人民币支付金额

ALTER TABLE user_income_monthly 
ADD COLUMN paid_amount_rmb DECIMAL(10, 6) DEFAULT 0.000000 COMMENT '已支付金额（人民币）' AFTER paid_amount_usd;

-- 更新现有数据：如果有支付记录，根据 user_payout 表的 payout_currency 和 payout_amount 更新
-- 注意：这里需要手动检查数据，因为需要关联 user_payout 表

