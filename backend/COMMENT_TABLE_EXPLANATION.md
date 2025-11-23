# comment 表字段详解和存取逻辑

## 📋 表结构

```sql
CREATE TABLE `comment` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `target_type` enum('novel','chapter','paragraph','review') NOT NULL,
  `target_id` int NOT NULL,
  `parent_comment_id` int DEFAULT NULL,
  `content` text NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `likes` int DEFAULT '0',
  PRIMARY KEY (`id`)
)
```

## 🔍 字段详解

### 1. `id` (主键)
- **类型**: `int NOT NULL AUTO_INCREMENT`
- **含义**: 评论的唯一标识符，自动递增
- **用途**: 主键，用于唯一标识每条评论
- **存取逻辑**: 
  - 插入时：数据库自动生成，无需手动指定
  - 查询时：用于关联查询、更新、删除操作

### 2. `user_id` (用户ID)
- **类型**: `int NOT NULL`
- **含义**: 发表评论的用户ID
- **用途**: 关联到 `user` 表，标识评论的作者
- **存取逻辑**:
  - 插入时：必须提供，从当前登录用户获取 `req.authorId` 或 `req.user.id`
  - 查询时：用于筛选特定用户的评论，或 JOIN `user` 表获取用户信息

### 3. `target_type` (目标类型)
- **类型**: `enum('novel','chapter','paragraph','review') NOT NULL`
- **含义**: 评论针对的对象类型
- **可选值**:
  - `'novel'`: 对整部小说的评论（讨论）
  - `'chapter'`: 对章节的评论（章评）
  - `'paragraph'`: 对段落的评论（段评）
  - `'review'`: 对评价的回复（评价回复）
- **存取逻辑**:
  - 插入时：根据评论场景确定
    - 小说讨论 → `'novel'`
    - 章节评论 → `'chapter'`
    - 段落评论 → `'paragraph'`
    - 回复评价 → `'review'`（如果数据库支持）或 `'novel'`（降级方案）
  - 查询时：用于筛选特定类型的评论
    ```sql
    WHERE target_type = 'chapter'  -- 只查询章评
    WHERE target_type IN ('chapter', 'paragraph')  -- 查询章评和段评
    ```

### 4. `target_id` (目标ID)
- **类型**: `int NOT NULL`
- **含义**: 具体的目标对象ID，配合 `target_type` 使用
- **用途**: 标识评论针对的具体对象
- **存取逻辑**:
  - 插入时：根据 `target_type` 确定
    - `target_type = 'novel'` → `target_id = novel.id`
    - `target_type = 'chapter'` → `target_id = chapter.id`
    - `target_type = 'paragraph'` → `target_id = paragraph.id`（实际也是章节ID）
    - `target_type = 'review'` → `target_id = review.id`
  - 查询时：用于筛选特定对象的评论
    ```sql
    WHERE target_type = 'chapter' AND target_id = 123  -- 查询章节123的所有评论
    ```

### 5. `parent_comment_id` (父评论ID)
- **类型**: `int DEFAULT NULL`
- **含义**: 如果这是回复，指向被回复的评论ID；如果是主评论，则为 `NULL`
- **用途**: 实现评论的回复功能，支持多层级回复
- **存取逻辑**:
  - **主评论**（不是回复）:
    - 插入时：设置为 `NULL`
    - 查询时：`WHERE parent_comment_id IS NULL` 筛选主评论
  - **回复评论**:
    - 插入时：设置为被回复的评论ID
      ```javascript
      // 回复其他评论
      parent_comment_id = commentId  // 被回复的评论ID
      
      // 回复评价（特殊情况）
      if (commentType === 'review' && targetType === 'novel') {
        parent_comment_id = null  // 特殊情况，通过其他方式关联
      } else {
        parent_comment_id = commentId
      }
      ```
    - 查询时：`WHERE parent_comment_id = ?` 查询特定评论的回复
      ```sql
      -- 查询评论ID为123的所有回复
      SELECT * FROM comment WHERE parent_comment_id = 123
      ```

### 6. `content` (评论内容)
- **类型**: `text NOT NULL`
- **含义**: 评论的文本内容
- **用途**: 存储用户输入的评论文字
- **存取逻辑**:
  - 插入时：必须提供，需要验证非空和长度
    ```javascript
    if (!content || content.trim().length < 1) {
      return res.status(400).json({ success: false, message: '回复内容不能为空' });
    }
    // 插入时去除首尾空格
    content.trim()
    ```
  - 查询时：直接返回，前端显示

### 7. `created_at` (创建时间)
- **类型**: `datetime DEFAULT CURRENT_TIMESTAMP`
- **含义**: 评论的创建时间
- **用途**: 记录评论发表时间，用于排序和显示
- **存取逻辑**:
  - 插入时：可以手动指定 `NOW()` 或使用默认值
    ```sql
    INSERT INTO comment (..., created_at) VALUES (..., NOW())
    -- 或使用默认值
    INSERT INTO comment (...) VALUES (...)
    ```
  - 查询时：用于排序
    ```sql
    ORDER BY created_at DESC  -- 按时间倒序（最新的在前）
    ORDER BY created_at ASC   -- 按时间正序（最早的在前）
    ```

### 8. `likes` (点赞数)
- **类型**: `int DEFAULT '0'`
- **含义**: 该评论获得的点赞总数
- **用途**: 统计评论的受欢迎程度
- **存取逻辑**:
  - 插入时：默认为 `0`
  - 更新时：用户点赞/取消点赞时更新
    ```sql
    UPDATE comment SET likes = likes + 1 WHERE id = ?
    UPDATE comment SET likes = likes - 1 WHERE id = ?
    ```
  - 查询时：用于排序和显示
    ```sql
    ORDER BY likes DESC  -- 按点赞数排序（最热在前）
    ```

