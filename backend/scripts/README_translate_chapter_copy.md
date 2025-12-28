# Chapter Copy 批量翻译脚本使用说明

## 功能说明

该脚本用于批量翻译 `chapter_copy` 表中的 `content_china` 字段（中文内容）到 `content_eng` 字段（英文内容）。

## 前置要求

1. **环境变量配置**：
   - `OPENAI_API_KEY`: OpenAI API 密钥（必需）
   - `DB_HOST`: 数据库主机（默认：localhost）
   - `DB_USER`: 数据库用户名（默认：root）
   - `DB_PASSWORD`: 数据库密码（默认：123456）
   - `DB_NAME`: 数据库名（默认：kongfuworld）

2. **数据库表结构**：
   确保 `chapter_copy` 表存在，且包含以下字段：
   - `id`: 主键
   - `content_china`: 中文内容字段（TEXT 或 LONGTEXT）
   - `content_eng`: 英文内容字段（TEXT 或 LONGTEXT）

## 使用方法

### 基本用法

```bash
# 翻译所有 content_china 不为空且 content_eng 为空的记录
node backend/scripts/translate_chapter_copy.js
```

### 常用选项

```bash
# 试运行模式（仅显示将要翻译的记录，不实际执行）
node backend/scripts/translate_chapter_copy.js --dry-run

# 限制翻译前 50 条记录
node backend/scripts/translate_chapter_copy.js --limit 50

# 跳过前 100 条，翻译接下来的 50 条
node backend/scripts/translate_chapter_copy.js --offset 100 --limit 50

# 自定义批次大小（默认 10）
node backend/scripts/translate_chapter_copy.js --batch-size 5

# 自定义 WHERE 条件（例如：只翻译特定 ID 范围的记录）
node backend/scripts/translate_chapter_copy.js --where-clause "id >= 1 AND id <= 100 AND content_eng IS NULL"

# 组合使用：试运行 + 限制数量
node backend/scripts/translate_chapter_copy.js --dry-run --limit 10
```

## 选项说明

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--limit N` | 限制翻译的记录数 | 无限制 |
| `--offset N` | 跳过前 N 条记录 | 0 |
| `--batch-size N` | 每批处理的记录数 | 10 |
| `--dry-run` | 试运行模式，不实际执行翻译 | false |
| `--where-clause "条件"` | 自定义 WHERE 条件 | 默认：`content_china IS NOT NULL AND content_china != "" AND (content_eng IS NULL OR content_eng = "")` |

## 注意事项

1. **API 速率限制**：
   - 脚本在每条记录之间会延迟 1 秒
   - 每个批次之间会延迟 2 秒
   - 如果遇到速率限制错误，脚本会自动重试（最多 3 次）

2. **文本长度限制**：
   - 单次翻译的文本长度限制为 8000 字符（约 2000 中文字符）
   - 超过限制的文本会被截断

3. **翻译模型**：
   - 默认使用 `gpt-4o-mini` 模型
   - 可通过环境变量 `OPENAI_MODEL` 修改

4. **错误处理**：
   - 翻译失败的记录会被记录，但不会中断整个流程
   - 最终会输出失败记录的统计信息

5. **数据库连接**：
   - 脚本执行完成后会自动关闭数据库连接
   - 如果中途中断（Ctrl+C），可能需要手动检查数据库状态

## 示例输出

```
=== Chapter Copy 批量翻译工具 ===
配置:
  限制记录数: 无限制
  偏移量: 0
  批次大小: 10
  试运行模式: 否
  WHERE 条件: 默认（content_china 不为空且 content_eng 为空）

正在连接数据库...
数据库连接成功

正在查询需要翻译的记录...
找到 25 条需要翻译的记录

准备翻译 25 条记录
按 Ctrl+C 取消，或等待 5 秒后开始...

处理批次 1/3 (10 条记录)
[翻译中] ID: 1, 内容长度: 1234 字符
[成功] ID: 1, 翻译后长度: 2345 字符
...

=== 翻译完成 ===
总记录数: 25
成功: 23
失败: 2
耗时: 125 秒

失败的记录:
  ID 15: Translation failed: Rate limit exceeded after 3 retries
  ID 20: Translation returned empty result

数据库连接已关闭
```

## 故障排查

1. **"OPENAI_API_KEY 环境变量未设置"**：
   - 检查 `.env` 文件或环境变量中是否设置了 `OPENAI_API_KEY`

2. **"chapter_copy 表不存在"**：
   - 确认数据库中存在 `chapter_copy` 表
   - 检查数据库名称是否正确

3. **"缺少必要字段"**：
   - 确认 `chapter_copy` 表包含 `id`、`content_china`、`content_eng` 字段

4. **翻译失败率高**：
   - 检查网络连接
   - 检查 OpenAI API 配额
   - 尝试减小 `--batch-size` 参数
   - 检查文本内容是否包含特殊字符或格式问题

## 性能建议

- 对于大量数据，建议使用 `--limit` 和 `--offset` 分批处理
- 如果遇到速率限制，可以减小 `--batch-size` 或增加延迟时间
- 建议在非高峰时段运行，避免影响其他服务

