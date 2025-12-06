-- ====================================================
-- Stripe Champion 订阅系统重构 - 数据库迁移
-- 日期: 2025-12-05
-- 说明: 规范化 Stripe 相关字段，防止重复创建 Subscription
-- ====================================================

-- 1. user_champion_subscription_record 表：transaction_id → stripe_subscription_id
ALTER TABLE user_champion_subscription_record
  CHANGE COLUMN transaction_id stripe_subscription_id VARCHAR(255) NULL COMMENT 'Stripe Subscription ID: sub_xxx';

-- 2. user_champion_subscription 表：新增 stripe_customer_id
ALTER TABLE user_champion_subscription
  ADD COLUMN stripe_customer_id VARCHAR(255) NULL COMMENT 'Stripe Customer ID: cus_xxx' AFTER stripe_subscription_id;

-- 3. payment_record 表：新增 Stripe 专用字段
ALTER TABLE payment_record
  ADD COLUMN stripe_subscription_id VARCHAR(255) NULL COMMENT 'Stripe Subscription ID: sub_xxx' AFTER payment_method,
  ADD COLUMN stripe_payment_intent_id VARCHAR(255) NULL COMMENT 'Stripe PaymentIntent ID: pi_xxx' AFTER stripe_subscription_id,
  ADD COLUMN stripe_customer_id VARCHAR(255) NULL COMMENT 'Stripe Customer ID: cus_xxx' AFTER stripe_payment_intent_id;

-- 4. 为新增字段创建索引（可选，提升查询性能）
CREATE INDEX idx_payment_record_stripe_subscription_id ON payment_record(stripe_subscription_id);
CREATE INDEX idx_payment_record_stripe_payment_intent_id ON payment_record(stripe_payment_intent_id);
CREATE INDEX idx_payment_record_stripe_customer_id ON payment_record(stripe_customer_id);
CREATE INDEX idx_user_champion_subscription_stripe_customer_id ON user_champion_subscription(stripe_customer_id);

