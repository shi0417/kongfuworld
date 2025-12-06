-- 为 user_champion_subscription 表添加 Stripe 订阅相关字段
-- 创建时间: 2025-12-04
-- 说明: 支持 Stripe 自动续费订阅功能

ALTER TABLE `user_champion_subscription`
  ADD COLUMN `stripe_subscription_id` VARCHAR(128) NULL COMMENT 'Stripe subscription id' AFTER `payment_method`,
  ADD COLUMN `cancel_at_period_end` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否本周期结束后取消自动续费' AFTER `auto_renew`,
  ADD COLUMN `cancelled_at` DATETIME NULL COMMENT '用户在本站取消自动续费的时间' AFTER `cancel_at_period_end`;

-- 添加索引以便快速查询
CREATE INDEX `idx_stripe_subscription_id` ON `user_champion_subscription` (`stripe_subscription_id`);

