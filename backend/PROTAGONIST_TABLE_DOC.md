# protagonist 表说明文档

## 表概述

`protagonist` 表用于存储小说的主角名称信息。**支持一本小说有多个主角**，通过 `novel_id` 字段关联到 `novel` 表。

## 表结构

```sql
CREATE TABLE `protagonist` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主角ID',
  `novel_id` int NOT NULL COMMENT '小说ID',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '主角名',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_novel_id` (`novel_id`),
  CONSTRAINT `protagonist_ibfk_novel` FOREIGN KEY (`novel_id`) REFERENCES `novel` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='主角名表';
```

## 字段说明

### id
- **类型**: `int`
- **约束**: 主键，自增
- **说明**: 主角记录唯一标识符

### novel_id
- **类型**: `int`
- **约束**: 非空，外键关联 `novel.id`
- **说明**: 所属小说的ID
- **特点**: **不唯一**，允许同一小说有多个主角记录

### name
- **类型**: `varchar(100)`
- **约束**: 非空
- **说明**: 主角名称

### created_at
- **类型**: `datetime`
- **默认值**: `CURRENT_TIMESTAMP`
- **说明**: 记录创建时间

## 索引说明

1. **PRIMARY KEY (id)**
   - 主键索引，确保每条记录的唯一性

2. **KEY idx_novel_id (novel_id)**
   - 普通索引，用于快速查询某小说的所有主角
   - 提高 `WHERE novel_id = ?` 查询性能

## 外键约束

**protagonist_ibfk_novel**
- **字段**: `novel_id`
- **引用**: `novel.id`
- **删除策略**: `ON DELETE CASCADE`
  - 当删除小说时，该小说的所有主角记录会自动删除

## 使用示例

### 1. 插入主角数据

```sql
-- 为小说添加单个主角
INSERT INTO protagonist (novel_id, name) 
VALUES (1, '张三');

-- 为同一小说添加多个主角
INSERT INTO protagonist (novel_id, name) VALUES
(1, '主角一'),
(1, '主角二'),
(1, '主角三');
```

### 2. 查询某小说的所有主角

```sql
-- 查询小说ID为1的所有主角
SELECT id, name, created_at 
FROM protagonist 
WHERE novel_id = 1 
ORDER BY created_at;
```

### 3. 查询小说及其所有主角（JOIN查询）

```sql
-- 查询小说及其所有主角
SELECT 
  n.id as novel_id,
  n.title as novel_title,
  p.id as protagonist_id,
  p.name as protagonist_name
FROM novel n
LEFT JOIN protagonist p ON n.id = p.novel_id
WHERE n.id = 1;
```

### 4. 统计每本小说的主角数量

```sql
SELECT 
  n.id,
  n.title,
  COUNT(p.id) as protagonist_count
FROM novel n
LEFT JOIN protagonist p ON n.id = p.novel_id
GROUP BY n.id, n.title
ORDER BY protagonist_count DESC;
```

### 5. 更新主角名称

```sql
UPDATE protagonist 
SET name = '新主角名' 
WHERE id = 1;
```

### 6. 删除特定主角

```sql
DELETE FROM protagonist WHERE id = 1;
```

### 7. 删除某小说的所有主角

```sql
DELETE FROM protagonist WHERE novel_id = 1;
```

## 数据特点

1. **多主角支持**
   - 同一 `novel_id` 可以有多条记录
   - 例如：一本小说可以有多个主角

2. **级联删除**
   - 删除小说时，相关的主角记录会自动删除
   - 不需要手动清理主角数据

3. **不限制主角数量**
   - 理论上可以为每本小说添加任意数量的主角

## 注意事项

1. **名称重复处理**
   - 同一小说的主角名称可以重复（如果需要）
   - 如果业务需求要求同一小说的主角名不重复，需要在应用层进行验证

2. **外键约束**
   - `novel_id` 必须是 `novel` 表中存在的ID
   - 插入不存在的 `novel_id` 会导致外键约束错误

3. **性能考虑**
   - `idx_novel_id` 索引可以加速按小说ID查询主角的操作
   - 如果主角数量很大，可以考虑添加其他索引

## 扩展建议

1. **添加角色类型字段**
   - 可以添加 `role_type` 字段区分主角、配角等
   - 例如：`role_type ENUM('protagonist', 'supporting', 'antagonist')`

2. **添加排序字段**
   - 可以添加 `order` 或 `display_order` 字段用于控制显示顺序

3. **添加性别字段**
   - 可以添加 `gender` 字段存储主角性别信息

## 相关文件

- `backend/create_protagonist_table.sql` - 表创建 SQL 脚本
- `backend/create_protagonist_table.js` - 表创建执行脚本
- `backend/database_schema.sql` - 数据库架构文档
- `backend/DATABASE_REFERENCE.md` - 数据库参考文档

