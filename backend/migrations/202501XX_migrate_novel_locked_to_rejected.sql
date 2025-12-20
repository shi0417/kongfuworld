-- ============================================
-- 迁移脚本：将小说审批状态从 'locked' 统一为 'rejected'
-- 创建时间: 2025-01-XX
-- ============================================
-- 
-- 业务规则变更：
-- 1. 小说"已拒绝"状态统一使用 review_status = 'rejected'
-- 2. 废弃 'locked' 作为小说审批状态
-- 3. 'locked' 状态保留用于其他违规锁定场景（非审批流程）
--
-- 执行前请备份数据库！
-- ============================================

-- 将历史数据中用于审批拒绝的 'locked' 状态迁移为 'rejected'
-- 注意：此迁移假设所有 review_status='locked' 的记录都是审批拒绝
-- 如果存在其他用途的 'locked' 记录，请手动区分后再执行
UPDATE novel
SET review_status = 'rejected'
WHERE review_status = 'locked';

-- 验证迁移结果（可选，执行后查看）
-- SELECT review_status, COUNT(*) as count 
-- FROM novel 
-- GROUP BY review_status;

-- ============================================
-- 迁移完成说明：
-- 1. 所有 review_status='locked' 的记录已更新为 'rejected'
-- 2. 后续代码中，小说审批拒绝操作统一使用 'rejected'
-- 3. 'locked' 状态不再用于小说审批流程
-- ============================================

