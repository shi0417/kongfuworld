# 评论系统三表关系图

## 📊 表结构关系图

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│      user       │    │      novel      │    │     chapter     │
│                 │    │                 │    │                 │
│ id (PK)         │    │ id (PK)         │    │ id (PK)         │
│ username        │    │ title           │    │ title           │
│ email           │    │ author          │    │ content         │
│ avatar          │    │ description     │    │ novel_id (FK)   │
│ is_vip          │    │ rating          │    │ volume_id (FK)  │
│ ...             │    │ reviews         │    │ ...             │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         │ 1:N                   │ 1:N                   │ 1:N
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     review      │    │    comment      │    │    comment      │
│                 │    │                 │    │                 │
│ id (PK)         │    │ id (PK)         │    │ id (PK)         │
│ novel_id (FK)   │    │ user_id (FK)    │    │ user_id (FK)    │
│ user_id (FK)    │    │ target_type     │    │ target_type     │
│ content         │    │ target_id       │    │ target_id       │
│ rating          │    │ parent_comment_id│   │ parent_comment_id│
│ likes           │    │ content         │    │ content         │
│ comments        │    │ created_at      │    │ created_at      │
│ views           │    │ likes           │    │ likes           │
│ is_recommended  │    └─────────────────┘    └─────────────────┘
│ created_at      │
└─────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐
│  review_like    │
│                 │
│ id (PK)         │
│ review_id (FK)  │
│ user_id (FK)    │
│ created_at      │
└─────────────────┘
```

## 🔗 字段对应关系详解

### review 表字段说明
```sql
CREATE TABLE `review` (
  `id` int NOT NULL AUTO_INCREMENT,           -- 评价ID，主键
  `novel_id` int NOT NULL,                  -- 小说ID，外键 → novel.id
  `user_id` int NOT NULL,                   -- 用户ID，外键 → user.id
  `content` text,                           -- 评价内容（详细评价）
  `rating` int DEFAULT NULL,                -- 评分（1-5星）
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP, -- 创建时间
  `likes` int DEFAULT '0',                  -- 点赞数（冗余字段，提高查询性能）
  `comments` int DEFAULT '0',              -- 回复数（冗余字段）
  `views` int DEFAULT '0',                 -- 查看数（冗余字段）
  `is_recommended` tinyint(1) DEFAULT '0'   -- 是否推荐（0=不推荐，1=推荐）
);
```

### comment 表字段说明
```sql
CREATE TABLE `comment` (
  `id` int NOT NULL AUTO_INCREMENT,        -- 评论ID，主键
  `user_id` int NOT NULL,                   -- 用户ID，外键 → user.id
  `target_type` enum('novel','chapter','paragraph'), -- 目标类型
  `target_id` int NOT NULL,                 -- 目标ID（根据target_type指向不同表）
  `parent_comment_id` int DEFAULT NULL,     -- 父评论ID，支持回复功能
  `content` text NOT NULL,                  -- 评论内容
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP, -- 创建时间
  `likes` int DEFAULT '0'                   -- 点赞数
);
```

### review_like 表字段说明
```sql
CREATE TABLE `review_like` (
  `id` int NOT NULL AUTO_INCREMENT,        -- 点赞记录ID，主键
  `review_id` int NOT NULL,                -- 评价ID，外键 → review.id
  `user_id` int NOT NULL,                   -- 用户ID，外键 → user.id
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP -- 点赞时间
);
```

## 🎯 实际应用场景映射

### 场景1：小说详情页评价系统
```
用户操作流程：
1. 查看小说详情页
   └── 调用 API: GET /api/novel/1/review-stats
       └── 查询 review 表统计信息
           └── 返回：总评价数、平均评分、推荐率等

2. 查看评价列表
   └── 调用 API: GET /api/novel/1/reviews
       └── 查询 review 表 + user 表 JOIN
           └── 返回：评价列表（包含用户信息）

3. 提交评价
   └── 调用 API: POST /api/novel/1/review
       └── 插入 review 表
           └── 更新 novel.reviews 计数

