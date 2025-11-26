-- Phase 3: 添加章节审核状态 - pending_chief（等待主编终审）
-- 在 chapter.review_status 枚举中添加 'pending_chief' 状态

ALTER TABLE `chapter`
  MODIFY COLUMN `review_status` ENUM('submitted','reviewing','approved','rejected','draft','pending_chief') DEFAULT 'submitted' COMMENT '审核状态: submitted=提交中, reviewing=审核中, approved=审核通过, rejected=审核不通过, draft=草稿, pending_chief=等待主编终审';

