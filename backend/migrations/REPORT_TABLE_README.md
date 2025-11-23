# Report 表创建说明

## 概述

`report` 表用于存储用户举报的评论信息，支持对三种类型的评论进行举报：
- `review` - 小说评价
- `comment` - 通用评论
- `paragraph_comment` - 段落评论

## 表结构

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | int | 主键，自增 |
| `user_id` | int | 举报用户的ID，外键关联 `user` 表 |
| `type` | enum | 举报类型：`review`、`comment`、`paragraph_comment` |
| `remark_id` | int | 被举报内容的ID（根据 `type` 对应 `review.id`、`comment.id` 或 `paragraph_comment.id`） |
| `report` | enum | 举报原因：`Spoilers`、`Abuse or harassment`、`Spam`、`Copyright infringement`、`Discrimination (racism, sexism, etc.)`、`Request to delete a comment that you created` |
| `created_at` | datetime | 创建时间，默认当前时间 |

## 索引

- `PRIMARY KEY (id)` - 主键索引
- `idx_user_id (user_id)` - 用户ID索引，用于快速查询某个用户的所有举报
- `idx_type_remark_id (type, remark_id)` - 复合索引，用于快速查询某个评论的所有举报
- `idx_created_at (created_at)` - 创建时间索引，用于按时间排序查询

## 外键约束

- `report_ibfk_user`: `user_id` 外键关联 `user.id`，级联删除

## 使用方法

### 方法1：使用 SQL 文件

```bash
mysql -u root -p kongfuworld < backend/migrations/create_report_table.sql
```

### 方法2：使用 Node.js 脚本

```bash
node backend/migrations/create_report_table.js
```

## 数据关系说明

### type 字段与 remark_id 的对应关系

- 当 `type = 'review'` 时，`remark_id` 对应 `review` 表的 `id`
- 当 `type = 'comment'` 时，`remark_id` 对应 `comment` 表的 `id`
- 当 `type = 'paragraph_comment'` 时，`remark_id` 对应 `paragraph_comment` 表的 `id`

### 举报原因说明

- **Spoilers** - 剧透内容
- **Abuse or harassment** - 滥用或骚扰
- **Spam** - 垃圾信息
- **Copyright infringement** - 版权侵权
- **Discrimination (racism, sexism, etc.)** - 歧视（种族主义、性别歧视等）
- **Request to delete a comment that you created** - 请求删除自己创建的评论

## 示例查询

### 查询某个用户的所有举报

```sql
SELECT * FROM report WHERE user_id = 1;
```

### 查询某个评论的所有举报

```sql
SELECT * FROM report 
WHERE type = 'comment' AND remark_id = 123;
```

### 查询最近的举报记录

```sql
SELECT * FROM report 
ORDER BY created_at DESC 
LIMIT 10;
```

### 统计每种举报原因的数量

```sql
SELECT report, COUNT(*) as count 
FROM report 
GROUP BY report 
ORDER BY count DESC;
```

## 注意事项

1. 一个用户可以对同一个评论进行多次举报（如果需要限制，需要在应用层实现）
2. `remark_id` 字段没有外键约束，因为需要根据 `type` 动态关联不同的表
3. 删除用户时，该用户的所有举报记录会被级联删除
4. 建议在应用层实现防重复举报的逻辑（例如：同一用户对同一评论的相同举报原因在24小时内只能举报一次）

