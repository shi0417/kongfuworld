-- 删除tag表和novel_tag表
-- 这两个表未被使用，可以安全删除
-- 注意：需要先删除novel_tag表（因为它有外键引用tag表），然后再删除tag表

DROP TABLE IF EXISTS `novel_tag`;
DROP TABLE IF EXISTS `tag`;

