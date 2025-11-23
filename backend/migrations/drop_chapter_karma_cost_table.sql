-- 删除未使用的 chapter_karma_cost 表
-- 该表未被实际使用，系统使用 chapter.unlock_price 字段来存储章节的karma消费价格

-- 检查表是否存在，如果存在则删除
DROP TABLE IF EXISTS `chapter_karma_cost`;

