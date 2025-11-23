# 数据库迁移说明：添加parent_id和novel_id字段

## 迁移概述

本次迁移为评论系统添加了新的字段，实现了评论的自包含结构，使得review、comment、paragraph_comment三个表的子母评论均在他们各自的表中存储。

## 迁移内容

### 1. review表添加parent_id字段

**目的：** 将原先存储在comment表中对review的评论，改为存储在review表中，用parent_id区分是子评论还是母评论。

**变更：**
- 添加 `parent_id` int DEFAULT NULL 字段
- 添加 `idx_parent_id` 索引
- parent_id为NULL表示母评论，有值表示子评论

### 2. paragraph_comment表添加novel_id字段

**目的：** 为paragraph_comment表添加novel_id字段，方便查询和关联。

**变更：**
- 添加 `novel_id` int DEFAULT NULL 字段
- 添加 `idx_novel_id` 索引
- 根据chapter_id字段查询chapter表得到novel_id并填充

### 3. comment表添加novel_id字段

**目的：** 为comment表添加novel_id字段，方便查询和关联。

**变更：**
- 添加 `novel_id` int DEFAULT NULL 字段
- 添加 `idx_novel_id` 索引
- 仅对target_type=chapter的记录，根据target_id（即chapter_id）查询chapter表得到novel_id并填充
- target_type=review的数据暂时不管

## 执行方式

### 方式1：使用Node.js脚本执行（推荐）

```bash
cd backend/migrations
node add_parent_id_to_review_and_novel_id_fields.js
```

### 方式2：直接执行SQL文件

```bash
mysql -u root -p kongfuworld < backend/migrations/add_parent_id_to_review_and_novel_id_fields.sql
```

## 迁移文件

- `add_parent_id_to_review_and_novel_id_fields.sql` - SQL迁移脚本
- `add_parent_id_to_review_and_novel_id_fields.js` - Node.js执行脚本（包含验证逻辑）

## 注意事项

1. **数据迁移：** 迁移脚本会自动填充novel_id字段的数据
2. **向后兼容：** 新字段均为可空字段，不会影响现有数据
3. **索引优化：** 为新字段添加了索引以提高查询性能
4. **review表的子评论：** 原先存储在comment表中target_type=review的评论，需要手动迁移到review表中（本次迁移不包含此步骤）

## 验证

执行迁移脚本后，会自动验证：
- review表的parent_id字段是否添加成功
- paragraph_comment表的novel_id字段是否添加成功及数据填充情况
- comment表的novel_id字段是否添加成功及数据填充情况

## 后续工作

1. 需要将comment表中target_type=review的评论迁移到review表中
2. 更新相关API代码，使用新的字段结构
3. 更新前端代码，适配新的评论结构
