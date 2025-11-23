# novel 表新增字段说明

## 操作完成

已成功为 `novel` 表添加了两个新字段。

## 新增字段

### 1. recommendation（推荐语）
- **类型**: `text`
- **可空**: `YES`
- **默认值**: `NULL`
- **注释**: 推荐语
- **位置**: 在 `description` 字段之后

### 2. languages（支持的语言）
- **类型**: `varchar(255)`
- **可空**: `YES`
- **默认值**: `NULL`
- **注释**: 支持的语言（如：en,zh,es，多个语言用逗号分隔）
- **位置**: 在 `recommendation` 字段之后

## 使用示例

### 插入数据

```sql
-- 只设置推荐语
INSERT INTO novel (title, author, description, recommendation, languages) 
VALUES ('Novel Title', 'Author Name', 'Description...', '这是一部精彩的小说！', 'zh');

-- 设置推荐语和多个语言
INSERT INTO novel (title, author, description, recommendation, languages) 
VALUES ('Novel Title', 'Author Name', 'Description...', 'A fantastic novel!', 'en,zh,es');
```

### 查询数据

```sql
-- 查询包含新字段的小说信息
SELECT 
  id, 
  title, 
  author, 
  description, 
  recommendation, 
  languages, 
  chapters 
FROM novel 
WHERE id = 1;
```

### 更新数据

```sql
-- 更新推荐语
UPDATE novel 
SET recommendation = '新推荐语' 
WHERE id = 1;

-- 更新支持的语言
UPDATE novel 
SET languages = 'en,zh,fr' 
WHERE id = 1;

-- 同时更新两个字段
UPDATE novel 
SET recommendation = '推荐语',
    languages = 'en,zh'
WHERE id = 1;
```

## languages 字段格式说明

`languages` 字段使用逗号分隔的语言代码，常见格式：
- 单个语言: `en` 或 `zh`
- 多个语言: `en,zh` 或 `en,zh,es,fr`
- 语言代码建议使用 ISO 639-1 标准（如：en, zh, es, fr, de, ja, ko）

## API 更新

### 已更新的 API

**GET /api/novel/:id/details**
- 现在返回 `recommendation` 和 `languages` 字段

```json
{
  "novel": {
    "id": 1,
    "title": "Novel Title",
    "author": "Author Name",
    "translator": "Translator Name",
    "description": "Novel description...",
    "recommendation": "推荐语",
    "languages": "en,zh",
    "chapters": 100,
    "licensed_from": "Yuewen",
    "status": "ongoing",
    "cover": "cover_url",
    "rating": 85,
    "reviews": 10
  }
}
```

## 已更新的文件

### SQL 脚本
- ✅ `backend/add_recommendation_languages_to_novel.sql` - 字段添加脚本
- ✅ `backend/database_schema.sql` - 表定义已更新

### JavaScript 脚本
- ✅ `backend/add_fields_to_novel.js` - 字段添加执行脚本

### 文档
- ✅ `backend/DATABASE_REFERENCE.md` - 数据库参考文档已更新

### API 代码
- ✅ `backend/server.js` - `/api/novel/:id/details` 查询已更新

## 验证命令

执行以下命令验证字段是否已正确添加：
```bash
node add_fields_to_novel.js
```

## 注意事项

1. **字段可空性**: 两个字段都是可空的，现有数据不会受影响
2. **向后兼容**: 现有的 API 和代码可以继续正常工作，新字段在未设置时返回 `null`
3. **languages 格式**: 建议使用标准的语言代码，多个语言用逗号分隔，不要有空格
4. **推荐语长度**: `recommendation` 是 `text` 类型，可以存储较长的文本内容

