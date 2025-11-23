-- 测试Champion页面数据插入脚本
-- 注意：运行前请确保相关表已存在

-- 1. 插入测试小说数据（如果不存在）
INSERT IGNORE INTO novel (id, title, author, description, cover, status) VALUES
(1, 'Test Novel 1', 'Test Author 1', 'Test description 1', 'test1.jpg', 'published'),
(2, 'Test Novel 2', 'Test Author 2', 'Test description 2', 'test2.jpg', 'published'),
(3, 'Test Novel 3', 'Test Author 3', 'Test description 3', 'test3.jpg', 'published');

-- 2. 插入测试用户数据（如果不存在）
INSERT IGNORE INTO user (id, username, email, password_hash, created_at) VALUES
(1, 'testuser', 'test@example.com', 'hashedpassword', NOW());

-- 3. 插入Champion配置数据
INSERT IGNORE INTO novel_champion_config (novel_id, max_advance_chapters, total_chapters, published_chapters, free_chapters_per_day, unlock_interval_hours, champion_theme, is_active) VALUES
(1, 65, 100, 50, 2, 23, 'martial', 1),
(2, 65, 100, 50, 2, 23, 'martial', 1),
(3, 65, 100, 50, 2, 23, 'martial', 1);

-- 4. 插入Champion等级配置
INSERT IGNORE INTO novel_champion_tiers (novel_id, tier_level, tier_name, monthly_price, advance_chapters, description, sort_order, is_active) VALUES
(1, 1, 'Martial Cultivator', 4.99, 10, 'Basic champion tier', 1, 1),
(1, 2, 'Profound Realm', 9.99, 25, 'Advanced champion tier', 2, 1),
(1, 3, 'Martial Lord', 19.99, 50, 'Premium champion tier', 3, 1),
(2, 1, 'Martial Cultivator', 4.99, 10, 'Basic champion tier', 1, 1),
(2, 2, 'Profound Realm', 9.99, 25, 'Advanced champion tier', 2, 1),
(2, 3, 'Martial Lord', 19.99, 50, 'Premium champion tier', 3, 1),
(3, 1, 'Martial Cultivator', 4.99, 10, 'Basic champion tier', 1, 1),
(3, 2, 'Profound Realm', 9.99, 25, 'Advanced champion tier', 2, 1),
(3, 3, 'Martial Lord', 19.99, 50, 'Premium champion tier', 3, 1);

-- 5. 插入测试Champion订阅记录
INSERT IGNORE INTO user_champion_subscription (user_id, novel_id, tier_level, tier_name, monthly_price, start_date, end_date, payment_method, auto_renew, is_active, created_at) VALUES
(1, 1, 1, 'Martial Cultivator', 4.99, DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_ADD(NOW(), INTERVAL 15 DAY), 'stripe', 1, 1, NOW()),
(1, 2, 2, 'Profound Realm', 9.99, DATE_SUB(NOW(), INTERVAL 10 DAY), DATE_ADD(NOW(), INTERVAL 20 DAY), 'paypal', 1, 1, NOW()),
(1, 3, 3, 'Martial Lord', 19.99, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_ADD(NOW(), INTERVAL 25 DAY), 'stripe', 0, 1, NOW());

-- 6. 插入一些过期的订阅记录用于测试
INSERT IGNORE INTO user_champion_subscription (user_id, novel_id, tier_level, tier_name, monthly_price, start_date, end_date, payment_method, auto_renew, is_active, created_at) VALUES
(1, 1, 2, 'Profound Realm', 9.99, DATE_SUB(NOW(), INTERVAL 60 DAY), DATE_SUB(NOW(), INTERVAL 30 DAY), 'stripe', 0, 1, DATE_SUB(NOW(), INTERVAL 60 DAY));

-- 7. 插入一些非活跃的订阅记录
INSERT IGNORE INTO user_champion_subscription (user_id, novel_id, tier_level, tier_name, monthly_price, start_date, end_date, payment_method, auto_renew, is_active, created_at) VALUES
(1, 2, 1, 'Martial Cultivator', 4.99, DATE_SUB(NOW(), INTERVAL 90 DAY), DATE_SUB(NOW(), INTERVAL 60 DAY), 'paypal', 0, 0, DATE_SUB(NOW(), INTERVAL 90 DAY));

-- 查询验证数据
SELECT 
    ucs.id,
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
JOIN novel n ON ucs.novel_id = n.id
WHERE ucs.user_id = 1
ORDER BY ucs.end_date DESC, ucs.created_at DESC;
