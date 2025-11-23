-- 添加手机号码国家区号字段
ALTER TABLE `user`
ADD COLUMN `phone_country_code` VARCHAR(10) DEFAULT '+86' COMMENT '手机号码国家区号' AFTER `phone_number`;

