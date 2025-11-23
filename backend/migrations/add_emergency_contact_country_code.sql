-- 添加紧急联系人手机号码国家区号字段
ALTER TABLE `user`
ADD COLUMN `emergency_contact_phone_country_code` VARCHAR(10) DEFAULT '+86' COMMENT '紧急联系人手机号码国家区号' AFTER `emergency_contact_phone`;

