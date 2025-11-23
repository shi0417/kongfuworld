# confirmed_email字段类型修改说明

## 修改内容

`confirmed_email`字段已从布尔类型（`tinyint(1)`）修改为字符串类型（`varchar(100)`），用于存储已验证的邮箱地址。

## 字段说明

### 修改前
- **类型**: `tinyint(1)`
- **用途**: 标志位，0=未确认，1=已确认
- **默认值**: 0

### 修改后
- **类型**: `varchar(100)`
- **用途**: 存储已验证通过的邮箱地址
- **默认值**: NULL

### 使用方式

**判断邮箱是否已确认：**
- 旧方式：`confirmed_email = 1`
- 新方式：`confirmed_email IS NOT NULL` 或 `confirmed_email != ''`

**获取已验证的邮箱地址：**
- 直接读取 `confirmed_email` 字段即可

## 数据迁移

已自动迁移现有数据：
- 将 `confirmed_email = 1` 的记录更新为对应的 `email` 值
- 如果 `email` 为空，则设置为 `NULL`

## 代码更新

### 后端API (`backend/routes/emailVerification.js`)

验证成功后更新逻辑：
```javascript
// 更新用户邮箱、confirmed_email（存储验证通过的邮箱地址），并设置为作者
await connection.execute(
  'UPDATE user SET email = ?, confirmed_email = ?, is_author = 1 WHERE id = ?',
  [email, email, userId]
);
```

### 数据库Schema

已更新以下文件：
- `backend/database_schema.sql`
- `backend/DATABASE_REFERENCE.md`

## 验证

字段类型已成功修改，可以通过以下方式验证：

```sql
-- 查看字段类型
DESCRIBE user;

-- 查看数据
SELECT id, email, confirmed_email FROM user WHERE confirmed_email IS NOT NULL;
```

## 注意事项

1. **NULL值表示未验证**：如果 `confirmed_email` 为 `NULL`，表示邮箱未验证
2. **邮箱地址存储**：验证通过后，`confirmed_email` 存储的是验证通过的邮箱地址
3. **与email字段的关系**：`confirmed_email` 应该是用户已验证的邮箱，可能与 `email` 字段相同，也可能不同（用户可能更换了邮箱但未重新验证）

