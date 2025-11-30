-- 将 before_membership_snapshot 和 after_membership_snapshot 字段移动到 subscription_duration_days 字段后面

ALTER TABLE user_champion_subscription_record
  MODIFY COLUMN before_membership_snapshot TEXT NULL
    COMMENT '购买前的会员快照，JSON：{"tier_level":..., "tier_name":..., "start_date": "...", "end_date": "..."}'
    AFTER subscription_duration_days,
  MODIFY COLUMN after_membership_snapshot TEXT NULL
    COMMENT '购买后的会员快照，JSON：{"tier_level":..., "tier_name":..., "start_date": "...", "end_date": "..."}'
    AFTER before_membership_snapshot;

