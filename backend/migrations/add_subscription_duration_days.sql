-- 添加 subscription_duration_days 字段到 user_champion_subscription_record 表
-- 用于支持固定30天的订阅周期，替代自然月计算

ALTER TABLE user_champion_subscription_record
ADD COLUMN subscription_duration_days INT(4) NOT NULL DEFAULT 30 COMMENT '订阅时长(天)' AFTER subscription_duration_months;

-- 注意：subscription_duration_months 字段暂时保留，不再依赖它，后续清理

