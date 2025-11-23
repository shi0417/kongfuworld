# 评论系统三表详细分析

## 📊 三个核心表的结构和关系

### 1. `review` 表 - 小说评价表
**作用：存储用户对整部小说的正式评价和评分**

| 字段名 | 类型 | 说明 | 作用 |
|--------|------|------|------|
| `id` | int | 主键，自增 | 唯一标识每条评价 |
| `novel_id` | int | 小说ID，外键 | 关联到具体的小说 |
| `user_id` | int | 用户ID，外键 | 关联到发表评价的用户 |
| `content` | text | 评价内容 | 用户写的详细评价文字 |
| `rating` | int | 评分(1-5星) | 用户给出的星级评分 |
| `created_at` | datetime | 创建时间 | 评价发表的时间 |
| `likes` | int | 点赞数 | 该评价获得的点赞总数 |
| `comments` | int | 回复数 | 该评价下的回复数量 |
| `views` | int | 查看数 | 该评价被查看的次数 |
| `is_recommended` | tinyint(1) | 是否推荐 | 用户是否推荐这部小说 |

**应用场景：**
- 小说详情页的"Reviews"区域
- 用户对整部小说的综合评价
- 需要至少100字的详细评价
- 支持1-5星评分和推荐/不推荐

### 2. `comment` 表 - 通用评论表
**作用：存储各种类型的评论，支持多层级回复**

| 字段名 | 类型 | 说明 | 作用 |
|--------|------|------|------|
| `id` | int | 主键，自增 | 唯一标识每条评论 |
| `user_id` | int | 用户ID，外键 | 关联到发表评论的用户 |
| `target_type` | enum | 目标类型 | 评论的对象类型 |
| `target_id` | int | 目标ID | 具体的目标对象ID |
| `parent_comment_id` | int | 父评论ID | 回复的上级评论ID |
| `content` | text | 评论内容 | 用户写的评论文字 |
| `created_at` | datetime | 创建时间 | 评论发表的时间 |
| `likes` | int | 点赞数 | 该评论获得的点赞总数 |

**target_type 的三种类型：**
- `'novel'` - 对小说的评论
- `'chapter'` - 对章节的评论  
- `'paragraph'` - 对段落的评论

**应用场景：**
- 对小说的快速评论
- 对特定章节的评论
- 对特定段落的评论
- 对评论的回复（通过parent_comment_id）

### 3. `review_like` 表 - 评价点赞表
**作用：记录用户对评价的点赞行为**

| 字段名 | 类型 | 说明 | 作用 |
|--------|------|------|------|
| `id` | int | 主键，自增 | 唯一标识每条点赞记录 |
| `review_id` | int | 评价ID，外键 | 关联到被点赞的评价 |
| `user_id` | int | 用户ID，外键 | 关联到点赞的用户 |
| `created_at` | datetime | 创建时间 | 点赞的时间 |

**应用场景：**
- 用户对评价的点赞功能
- 防止重复点赞（通过唯一约束）
- 统计评价的受欢迎程度

## 🔗 三表之间的关系

### 关系图
```
user (用户表)
├── review (评价表) - 一对多
│   ├── review_like (点赞表) - 一对多
│   └── comment (评论表) - 一对多 (target_type='review')
├── comment (评论表) - 一对多
└── review_like (点赞表) - 一对多

novel (小说表)
└── review (评价表) - 一对多
```

### 具体关系说明

1. **user → review (一对多)**
   - 一个用户可以写多个评价
   - 一个评价只能属于一个用户

2. **novel → review (一对多)**
   - 一部小说可以有多个评价
   - 一个评价只能属于一部小说

3. **review → review_like (一对多)**
   - 一个评价可以被多个用户点赞
   - 一个点赞记录只能属于一个评价

4. **user → review_like (一对多)**
   - 一个用户可以点赞多个评价
   - 一个点赞记录只能属于一个用户

5. **review → comment (一对多)**
   - 一个评价可以有多个回复评论
   - 通过 target_type='review' 和 target_id=review.id 关联

6. **comment → comment (自关联)**
   - 通过 parent_comment_id 实现评论的回复功能
   - 支持多层级回复

## 🎯 实际应用场景

### 场景1：小说详情页评论系统
```
用户访问小说详情页
├── 显示评价统计 (review表统计)
├── 显示评价列表 (review表查询)
├── 用户提交评价 (插入review表)
├── 用户点赞评价 (插入review_like表)
└── 用户回复评价 (插入comment表，target_type='review')
```

### 场景2：章节阅读页评论
```
用户阅读章节
├── 显示章节评论 (comment表，target_type='chapter')
├── 用户发表章节评论 (插入comment表)
└── 用户回复章节评论 (插入comment表，parent_comment_id)
```

### 场景3：段落评论功能
```
用户阅读到特定段落
├── 显示段落评论 (comment表，target_type='paragraph')
├── 用户发表段落评论 (插入comment表)
└── 用户回复段落评论 (插入comment表，parent_comment_id)
```

## 📱 前端组件对应关系

### ReviewSection 组件
- **数据来源：** review表
- **功能：** 显示评价、提交评价、点赞评价
- **API：** /api/novel/:novelId/reviews

### CommentSection 组件 (章节评论)
- **数据来源：** comment表 (target_type='chapter')
- **功能：** 显示章节评论、发表评论、回复评论
- **API：** /api/chapter/:chapterId/comments

### ParagraphComment 组件 (段落评论)
- **数据来源：** comment表 (target_type='paragraph')
- **功能：** 显示段落评论、发表评论、回复评论
- **API：** /api/paragraph/:paragraphId/comments

## 🔄 数据流转示例

### 用户评价小说流程
1. 用户访问小说详情页
2. 前端调用 `/api/novel/1/review-stats` 获取评价统计
3. 前端调用 `/api/novel/1/reviews` 获取评价列表
4. 用户提交评价 → POST `/api/novel/1/review`
5. 后端插入 review 表
6. 后端更新 novel.reviews 计数
7. 前端刷新显示新评价

### 用户点赞评价流程
1. 用户点击评价的点赞按钮
2. 前端调用 POST `/api/review/123/like`
3. 后端检查是否已点赞 (review_like表查询)
4. 后端插入 review_like 表
5. 后端更新 review.likes 计数
6. 前端更新点赞数显示

### 用户回复评价流程
1. 用户点击评价的回复按钮
2. 用户输入回复内容
3. 前端调用 POST `/api/review/123/comment`
4. 后端插入 comment 表 (target_type='review', target_id=123)
5. 后端更新 review.comments 计数
6. 前端显示新回复

## 💡 设计优势

1. **职责分离：** review表专门处理评价，comment表处理各种评论
2. **灵活扩展：** comment表支持多种目标类型
3. **社交功能：** 完整的点赞和回复系统
4. **性能优化：** 通过计数字段避免实时统计
5. **数据完整：** 外键约束保证数据一致性

这个设计完全参考了wuxiaworld.com的评论系统架构，支持完整的社交互动功能。
