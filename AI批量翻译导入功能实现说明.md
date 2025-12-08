# AI 批量翻译导入功能实现说明

## 一、新增/修改的文件列表

### 前端文件

1. **`frontend/src/pages/adminMenuConfig.ts`**
   - 新增 `ai-batch-translation` 菜单项类型
   - 在 `incomeEditorMenuGroup.items` 中添加新菜单项

2. **`frontend/src/pages/AdminPanel.tsx`**
   - 更新 `TabType` 类型，添加 `'ai-batch-translation'`
   - 导入 `AIBatchTranslation` 组件
   - 添加 Tab 渲染逻辑

3. **`frontend/src/pages/AdminPanel/AIBatchTranslation/index.tsx`**（新建）
   - AI 批量翻译导入主页面组件
   - 包含表单输入、任务启动、进度展示等功能

4. **`frontend/src/pages/AdminPanel/AIBatchTranslation/AIBatchTranslation.module.css`**（新建）
   - 页面样式文件

### 后端文件

1. **`backend/migrations/015_create_translation_tables.sql`**（新建）
   - 创建 `translation_task` 表（翻译任务表）
   - 创建 `chapter_translation` 表（章节翻译表）

2. **`backend/ai/chapterSegmentation.js`**（新建）
   - 章节分割服务
   - 从整本文本中切分出章节列表

3. **`backend/ai/translationModel.js`**（新建）
   - AI 翻译模型服务
   - 封装 OpenAI API 调用
   - 提供翻译章节标题和正文的功能

4. **`backend/ai/translationTaskService.js`**（新建）
   - 翻译任务服务
   - 管理翻译任务的创建、执行和查询

5. **`backend/routes/adminAiTranslation.js`**（新建）
   - Admin AI 批量翻译导入路由
   - 提供任务创建和查询接口

6. **`backend/server.js`**
   - 注册新的 admin AI 翻译路由

## 二、新增的数据库表结构

### 1. `translation_task` 表（翻译任务表）

**用途**：存储翻译任务的基本信息和进度

**主要字段**：
- `id`：任务ID（主键）
- `novel_id`：小说ID
- `source_language`：源语言（默认 'zh'）
- `target_language`：目标语言（默认 'en'）
- `status`：任务状态（'pending'/'running'/'completed'/'failed'）
- `total_chapters`：总章节数
- `completed_chapters`：已完成章节数
- `failed_chapters`：失败章节数
- `created_by_admin_id`：发起任务的管理员ID
- `error_message`：错误信息

**索引**：
- `idx_novel_status`：(`novel_id`, `status`)

### 2. `chapter_translation` 表（章节翻译表）

**用途**：存储每个章节的翻译内容和状态

**主要字段**：
- `id`：记录ID（主键）
- `novel_id`：小说ID
- `chapter_id`：关联的章节ID（导入后填充）
- `chapter_number`：章节号
- `language`：目标语言（如 'en'）
- `title`：翻译后的标题
- `content`：翻译后的正文
- `status`：状态（'pending'/'translated'/'imported'/'failed'）
- `task_id`：关联的翻译任务ID
- `error_message`：错误信息

**索引**：
- `idx_novel_lang`：(`novel_id`, `language`)
- `idx_task`：(`task_id`)
- `idx_chapter_id`：(`chapter_id`)

## 三、后端新增的主要 API 列表

### 1. POST `/api/admin/ai-translation/start-from-text`

**功能**：从文本开始翻译任务

**请求体**：
```json
{
  "novelId": 123,
  "sourceText": "第1章 标题\n正文内容..."
}
```

**响应**：
```json
{
  "success": true,
  "data": {
    "taskId": 1,
    "task": {
      "id": 1,
      "novel_id": 123,
      "status": "pending",
      "total_chapters": 10,
      "completed_chapters": 0,
      "failed_chapters": 0
    },
    "chapters": [
      {
        "id": 1,
        "chapter_number": 1,
        "title": "第1章 标题",
        "status": "pending"
      }
    ],
    "totalChapters": 10
  }
}
```

**说明**：
- 需要管理员认证（Bearer Token）
- 会自动创建翻译任务并开始异步执行
- 返回任务ID和初始状态

### 2. GET `/api/admin/ai-translation/task/:taskId`

**功能**：获取任务详情和进度

