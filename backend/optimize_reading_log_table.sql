-- 优化reading_log表的性能
-- 1. 添加复合索引
ALTER TABLE reading_log 
ADD INDEX idx_user_chapter_time (user_id, chapter_id, read_at);

-- 2. 添加时间追踪字段的索引
ALTER TABLE reading_log 
ADD INDEX idx_timing_fields (page_enter_time, page_exit_time, stay_duration);

-- 3. 添加记录ID的索引（如果还没有）
ALTER TABLE reading_log 
ADD INDEX idx_id (id);

-- 4. 优化表结构
ALTER TABLE reading_log 
MODIFY COLUMN stay_duration INT DEFAULT 0 COMMENT '停留时长（秒）',
MODIFY COLUMN page_enter_time DATETIME DEFAULT NULL COMMENT '进入时间',
MODIFY COLUMN page_exit_time DATETIME DEFAULT NULL COMMENT '离开时间';

-- 5. 创建分区表（可选，用于大数据量）
-- 按日期分区，提高查询性能
ALTER TABLE reading_log 
PARTITION BY RANGE (TO_DAYS(read_at)) (
  PARTITION p2024_01 VALUES LESS THAN (TO_DAYS('2024-02-01')),
  PARTITION p2024_02 VALUES LESS THAN (TO_DAYS('2024-03-01')),
  PARTITION p2024_03 VALUES LESS THAN (TO_DAYS('2024-04-01')),
  PARTITION p2024_04 VALUES LESS THAN (TO_DAYS('2024-05-01')),
  PARTITION p2024_05 VALUES LESS THAN (TO_DAYS('2024-06-01')),
  PARTITION p2024_06 VALUES LESS THAN (TO_DAYS('2024-07-01')),
  PARTITION p2024_07 VALUES LESS THAN (TO_DAYS('2024-08-01')),
  PARTITION p2024_08 VALUES LESS THAN (TO_DAYS('2024-09-01')),
  PARTITION p2024_09 VALUES LESS THAN (TO_DAYS('2024-10-01')),
  PARTITION p2024_10 VALUES LESS THAN (TO_DAYS('2024-11-01')),
  PARTITION p2024_11 VALUES LESS THAN (TO_DAYS('2024-12-01')),
  PARTITION p2024_12 VALUES LESS THAN (TO_DAYS('2025-01-01')),
  PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- 6. 创建统计表（用于快速查询）
CREATE TABLE reading_log_stats (
  user_id INT NOT NULL,
  chapter_id INT NOT NULL,
  total_reads INT DEFAULT 0,
  total_duration INT DEFAULT 0,
  avg_duration DECIMAL(10,2) DEFAULT 0,
  last_read_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, chapter_id),
  INDEX idx_user_stats (user_id),
  INDEX idx_chapter_stats (chapter_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. 创建触发器自动更新统计表
DELIMITER //
CREATE TRIGGER update_reading_stats_after_insert
AFTER INSERT ON reading_log
FOR EACH ROW
BEGIN
  INSERT INTO reading_log_stats (user_id, chapter_id, total_reads, total_duration, last_read_at)
  VALUES (NEW.user_id, NEW.chapter_id, 1, NEW.stay_duration, NEW.read_at)
  ON DUPLICATE KEY UPDATE
    total_reads = total_reads + 1,
    total_duration = total_duration + COALESCE(NEW.stay_duration, 0),
    avg_duration = total_duration / total_reads,
    last_read_at = NEW.read_at;
END//
DELIMITER ;

-- 8. 创建清理旧数据的存储过程
DELIMITER //
CREATE PROCEDURE CleanOldReadingLogs(IN days_to_keep INT)
BEGIN
  DECLARE done INT DEFAULT FALSE;
  DECLARE affected_rows INT DEFAULT 0;
  
  -- 删除超过指定天数的记录
  DELETE FROM reading_log 
  WHERE read_at < DATE_SUB(NOW(), INTERVAL days_to_keep DAY);
  
  SET affected_rows = ROW_COUNT();
  
  -- 优化表
  OPTIMIZE TABLE reading_log;
  
  SELECT CONCAT('清理完成，删除了 ', affected_rows, ' 条记录') as result;
END//
DELIMITER ;
