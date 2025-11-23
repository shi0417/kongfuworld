#DESCRIBE chapter;
select * from chapter order by id desc;
#ALTER TABLE chapter DROP COLUMN bookmark_locked;
#UPDATE chapter SET is_premium = is_locked;#COMMIT;
#SELECT id, is_premium, is_locked FROM chapter WHERE is_premium != is_locked; -- 查看是否存在需要更新的行
#UPDATE chapter SET is_released = 0 WHERE  id=1495; -- 只更新差异行
#COMMIT;