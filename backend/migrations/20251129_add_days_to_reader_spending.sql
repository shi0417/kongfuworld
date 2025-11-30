-- 添加 days 字段到 reader_spending 表
-- 用于记录本条记录对应的"服务天数"（按自然日计数），主要用于 Champion 订阅拆分对账

ALTER TABLE reader_spending
  ADD COLUMN days INT NOT NULL DEFAULT 0
  COMMENT '本条记录对应的服务天数（按自然日计数，Champion 订阅拆分用）';

