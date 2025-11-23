-- 为 novel 表的 review_status 字段添加 'published' 状态
-- 添加后该字段有5个状态：
-- submitted - 提交中（默认值）
-- reviewing - 审核中
-- approved - 审核通过
-- rejected - 审核不通过
-- published - 已上架（正式展示给用户）

ALTER TABLE `novel` 
MODIFY COLUMN `review_status` 
ENUM('submitted','reviewing','approved','rejected','published') 
DEFAULT 'submitted' 
COMMENT '审核状态: submitted=提交中, reviewing=审核中, approved=审核通过, rejected=审核不通过, published=已上架';

