-- 修改 notifications 表结构
-- 执行时间: 2025年

-- 1. 重命名 title 字段为 novel_title
ALTER TABLE notifications CHANGE COLUMN title novel_title VARCHAR(255) NOT NULL COMMENT '小说标题';

-- 2. 添加 chapter_title 字段
ALTER TABLE notifications ADD COLUMN chapter_title VARCHAR(255) NULL COMMENT '章节标题' AFTER novel_title;

-- 3. 添加 unlock_at 字段
ALTER TABLE notifications ADD COLUMN unlock_at DATETIME NULL COMMENT '解锁时间' AFTER created_at;

-- 4. 更新 type 枚举值
-- 先临时添加新的枚举值
ALTER TABLE notifications MODIFY COLUMN type ENUM('news','unlock','chapter','comment','system','accept_marketing','notify_unlock_updates','notify_chapter_updates') NOT NULL COMMENT '通知类型';

-- 更新现有数据
UPDATE notifications SET type = 'notify_chapter_updates' WHERE type = 'chapter';

-- 移除旧的枚举值，只保留新的三个值
ALTER TABLE notifications MODIFY COLUMN type ENUM('accept_marketing','notify_unlock_updates','notify_chapter_updates') NOT NULL COMMENT '通知类型';

-- 验证表结构
DESCRIBE notifications;

-- 表结构说明:
-- id: 自增主键
-- user_id: 用户ID
-- novel_id: 小说ID
-- chapter_id: 章节ID
-- novel_title: 小说标题（原title字段）
-- chapter_title: 章节标题（新增）
-- message: 通知消息
-- type: 通知类型（更新为三种：accept_marketing, notify_unlock_updates, notify_chapter_updates）
-- link: 链接
-- is_read: 是否已读
-- created_at: 创建时间
-- unlock_at: 解锁时间（新增）
