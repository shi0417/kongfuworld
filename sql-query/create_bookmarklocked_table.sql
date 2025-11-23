-- 创建bookmarklocked表
-- 用于记录用户对特定小说章节的书签锁定状态

USE kongfuworld;

-- 创建bookmarklocked表
CREATE TABLE IF NOT EXISTS bookmarklocked (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  novel_id INT NOT NULL,
  chapter_id INT NOT NULL,
  bookmark_locked TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0=未锁定, 1=已锁定',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- 创建唯一索引，确保每个用户对每个章节只有一条记录
  UNIQUE KEY unique_user_novel_chapter (user_id, novel_id, chapter_id),
  
  -- 创建外键约束（如果相关表存在）
  -- FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  -- FOREIGN KEY (novel_id) REFERENCES novel(id) ON DELETE CASCADE,
  -- FOREIGN KEY (chapter_id) REFERENCES chapter(id) ON DELETE CASCADE,
  
  -- 创建索引以提高查询性能
  INDEX idx_user_id (user_id),
  INDEX idx_novel_id (novel_id),
  INDEX idx_chapter_id (chapter_id),
  INDEX idx_bookmark_locked (bookmark_locked)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户章节书签锁定状态表';

-- 查看表结构
DESCRIBE bookmarklocked;
