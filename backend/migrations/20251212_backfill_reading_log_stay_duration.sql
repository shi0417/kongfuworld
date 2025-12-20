-- 回填 reading_log.stay_duration（秒）
-- 计算规则与 backend/routes/reading_timing.js 保持一致：
-- 1) page_enter_time 或 page_exit_time 为空：stay_duration = NULL（无法计算）
-- 2) page_exit_time 早于 page_enter_time：stay_duration = 0（避免负数）
-- 3) 否则：stay_duration = TIMESTAMPDIFF(SECOND, page_enter_time, page_exit_time)
--
-- 默认建议仅回填 stay_duration IS NULL 的历史数据（幂等、避免覆盖已有值）。

UPDATE reading_log
SET stay_duration = CASE
  WHEN page_enter_time IS NULL OR page_exit_time IS NULL THEN NULL
  WHEN TIMESTAMPDIFF(SECOND, page_enter_time, page_exit_time) < 0 THEN 0
  ELSE TIMESTAMPDIFF(SECOND, page_enter_time, page_exit_time)
END
WHERE page_enter_time IS NOT NULL
  AND page_exit_time IS NOT NULL
  AND stay_duration IS NULL;


