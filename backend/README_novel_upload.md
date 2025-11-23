# 小说上传功能使用说明

## 功能概述

本系统提供了完整的小说上传功能，支持：
- Word文档(.docx)自动解析
- 章节自动分割
- **章节范围设置**：支持指定章节范围或所有章节的设置
- 灵活的章节配置（免费/付费、VIP专享、抢先版、可见性等）
- 实时上传进度显示
- 本地文件处理流程

## 文件处理流程

### 开发环境流程
1. **文件上传**：用户选择Word文档上传到前端
2. **服务器接收**：文件保存到 `novel/` 目录
3. **章节解析**：服务器解析Word文档并分割章节
4. **前端预览**：返回章节数据供用户配置
5. **数据库上传**：用户确认后上传到数据库
6. **文件清理**：上传完成后删除临时文件

### 生产环境流程
1. **文件上传**：用户上传文件到服务器
2. **临时存储**：文件保存到临时目录
3. **处理上传**：解析并上传到数据库
4. **自动清理**：处理完成后删除临时文件

## 章节范围设置功能

### 支持的设置类型
- **is_locked**：锁定章节（需要付费解锁）
- **is_vip_only**：VIP专享章节
- **is_advance**：抢先版章节
- **is_visible**：章节可见性

### 设置方式
1. **所有章节**：应用到所有章节
2. **指定范围**：从第X章到第Y章

### 使用示例
```
锁定章节：从第16章到第50章
VIP专享：从第30章到第60章
抢先版：从第40章到第45章
可见：所有章节
```

## 数据库表结构

### 章节表 (chapter)
```sql
CREATE TABLE chapter (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  novel_id        INT NOT NULL,                       -- 关联小说ID
  volume_id       INT NOT NULL,                       -- 关联卷ID
  chapter_number  INT NOT NULL,                       -- 章节编号
  title           VARCHAR(255) NOT NULL,              -- 章节标题
  content         LONGTEXT NOT NULL,                  -- 章节内容
  word_count      INT DEFAULT 0,                      -- 字数统计
  is_locked       TINYINT(1) DEFAULT 0,               -- 是否锁定（需要付费解锁）
  is_vip_only     TINYINT(1) DEFAULT 0,               -- 是否VIP专享
  is_advance      TINYINT(1) DEFAULT 0,               -- 是否抢先版
  is_visible      TINYINT(1) DEFAULT 1,               -- 是否可见
  unlock_cost     INT DEFAULT 0,                      -- 解锁所需金币
  translator_note TEXT,                               -- 译者备注
  prev_chapter_id INT,                                -- 上一章节ID
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## 使用步骤

### 1. 访问上传页面
- 登录后，在导航栏用户菜单中点击"上传小说"
- 或直接访问 `/upload` 路径

### 2. 填写小说基本信息
- **小说标题**：必填，小说的完整标题
- **作者**：必填，作者姓名
- **卷标题**：可选，默认为"第一卷"
- **免费章节数**：设置前几章为免费章节
- **最小/最大解锁金币**：设置付费章节的金币范围
- **小说描述**：可选，小说的简介

### 3. 上传文档
- 点击上传区域选择Word文档(.docx格式)
- 系统会自动解析文档并分割章节
- 支持拖拽上传
- **上传进度条**：显示文件上传和处理进度

### 4. 配置章节设置

#### 章节范围设置
每个设置项都支持：
- **启用/禁用**：勾选复选框启用该设置
- **应用范围**：
  - 所有章节：应用到所有章节
  - 指定范围：从第X章到第Y章

#### 设置项说明
- **锁定章节**：设置章节是否需要付费解锁
- **VIP专享**：设置章节是否仅VIP用户可读
- **抢先版**：设置章节是否为抢先版
- **可见**：设置章节是否在列表中显示

#### 单个章节设置
- 每个章节都可以单独配置上述选项
- 可以预览章节内容（前200字符）
- 显示章节字数统计

### 5. 提交上传
- 确认所有设置无误后，点击"提交上传"
- 系统会创建小说记录、卷记录和所有章节
- 上传成功后显示统计信息

## API接口

### 1. 解析章节
```
POST /api/novel/parse-chapters
Content-Type: multipart/form-data

参数：
- file: Word文档文件
- config: 小说配置JSON字符串

返回：
{
  "success": true,
  "chapters": [...],
  "totalChapters": 120,
  "filePath": "/path/to/file.docx"
}
```

### 2. 上传小说
```
POST /api/novel/upload
Content-Type: multipart/form-data

参数：
- file: Word文档文件
- config: 小说配置JSON字符串
- chapters: 章节数据JSON字符串

返回：
{
  "success": true,
  "novelId": 1,
  "volumeId": 1,
  "totalChapters": 120
}
```

## 章节分割规则

系统使用正则表达式自动识别章节标题：
- 匹配格式：`第[一二三四五六七八九十百千万\d]+[章节回]`
- 例如：第一章、第二回、第3节等

## 自动填写字段

以下字段支持自动填写：
- **word_count**：根据章节内容自动计算字数
- **is_locked**：根据免费章节数自动设置
- **unlock_cost**：根据配置的金币范围自动生成
- **prev_chapter_id**：自动设置上一章节ID
- **created_at/updated_at**：自动设置时间戳

## 上传进度显示

### 文件上传阶段
- 显示"正在上传文件..."
- 进度条从0%到90%

### 文件解析阶段
- 显示"文件解析完成"
- 进度条到100%

### 数据库上传阶段
- 显示"正在上传到数据库..."
- 进度条从0%到100%

## 注意事项

1. **文件格式**：仅支持.docx格式的Word文档
2. **文件大小**：单个文件不超过50MB
3. **章节识别**：确保文档中的章节标题格式正确
4. **数据库**：确保数据库表结构已正确创建
5. **权限**：上传功能需要用户登录
6. **文件存储**：开发环境下文件保存在 `novel/` 目录

## 错误处理

常见错误及解决方案：
- **文件格式错误**：确保上传的是.docx文件
- **文件过大**：检查文件大小是否超过50MB
- **章节识别失败**：检查文档中的章节标题格式
- **数据库连接失败**：检查数据库配置和连接
- **上传失败**：检查文件大小和网络连接

## 开发说明

### 前端组件
- `NovelUpload.tsx`：主上传页面组件
- `NovelUpload.module.css`：样式文件

### 后端模块
- `upload_novel.js`：核心上传逻辑
- `server.js`：API路由配置

### 依赖包
- `mammoth`：Word文档解析
- `multer`：文件上传处理
- `mysql2`：数据库操作

### 文件处理
- 开发环境：文件保存到 `novel/` 目录
- 生产环境：文件保存到临时目录，处理完成后删除
- 支持大文件上传（最大50MB）
- 自动文件清理机制 