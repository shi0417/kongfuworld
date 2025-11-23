-- 为用户ID为2的用户创建不同的Champion订阅记录
-- 注意：运行前请确保相关表已存在

-- 插入用户ID为2的Champion订阅记录
INSERT IGNORE INTO user_champion_subscription (user_id, novel_id, tier_level, tier_name, monthly_price, start_date, end_date, payment_method, auto_renew, is_active, created_at) VALUES
(2, 1, 2, 'Profound Realm', 9.99, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_ADD(NOW(), INTERVAL 25 DAY), 'stripe', 1, 1, NOW()),
(2, 2, 1, 'Martial Cultivator', 4.99, DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_ADD(NOW(), INTERVAL 27 DAY), 'paypal', 0, 1, NOW()),
(2, 3, 3, 'Martial Lord', 19.99, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL 29 DAY), 'stripe', 1, 1, NOW());

-- 查询验证数据
SELECT 
    ucs.id,
    ucs.user_id,
    u.username,
    ucs.novel_id,
    n.title as novel_title,
    ucs.tier_level,
    ucs.tier_name,
    ucs.monthly_price,
    ucs.start_date,
    ucs.end_date,
    ucs.payment_method,
    ucs.auto_renew,
    ucs.is_active,
    CASE 
        WHEN ucs.end_date > NOW() AND ucs.is_active = 1 THEN 'active'
        WHEN ucs.end_date <= NOW() AND ucs.is_active = 1 THEN 'expired'
        ELSE 'inactive'
    END as status
FROM user_champion_subscription ucs
JOIN user u ON ucs.user_id = u.id
JOIN novel n ON ucs.novel_id = n.id
WHERE ucs.user_id IN (1, 2)
ORDER BY ucs.user_id, ucs.end_date DESC;
