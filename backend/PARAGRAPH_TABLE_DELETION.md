# paragraph 表删除说明

## 删除原因

经过检查，`paragraph` 表在系统中**完全没有被使用**：

1. **数据状态**: 表中没有任何数据（记录数为 0）
2. **代码引用**: 代码中没有任何 INSERT、UPDATE、DELETE 或 SELECT 操作涉及此表
3. **依赖关系**: 没有其他表依赖 `paragraph` 表

## 相关说明

### ❌ paragraph 表（已删除）
- **状态**: 已删除
- **用途**: 原本设计用于存储章节中的段落内容
- **实际使用**: 未被使用，章节内容直接存储在 `chapter.content` 字段中

### ✅ paragraph_comment 表（仍在使用）
- **状态**: 正常使用
- **用途**: 存储用户对章节中某个段落索引的评论
- **关键字段**: `paragraph_index`（段落索引号，不是 paragraph 表的 ID）
- **相关 API**: 
  - `GET /api/chapter/:chapterId/paragraph-comments`
  - `GET /api/chapter/:chapterId/paragraph/:paragraphIndex/comments`
  - `POST /api/chapter/:chapterId/paragraph/:paragraphIndex/comments`

### ✅ comment 表的 target_type（仍在使用）
- **状态**: 正常使用
- **说明**: `comment` 表的 `target_type` 字段包含 `'paragraph'` 选项
- **注意**: 这里的 `'paragraph'` 是评论类型标识，不是指 `paragraph` 表本身

## 删除操作

### 已执行的删除步骤
1. ✅ 删除外键约束: `paragraph_ibfk_1`
2. ✅ 删除表: `DROP TABLE paragraph`

### 文件更新
- ✅ `backend/database_schema.sql` - 已移除 paragraph 表定义
- ✅ `backend/database_schema.md` - 已移除 paragraph 表说明

## 验证

执行 `node check_paragraph_table.js` 确认表已成功删除。

