# novel_genre_relation 表结构修改说明

## 操作完成

已成功完成对 `novel_genre_relation` 表的所有修改。

## 修改内容

### 1. 字段重命名
- ✅ `genre_id` → `genre_id_1`

### 2. 新增字段
- ✅ `genre_id_2` (int, 可空) - 第二类型ID
- ✅ `updated_at` (datetime) - 更新时间（自动更新）

### 3. 删除字段
- ✅ `genre_name` - 已删除
- ✅ `genre_chinese_name` - 已删除

### 4. 索引修改
- ✅ 删除了旧索引 `unique_novel_genre` (novel_id, genre_id)
- ✅ 删除了旧索引 `genre_id`
- ✅ 新增唯一索引 `unique_id_novel` (id, novel_id)

### 5. 外键约束更新
- ✅ `novel_genre_relation_ibfk_2`: `genre_id_1` → `genre.id` (ON DELETE CASCADE)
- ✅ `novel_genre_relation_ibfk_3`: `genre_id_2` → `genre.id` (ON DELETE SET NULL) - 新增

## 最终表结构

```sql
CREATE TABLE `novel_genre_relation` (
  `id` int NOT NULL AUTO_INCREMENT,
  `novel_id` int NOT NULL,
  `genre_id_1` int NOT NULL,
  `genre_id_2` int DEFAULT NULL COMMENT '第二类型ID',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_id_novel` (`id`, `novel_id`),
  KEY `novel_id` (`novel_id`),
  KEY `genre_id_1` (`genre_id_1`),
  KEY `genre_id_2` (`genre_id_2`),
  CONSTRAINT `novel_genre_relation_ibfk_1` FOREIGN KEY (`novel_id`) REFERENCES `novel` (`id`) ON DELETE CASCADE,
  CONSTRAINT `novel_genre_relation_ibfk_2` FOREIGN KEY (`genre_id_1`) REFERENCES `genre` (`id`) ON DELETE CASCADE,
  CONSTRAINT `novel_genre_relation_ibfk_3` FOREIGN KEY (`genre_id_2`) REFERENCES `genre` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 索引说明

### 唯一索引
- `unique_id_novel` (id, novel_id) - 唯一索引，确保同一小说在同一记录中的唯一性

### 普通索引
- `PRIMARY` (id) - 主键
- `novel_id` (novel_id) - 用于快速查询小说关联的类型
- `genre_id_1` (genre_id_1) - 用于快速查询主类型关联的小说
- `genre_id_2` (genre_id_2) - 用于快速查询第二类型关联的小说

### 外键索引
- `novel_genre_relation_ibfk_2` (genre_id_1) - 外键索引
- `novel_genre_relation_ibfk_3` (genre_id_2) - 外键索引

## 外键约束

1. **novel_genre_relation_ibfk_1**
   - `novel_id` → `novel.id`
   - 删除策略: CASCADE

2. **novel_genre_relation_ibfk_2**
   - `genre_id_1` → `genre.id`
   - 删除策略: CASCADE

3. **novel_genre_relation_ibfk_3** (新增)
   - `genre_id_2` → `genre.id`
   - 删除策略: SET NULL（允许为空）

## 已更新的文件

### SQL 脚本
- ✅ `backend/modify_novel_genre_relation.sql` - 修改脚本
- ✅ `backend/homepage_database_schema.sql` - 表定义已更新
- ✅ `backend/update_database_homepage.sql` - 表定义已更新

### JavaScript 脚本
- ✅ `backend/create_homepage_tables.js` - 表创建语句已更新
- ✅ `backend/modify_novel_genre_relation.js` - 修改执行脚本
- ✅ `backend/verify_novel_genre_relation_final.js` - 验证脚本

## 使用示例

### 插入数据（支持两个类型）

```sql
-- 只设置主类型
INSERT INTO novel_genre_relation (novel_id, genre_id_1) 
VALUES (1, 1);

-- 设置主类型和第二类型
INSERT INTO novel_genre_relation (novel_id, genre_id_1, genre_id_2) 
VALUES (1, 1, 2);
```

### 查询小说及其类型

```sql
SELECT 
  ngr.id,
  ngr.novel_id,
  ngr.genre_id_1,
  g1.name as genre_1_name,
  g1.chinese_name as genre_1_chinese,
  ngr.genre_id_2,
  g2.name as genre_2_name,
  g2.chinese_name as genre_2_chinese,
  ngr.created_at,
  ngr.updated_at
FROM novel_genre_relation ngr
LEFT JOIN genre g1 ON ngr.genre_id_1 = g1.id
LEFT JOIN genre g2 ON ngr.genre_id_2 = g2.id
WHERE ngr.novel_id = 1;
```

## 验证命令

执行以下命令验证表结构：
```bash
node verify_novel_genre_relation_final.js
```

## 注意事项

1. **唯一索引 (id, novel_id)**
   - 这个唯一索引确保同一 `(id, novel_id)` 组合只能存在一次
   - 注意：`id` 本身是主键，已经是唯一的，所以这个组合索引主要用于数据完整性检查

2. **genre_id_2 的可空性**
   - `genre_id_2` 是可选的，允许小说只有一个主类型
   - 删除关联的类型时，`genre_id_2` 会被设置为 NULL（SET NULL），而 `genre_id_1` 会级联删除整条记录（CASCADE）

3. **updated_at 字段**
   - 使用 `ON UPDATE CURRENT_TIMESTAMP`，会在记录更新时自动更新时间戳

