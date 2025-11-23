# 推荐人表 (referrals) 实现说明

## 概述
创建了 `referrals` 表，用于记录用户推荐关系和推广分成方案配置。

## 数据库表结构

### `referrals` 表

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `id` | BIGINT | NO | AUTO_INCREMENT | 主键，自增 |
| `user_id` | INT | NO | - | 被推荐用户ID，外键关联user表 |
| `referrer_id` | INT | NO | - | 推荐人ID，外键关联user表 |
| `promoter_plan_id` | BIGINT | YES | NULL | 推广人员分成方案ID |
| `author_plan_id` | BIGINT | YES | NULL | 作者推广分成方案ID |
| `created_at` | DATETIME | NO | CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | DATETIME | NO | CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | 更新时间 |

## 索引设计

### 主键
- `PRIMARY KEY (id)`: 主键索引

### 唯一索引
- `UNIQUE KEY uk_user_referrer (user_id, referrer_id)`: 确保同一用户和推荐人的组合唯一，防止重复记录

### 普通索引
- `KEY idx_user_id (user_id)`: 用于快速查询某个用户的所有推荐关系
- `KEY idx_referrer_id (referrer_id)`: 用于快速查询某个推荐人的所有被推荐用户
- `KEY idx_promoter_plan_id (promoter_plan_id)`: 用于快速查询使用特定推广人员分成方案的记录
- `KEY idx_author_plan_id (author_plan_id)`: 用于快速查询使用特定作者推广分成方案的记录
- `KEY idx_created_at (created_at)`: 用于按时间排序和查询

## 外键约束

- `fk_referrals_user_id`: `user_id` 外键关联 `user(id)`，级联删除
- `fk_referrals_referrer_id`: `referrer_id` 外键关联 `user(id)`，级联删除

## 实现文件

### 1. 数据库迁移文件
- `backend/migrations/create_referrals_table.sql`: SQL建表脚本
- `backend/create_referrals_table.js`: Node.js脚本，用于执行建表操作

## 使用场景

### 1. 记录推荐关系
当用户通过推荐链接注册时，在 `referrals` 表中创建一条记录：
```sql
INSERT INTO referrals (user_id, referrer_id, created_at)
VALUES (新用户ID, 推荐人ID, NOW());
```

### 2. 配置分成方案
为推荐关系配置推广人员或作者的分成方案：
```sql
UPDATE referrals 
SET promoter_plan_id = 1, author_plan_id = 2
WHERE user_id = ? AND referrer_id = ?;
```

### 3. 查询推荐关系
- 查询某个用户的所有推荐人：
```sql
SELECT r.*, u.username as referrer_name
FROM referrals r
JOIN user u ON r.referrer_id = u.id
WHERE r.user_id = ?;
```

- 查询某个推荐人的所有被推荐用户：
```sql
SELECT r.*, u.username as user_name
FROM referrals r
JOIN user u ON r.user_id = u.id
WHERE r.referrer_id = ?;
```

- 查询使用特定分成方案的推荐关系：
```sql
SELECT * FROM referrals 
WHERE promoter_plan_id = ? OR author_plan_id = ?;
```

## 与 user 表的关系

`referrals` 表与 `user` 表的关系：
- `referrals` 表: 存储完整的推荐关系记录，包括分成方案配置
- `user` 表: 不再包含 `referrer_id` 字段，所有推荐关系都通过 `referrals` 表管理

**注意**: `user` 表中的 `referrer_id` 字段已被删除，所有推荐关系现在统一通过 `referrals` 表管理。

## 注意事项

1. **唯一性约束**: `(user_id, referrer_id)` 组合必须唯一，防止重复记录
2. **外键级联**: 当用户被删除时，相关的推荐记录也会被自动删除
3. **分成方案**: `promoter_plan_id` 和 `author_plan_id` 可以为 NULL，表示未配置分成方案
4. **时间戳**: `created_at` 和 `updated_at` 自动管理，无需手动设置

## 后续扩展建议

1. **分成方案表**: 创建 `promoter_plans` 和 `author_plans` 表，存储具体的分成方案配置
2. **推荐统计**: 基于此表统计推荐人数、推荐收益等数据
3. **推荐层级**: 如果需要支持多级推荐，可以添加 `level` 字段
4. **推荐奖励记录**: 可以创建关联表记录每次推荐奖励的发放情况

