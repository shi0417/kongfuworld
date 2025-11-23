# languages 表说明文档

## 表概述

`languages` 表用于存储系统支持的语言列表，为小说和其他内容的多语言支持提供基础数据。

## 表结构

```sql
CREATE TABLE `languages` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '语言ID',
  `language` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '语言名称',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_language` (`language`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='语言表';
```

## 字段说明

### id
- **类型**: `int`
- **约束**: 主键，自增
- **说明**: 语言唯一标识符

### language
- **类型**: `varchar(100)`
- **约束**: 非空，唯一索引
- **说明**: 语言名称（如：Chinese, Korean, English）

### created_at
- **类型**: `datetime`
- **默认值**: `CURRENT_TIMESTAMP`
- **说明**: 记录创建时间

## 默认数据

表已预置以下语言数据：

| id | language | created_at |
|----|----------|------------|
| 1  | Chinese  | 2025-11-01 |
| 2  | Korean   | 2025-11-01 |
| 3  | English  | 2025-11-01 |

## 索引说明

1. **PRIMARY KEY (id)**
   - 主键索引，确保每条记录的唯一性

2. **UNIQUE KEY unique_language (language)**
   - 唯一索引，确保语言名称不重复
   - 防止插入重复的语言记录

## 使用示例

### 查询所有语言

```sql
SELECT * FROM languages ORDER BY id;
```

### 查询特定语言

```sql
SELECT * FROM languages WHERE language = 'Chinese';
```

### 添加新语言

```sql
INSERT INTO languages (language) VALUES ('Japanese');
```

### 更新语言名称

```sql
UPDATE languages SET language = '简体中文' WHERE id = 1;
```

### 删除语言（谨慎使用）

```sql
DELETE FROM languages WHERE id = 4;
```

## 与其他表的关系

### 与 novel 表的关系

`novel` 表的 `languages` 字段可以存储逗号分隔的语言代码，参考 `languages` 表中的 `language` 值：

```sql
-- 示例：查询支持中文的小说
SELECT * FROM novel 
WHERE languages LIKE '%Chinese%' 
   OR languages LIKE '%,Chinese,%' 
   OR languages LIKE 'Chinese,%' 
   OR languages LIKE '%,Chinese';
```

## 扩展建议

1. **添加语言代码字段**
   - 可以考虑添加 `code` 字段（如：zh, ko, en）用于标准化语言标识
   
2. **添加中文名称字段**
   - 可以考虑添加 `chinese_name` 字段用于显示（如：中文、韩语、英语）

3. **添加状态字段**
   - 可以考虑添加 `is_active` 字段用于控制语言的启用/禁用状态

## 相关文件

- `backend/create_languages_table.sql` - 表创建 SQL 脚本
- `backend/create_languages_table.js` - 表创建执行脚本
- `backend/database_schema.sql` - 数据库架构文档
- `backend/DATABASE_REFERENCE.md` - 数据库参考文档

