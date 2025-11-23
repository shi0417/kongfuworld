-- 创建bookmark表
-- 用于记录用户的书签设置和通知偏好
-- 创建时间: 2024年

CREATE TABLE IF NOT EXISTS bookmark (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    user_id INT NOT NULL COMMENT '用户ID',
    novel_id INT NOT NULL COMMENT '小说ID',
    novel_name VARCHAR(255) NOT NULL COMMENT '小说名称',
    bookmark_closed TINYINT(1) DEFAULT 0 COMMENT '书签关闭状态：0-开启，1-关闭',
    notification_off TINYINT(1) DEFAULT 0 COMMENT '通知关闭状态：0-开启，1-关闭',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    -- 索引
    INDEX idx_user_id (user_id),
    INDEX idx_novel_id (novel_id),
    INDEX idx_user_novel (user_id, novel_id),
    INDEX idx_bookmark_closed (bookmark_closed),
    INDEX idx_notification_off (notification_off),
    INDEX idx_created_at (created_at),
    INDEX idx_updated_at (updated_at),
    
    -- 唯一约束：每个用户对每本小说只能有一条记录
    UNIQUE KEY uk_user_novel (user_id, novel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户书签设置表';

-- 验证表结构
DESCRIBE bookmark;