**响应**：
```json
{
  "success": true,
  "data": {
    "task": {
      "id": 1,
      "novel_id": 123,
      "status": "running",
      "total_chapters": 10,
      "completed_chapters": 5,
      "failed_chapters": 0
    },
    "chapters": [
      {
        "id": 1,
        "chapter_number": 1,
        "title": "Chapter 1: Title",
        "status": "imported",
        "chapter_id": 1001,
        "error_message": null
      },
      {
        "id": 2,
        "chapter_number": 2,
        "title": "Chapter 2: Title",
        "status": "translated",
        "chapter_id": null,
        "error_message": null
      }
    ]
  }
}
```

**说明**：
- 需要管理员认证
- 前端可以轮询此接口获取任务进度
- 返回任务状态和所有章节的翻译状态

## 四、前端页面使用方式

### 4.1 访问入口

1. 登录后台管理系统（AdminPanel）
2. 在左侧导航中找到「收益与编辑管理」分组
3. 展开分组，点击「AI 批量翻译导入」菜单项

### 4.2 发起翻译任务

1. **输入小说ID**：
   - 在「小说ID」输入框中填入要导入的小说ID
   - 确保该小说已存在于系统中

2. **粘贴源文本**：
   - 在「源文本内容」文本框中粘贴中文小说文本
   - 支持包含「第X章」、「Chapter X」等章节标识
   - 系统会自动识别并分割章节

3. **开始翻译**：
   - 点击「开始解析并翻译」按钮
   - 系统会创建翻译任务并开始异步处理

### 4.3 查看任务进度

1. **任务信息**：
   - 任务创建后，页面会显示任务ID、状态、总章节数、已完成数、失败数等信息

2. **章节列表**：
   - 显示所有章节的翻译状态
   - 状态包括：待处理、翻译完成、已导入、失败
   - 失败的章节会显示错误信息

3. **自动刷新**：
   - 页面每3秒自动轮询任务状态
   - 任务完成后自动停止轮询

### 4.4 重置任务

- 点击「重置」按钮可以清空当前任务，开始新的翻译任务

## 五、环境变量配置

需要在 `.env` 文件中配置以下环境变量：

```env
# OpenAI API 配置
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini  # 可选，默认为 gpt-4o-mini

# AI 翻译功能开关
KFW_AI_TRANSLATION_ENABLED=true  # 可选，默认为 true
```

## 六、数据库迁移

执行以下 SQL 文件创建新表：

```bash
# 在 MySQL 中执行
mysql -u root -p kongfuworld < backend/migrations/015_create_translation_tables.sql
```

或者手动执行 SQL 文件中的内容。

## 七、注意事项

1. **章节创建逻辑**：
   - 翻译导入的章节默认设置为草稿状态（`review_status='draft'`）
   - 需要管理员在「章节审批」页面审核后才能发布
   - 不自动计算解锁价格和预读章节设置（简化处理）

2. **章节号冲突**：
   - 如果章节号已存在，会跳过该章节并记录错误
   - 建议在导入前检查小说现有的章节号

3. **翻译质量**：
   - 使用 OpenAI GPT 模型进行翻译
   - 翻译质量取决于模型选择和文本复杂度
   - 建议人工审核翻译结果

4. **性能考虑**：
   - 翻译任务在后台异步执行，避免请求超时
   - 大量章节的翻译可能需要较长时间
   - 建议分批导入或使用任务队列系统

5. **错误处理**：
   - 单个章节翻译失败不会影响其他章节
   - 失败的章节会记录错误信息，便于排查

## 八、后续优化建议

1. **任务队列**：
   - 使用 Redis + Bull 或类似的任务队列系统
   - 支持任务暂停、恢复、取消等操作

2. **文件上传**：
   - 支持上传 txt、docx 等文件格式
   - 自动解析文件内容

3. **翻译配置**：
   - 支持选择不同的翻译模型
   - 支持自定义翻译提示词（prompt）

4. **批量操作**：
   - 支持批量重试失败的章节
   - 支持批量删除翻译任务

5. **章节创建逻辑完善**：
   - 自动计算解锁价格
   - 自动设置预读章节
   - 支持选择导入后的审核状态

---

**实现完成时间**：2025-12-07  
**版本**：v1.0（基础版本）

