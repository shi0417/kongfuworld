-- 在chapter表的review_status字段中添加'draft'状态
-- 执行前请先备份数据库

-- 修改review_status字段，添加draft状态
ALTER TABLE `chapter` 
MODIFY COLUMN `review_status` 
enum('submitted','reviewing','approved','rejected','draft') 
DEFAULT 'submitted' 
COMMENT '审核状态: submitted=提交中, reviewing=审核中, approved=审核通过, rejected=审核不通过, draft=草稿';

