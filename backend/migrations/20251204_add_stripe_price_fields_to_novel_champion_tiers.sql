-- 为 novel_champion_tiers 表添加 Stripe Price 相关字段
-- 创建时间: 2025-12-04
-- 说明: 支持动态创建和管理 Stripe Price

-- 检查并添加 stripe_price_id 字段（如果不存在）
ALTER TABLE `novel_champion_tiers`
  ADD COLUMN IF NOT EXISTS `stripe_price_id` VARCHAR(128) NULL COMMENT '对应 Stripe Price ID' AFTER `monthly_price`,
  ADD COLUMN IF NOT EXISTS `currency` VARCHAR(10) NOT NULL DEFAULT 'USD' COMMENT '币种，默认 USD' AFTER `stripe_price_id`;

-- 添加索引以便快速查询
CREATE INDEX IF NOT EXISTS `idx_stripe_price_id` ON `novel_champion_tiers` (`stripe_price_id`);

