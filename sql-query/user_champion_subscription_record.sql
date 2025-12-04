select * from user_champion_subscription_record order by id desc;
#UPDATE user_champion_subscription_record SET start_date = DATE_SUB(end_date, INTERVAL 30 DAY) where id <34;