4. 点赞评价
   └── 调用 API: POST /api/review/123/like
       └── 插入 review_like 表
           └── 更新 review.likes 计数
```

### 场景2：章节评论系统
```
用户操作流程：
1. 阅读章节
   └── 调用 API: GET /api/chapter/456/comments
       └── 查询 comment 表 (target_type='chapter', target_id=456)
           └── 返回：章节评论列表

2. 发表章节评论
   └── 调用 API: POST /api/chapter/456/comment
       └── 插入 comment 表 (target_type='chapter', target_id=456)

3. 回复章节评论
   └── 调用 API: POST /api/comment/789/reply
       └── 插入 comment 表 (parent_comment_id=789)
```

### 场景3：段落评论系统
```
用户操作流程：
1. 阅读到特定段落
   └── 调用 API: GET /api/paragraph/789/comments
       └── 查询 comment 表 (target_type='paragraph', target_id=789)
           └── 返回：段落评论列表

2. 发表段落评论
   └── 调用 API: POST /api/paragraph/789/comment
       └── 插入 comment 表 (target_type='paragraph', target_id=789)
```

## 📱 前端组件对应关系

### ReviewSection 组件 (小说评价)
- **数据表：** review 表
- **功能：** 显示评价、提交评价、点赞评价
- **位置：** 小说详情页的"Reviews"区域

### ChapterComment 组件 (章节评论)
- **数据表：** comment 表 (target_type='chapter')
- **功能：** 显示章节评论、发表评论、回复评论
- **位置：** 章节阅读页的评论区域

### ParagraphComment 组件 (段落评论)
- **数据表：** comment 表 (target_type='paragraph')
- **功能：** 显示段落评论、发表评论、回复评论
- **位置：** 章节阅读页的段落评论区域

## 🔄 数据流转完整示例

### 用户评价小说完整流程
```
1. 用户访问小说详情页
   └── 前端组件：BookDetail.tsx
       └── 调用：ReviewSection 组件

2. 加载评价统计
   └── API: GET /api/novel/1/review-stats
       └── SQL: SELECT COUNT(*), AVG(rating), SUM(is_recommended) FROM review WHERE novel_id=1
           └── 返回：{total_reviews: 15, average_rating: 4.2, recommendation_rate: 80}

3. 加载评价列表
   └── API: GET /api/novel/1/reviews
       └── SQL: SELECT r.*, u.username, u.avatar FROM review r JOIN user u ON r.user_id=u.id WHERE r.novel_id=1
           └── 返回：评价列表数据

4. 用户提交评价
   └── 用户填写：评分5星，推荐，内容"这是一部很棒的小说..."
       └── API: POST /api/novel/1/review
           └── SQL: INSERT INTO review (novel_id, user_id, content, rating, is_recommended)
               └── SQL: UPDATE novel SET reviews=reviews+1 WHERE id=1
                   └── 返回：{success: true, review_id: 123}

5. 用户点赞评价
   └── 用户点击评价的👍按钮
       └── API: POST /api/review/123/like
           └── SQL: INSERT INTO review_like (review_id, user_id)
               └── SQL: UPDATE review SET likes=likes+1 WHERE id=123
                   └── 返回：{success: true}

6. 用户回复评价
   └── 用户输入回复："我也觉得很好看！"
       └── API: POST /api/review/123/comment
           └── SQL: INSERT INTO comment (user_id, target_type, target_id, content)
               └── SQL: UPDATE review SET comments=comments+1 WHERE id=123
                   └── 返回：{success: true, comment_id: 456}
```

## 💡 设计优势总结

1. **职责清晰：** review表专门处理评价，comment表处理各种评论
2. **灵活扩展：** comment表通过target_type支持多种评论场景
3. **社交完整：** 支持点赞、回复等完整社交功能
4. **性能优化：** 通过冗余字段避免实时统计查询
5. **数据完整：** 外键约束保证数据一致性
6. **用户体验：** 参考wuxiaworld.com的成熟设计模式

这个三表设计完全支持现代小说网站的评论系统需求，既保证了功能的完整性，又确保了系统的可扩展性。
