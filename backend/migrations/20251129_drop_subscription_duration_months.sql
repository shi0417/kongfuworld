-- 删除 subscription_duration_months 字段
-- 因为已经改用 subscription_duration_days 字段，不再需要 subscription_duration_months

ALTER TABLE user_champion_subscription_record
  DROP COLUMN subscription_duration_months;

