-- 为 chapter 表的 review_status 字段添加 'draft' 枚举值
-- 数据库名: kongfuworld
-- 执行前请先备份数据库

-- 修改 review_status 字段，添加 'draft' 枚举值
ALTER TABLE `chapter` 
MODIFY COLUMN `review_status` ENUM('submitted','reviewing','approved','rejected','draft') 
DEFAULT 'submitted' 
COMMENT '审核状态: submitted=提交中, reviewing=审核中, approved=审核通过, rejected=审核不通过, draft=草稿';