## 📊 存取逻辑示例

### 场景1: 用户发表章节评论（主评论）

```javascript
// 插入数据
INSERT INTO comment (user_id, target_type, target_id, parent_comment_id, content, created_at, likes)
VALUES (1, 'chapter', 123, NULL, '这个章节很精彩！', NOW(), 0)

// 字段值说明:
// user_id = 1                    // 用户ID
// target_type = 'chapter'         // 章节评论
// target_id = 123                 // 章节ID
// parent_comment_id = NULL        // 主评论，不是回复
// content = '这个章节很精彩！'     // 评论内容
// created_at = NOW()              // 当前时间
// likes = 0                       // 初始点赞数为0
```

### 场景2: 作者回复读者的章节评论

```javascript
// 假设读者评论ID为456，章节ID为123

// 1. 先查询原评论信息
SELECT c.id, c.target_type, c.target_id, c.parent_comment_id
FROM comment c
WHERE c.id = 456
// 结果: { id: 456, target_type: 'chapter', target_id: 123, parent_comment_id: NULL }

// 2. 插入回复
INSERT INTO comment (user_id, target_type, target_id, parent_comment_id, content, created_at, likes)
VALUES (2, 'chapter', 123, 456, '谢谢您的支持！', NOW(), 0)

// 字段值说明:
// user_id = 2                    // 作者用户ID
// target_type = 'chapter'         // 保持与原评论相同
// target_id = 123                 // 保持与原评论相同（章节ID）
// parent_comment_id = 456         // 指向被回复的评论ID
// content = '谢谢您的支持！'      // 回复内容
// created_at = NOW()              // 当前时间
// likes = 0                       // 初始点赞数为0
```

### 场景3: 用户发表小说讨论（主评论）

```javascript
// 插入数据
INSERT INTO comment (user_id, target_type, target_id, parent_comment_id, content, created_at, likes)
VALUES (3, 'novel', 10, NULL, '这部小说很好看！', NOW(), 0)

// 字段值说明:
// user_id = 3                    // 用户ID
// target_type = 'novel'          // 小说讨论
// target_id = 10                 // 小说ID
// parent_comment_id = NULL       // 主评论
// content = '这部小说很好看！'    // 评论内容
```

### 场景4: 作者回复评价（review类型）

```javascript
// 假设评价ID为789，小说ID为10

// 1. 检查数据库是否支持review类型
SELECT COLUMN_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'comment' AND COLUMN_NAME = 'target_type'
// 如果支持 'review' 类型

// 2. 插入回复
INSERT INTO comment (user_id, target_type, target_id, parent_comment_id, content, created_at, likes)
VALUES (2, 'review', 789, NULL, '感谢您的评价！', NOW(), 0)

// 字段值说明:
// user_id = 2                    // 作者用户ID
// target_type = 'review'         // 回复评价
// target_id = 789                // 评价ID
// parent_comment_id = NULL       // 特殊情况，可能为NULL
// content = '感谢您的评价！'      // 回复内容
```

## 🔄 查询逻辑

### 查询主评论列表（排除回复）

```sql
-- 查询章节123的所有主评论（不是回复）
SELECT c.*, u.username, u.avatar
FROM comment c
JOIN user u ON c.user_id = u.id
WHERE c.target_type = 'chapter'
  AND c.target_id = 123
  AND c.parent_comment_id IS NULL  -- 关键：只查询主评论
ORDER BY c.created_at DESC
```

### 查询特定评论的回复

```sql
-- 查询评论ID为456的所有回复
SELECT c.*, u.username, u.avatar, u.is_author
FROM comment c
JOIN user u ON c.user_id = u.id
WHERE c.parent_comment_id = 456  -- 关键：查询回复
ORDER BY c.created_at ASC  -- 回复按时间正序显示
```

### 统计评论的回复数

```sql
-- 统计评论ID为456的回复数
SELECT COUNT(*) as reply_count
FROM comment
WHERE parent_comment_id = 456
```

## 🎯 关键设计点

1. **主评论 vs 回复**:
   - 主评论: `parent_comment_id IS NULL`
   - 回复: `parent_comment_id = 被回复的评论ID`

2. **target_type 和 target_id 的组合**:
   - 确定评论针对的对象
   - 回复时通常保持与原评论相同（除非特殊情况）

3. **回复时字段继承**:
   - 回复评论时，`target_type` 和 `target_id` 通常继承自原评论
   - 只有 `parent_comment_id` 会指向原评论ID

4. **查询性能优化**:
   - 使用 `parent_comment_id IS NULL` 快速筛选主评论
   - 使用 `parent_comment_id = ?` 快速查询回复
   - 在 `target_type` 和 `target_id` 上建立索引

## ⚠️ 注意事项

1. **回复评价的特殊处理**:
   - 如果数据库不支持 `target_type = 'review'`，会降级为 `target_type = 'novel'`
   - 此时 `parent_comment_id` 可能为 `NULL`，需要通过其他方式关联

2. **数据一致性**:
   - 插入回复时，需要验证原评论存在
   - 删除评论时，需要考虑是否级联删除回复

3. **查询过滤**:
   - 评论管理页面只显示主评论（`parent_comment_id IS NULL`）
   - 回复通过点击"回复"按钮单独加载

