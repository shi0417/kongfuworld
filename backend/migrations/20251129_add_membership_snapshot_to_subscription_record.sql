-- 添加会员快照字段到 user_champion_subscription_record 表
-- 用于记录购买前后的会员状态（JSON格式），方便后端 & 前端展示、审计

ALTER TABLE user_champion_subscription_record
  ADD COLUMN before_membership_snapshot TEXT NULL
    COMMENT '购买前的会员快照，JSON：{"tier_level":..., "tier_name":..., "start_date": "...", "end_date": "..."}',
  ADD COLUMN after_membership_snapshot TEXT NULL
    COMMENT '购买后的会员快照，JSON：{"tier_level":..., "tier_name":..., "start_date": "...", "end_date": "..."}';

