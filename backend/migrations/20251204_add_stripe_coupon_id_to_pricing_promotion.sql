-- 为 pricing_promotion 表添加 stripe_coupon_id 字段
-- 用于存储 Stripe Coupon ID，实现订阅时的促销折扣

ALTER TABLE `pricing_promotion`
  ADD COLUMN `stripe_coupon_id` VARCHAR(128) DEFAULT NULL COMMENT 'Stripe Coupon ID，用于订阅折扣' AFTER `discount_value`;

CREATE INDEX `idx_stripe_coupon_id` ON `pricing_promotion` (`stripe_coupon_id`);

