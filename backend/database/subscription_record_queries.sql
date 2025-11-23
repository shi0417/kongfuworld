-- 用户Champion订阅记录查询示例

-- 1. 查看用户的所有订阅记录
SELECT 
    ucsr.id,
    ucsr.user_id,
    ucsr.novel_id,
    n.title as novel_title,
    ucsr.tier_name,
    ucsr.payment_amount,
    ucsr.payment_method,
    ucsr.subscription_type,
    ucsr.start_date,
    ucsr.end_date,
    ucsr.payment_status,
    ucsr.transaction_id,
    ucsr.created_at
FROM user_champion_subscription_record ucsr
LEFT JOIN novel n ON ucsr.novel_id = n.id
WHERE ucsr.user_id = 1
ORDER BY ucsr.created_at DESC;

-- 2. 查看特定小说的订阅记录
SELECT 
    ucsr.*,
    pr.amount as payment_record_amount,
    pr.status as payment_record_status,
    pr.created_at as payment_created_at
FROM user_champion_subscription_record ucsr
LEFT JOIN payment_record pr ON ucsr.payment_record_id = pr.id
WHERE ucsr.novel_id = 7
ORDER BY ucsr.created_at DESC;

-- 3. 统计用户的订阅支出
SELECT 
    ucsr.user_id,
    COUNT(*) as total_payments,
    SUM(ucsr.payment_amount) as total_amount,
    AVG(ucsr.payment_amount) as average_amount,
    MIN(ucsr.created_at) as first_payment,
    MAX(ucsr.created_at) as last_payment
FROM user_champion_subscription_record ucsr
WHERE ucsr.user_id = 1
GROUP BY ucsr.user_id;

-- 4. 按小说统计订阅记录
SELECT 
    ucsr.novel_id,
    n.title as novel_title,
    COUNT(*) as payment_count,
    SUM(ucsr.payment_amount) as total_amount,
    MAX(ucsr.tier_level) as max_tier_level,
    MAX(ucsr.end_date) as latest_end_date
FROM user_champion_subscription_record ucsr
LEFT JOIN novel n ON ucsr.novel_id = n.id
GROUP BY ucsr.novel_id, n.title
ORDER BY total_amount DESC;

-- 5. 查看订阅类型分布
SELECT 
    subscription_type,
    COUNT(*) as count,
    SUM(payment_amount) as total_amount
FROM user_champion_subscription_record
GROUP BY subscription_type;

-- 6. 查看支付方式分布
SELECT 
    payment_method,
    COUNT(*) as count,
    SUM(payment_amount) as total_amount,
    AVG(payment_amount) as average_amount
FROM user_champion_subscription_record
GROUP BY payment_method;

-- 7. 查看月度订阅收入
SELECT 
    DATE_FORMAT(created_at, '%Y-%m') as month,
    COUNT(*) as payment_count,
    SUM(payment_amount) as total_amount
FROM user_champion_subscription_record
WHERE payment_status = 'completed'
GROUP BY DATE_FORMAT(created_at, '%Y-%m')
ORDER BY month DESC;

-- 8. 查看用户的订阅历史（按时间线）
SELECT 
    ucsr.created_at,
    ucsr.novel_id,
    n.title as novel_title,
    ucsr.tier_name,
    ucsr.payment_amount,
    ucsr.subscription_type,
    ucsr.payment_method,
    CASE 
        WHEN ucsr.subscription_type = 'new' THEN '新订阅'
        WHEN ucsr.subscription_type = 'extend' THEN '续费'
        WHEN ucsr.subscription_type = 'upgrade' THEN '升级'
        WHEN ucsr.subscription_type = 'renew' THEN '重新订阅'
        ELSE ucsr.subscription_type
    END as subscription_type_cn
FROM user_champion_subscription_record ucsr
LEFT JOIN novel n ON ucsr.novel_id = n.id
WHERE ucsr.user_id = 1
ORDER BY ucsr.created_at DESC;

-- 9. 查看退款记录
SELECT 
    ucsr.*,
    pr.amount as original_amount,
    ucsr.refund_amount,
    ucsr.refund_reason,
    ucsr.refund_date
FROM user_champion_subscription_record ucsr
LEFT JOIN payment_record pr ON ucsr.payment_record_id = pr.id
WHERE ucsr.refund_amount > 0
ORDER BY ucsr.refund_date DESC;

-- 10. 查看活跃订阅（当前有效的订阅）
SELECT 
    ucsr.user_id,
    ucsr.novel_id,
    n.title as novel_title,
    ucsr.tier_name,
    ucsr.start_date,
    ucsr.end_date,
    DATEDIFF(ucsr.end_date, NOW()) as days_remaining,
    ucsr.auto_renew
FROM user_champion_subscription_record ucsr
LEFT JOIN novel n ON ucsr.novel_id = n.id
WHERE ucsr.is_active = 1 
    AND ucsr.end_date > NOW()
ORDER BY ucsr.end_date ASC;
