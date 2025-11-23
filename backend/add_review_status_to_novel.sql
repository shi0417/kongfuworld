-- 为 novel 表添加 review_status 字段，控制小说是否是审核过的状态
-- 该字段与 chapter 表中的 review_status 字段保持一致

ALTER TABLE `novel` 
ADD COLUMN `review_status` enum('submitted','reviewing','approved','rejected') 
DEFAULT 'submitted' 
COMMENT '审核状态: submitted=提交中, reviewing=审核中, approved=审核通过, rejected=审核不通过'
AFTER `licensed_from`;

-- 添加索引以提高查询性能
ALTER TABLE `novel` 
ADD INDEX `idx_review_status` (`review_status`);

-- 为现有小说设置默认审核状态为已审核通过
UPDATE `novel` 
SET `review_status` = 'approved' 
WHERE `review_status` IS NULL OR `review_status` = 'submitted';

