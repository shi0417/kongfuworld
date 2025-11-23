-- 为 author_royalty_plan 表添加 owner_user_id 字段
-- 用于标识该方案是否为某个用户的专属方案

ALTER TABLE `author_royalty_plan`
  ADD COLUMN `owner_user_id` BIGINT NULL COMMENT '若为定制方案，可填拥有者user_id' AFTER `is_default`,
  ADD KEY `idx_owner_user_id` (`owner_user_id`);

