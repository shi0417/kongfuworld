-- 为 translation_task 和 chapter_translation 表添加 Workflow 相关字段
-- 用于支持基于 LangChain Workflow 的有状态流水线

-- 1. translation_task 表增加字段
ALTER TABLE translation_task
  ADD COLUMN `current_step` VARCHAR(50) DEFAULT 'segmenting' COMMENT '当前工作流阶段：segmenting/analyzing_titles/translating_titles/translating_bodies/quality_checking/importing',
  ADD COLUMN `checkpoint` JSON NULL COMMENT '工作流检查点数据（如 last_chapter_number 等）';

-- 2. chapter_translation 表增加字段
ALTER TABLE chapter_translation
  ADD COLUMN `last_step` VARCHAR(50) DEFAULT NULL COMMENT '最近处理步骤，比如 translate_title/translate_body/qa_check',
  ADD COLUMN `qa_status` VARCHAR(20) DEFAULT NULL COMMENT '质量检查结果：pass/fail/skip';

-- 3. 添加索引以优化查询
ALTER TABLE chapter_translation
  ADD INDEX `idx_status_last_step` (`status`, `last_step`),
  ADD INDEX `idx_qa_status` (`qa_status`);

