-- 更新 novel 表的 review_status 字段为8个新状态
-- 状态值：
-- created - 草稿/已创建（作者新建但未提交审核）
-- submitted - 已提交（提交审核但未开始审核）
-- reviewing - 审核中（平台审核人员正在审核）
-- approved - 审核通过（待上架，可由作者或系统选择上架时间）
-- published - 已上架（已正式展示给读者，可阅读）
-- unlisted - 已下架（手动下架但未违规，可以重新上架）
-- archived - 已归档（历史作品，只保留数据，不再展示）
-- locked - 已锁定/违规锁定（违规或版权问题，被平台冻结，不能再上架）

ALTER TABLE `novel` 
MODIFY COLUMN `review_status` 
ENUM('created','submitted','reviewing','approved','published','unlisted','archived','locked') 
DEFAULT 'created' 
COMMENT '审核状态: created=草稿/已创建, submitted=已提交, reviewing=审核中, approved=审核通过, published=已上架, unlisted=已下架, archived=已归档, locked=已锁定/违规锁定';

