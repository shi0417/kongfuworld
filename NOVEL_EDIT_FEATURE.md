# 小说修改功能说明

## 功能概述

小说修改功能允许管理员或编辑人员搜索并修改数据库中已存在小说的信息。该功能提供了直观的用户界面，支持对小说的多个字段进行编辑和更新。

## 功能特性

### 1. 小说搜索
- 根据小说名称进行模糊搜索
- 实时显示搜索结果
- 支持键盘回车键快速搜索

### 2. 可编辑字段
- **小说ID** (id) - 只读字段
- **小说标题** (title)
- **小说状态** (status)
- **小说封面** (cover) - 支持图片文件上传
- **小说评分** (rating)
- **小说评论数** (reviews)
- **作者** (author)
- **译者** (translator)
- **版权来源** (licensed_from)
- **小说简介** (description)

### 3. 只读字段
- **章节数量** (chapters) - 自动从数据库统计，不可手动修改

### 4. 封面图片上传
- 支持 JPG、PNG、GIF 格式图片上传
- 文件大小限制：5MB
- 图片存储在服务器 `/avatars` 目录
- 支持预览和更换封面功能
- 修复了图片显示问题，确保正确显示
- 图片显示区域尺寸：4cm*6cm (高度)

### 5. 章节数量管理
- 选择小说后自动从数据库的 `chapter` 表中统计该小说的实际章节数量
- 提供手动查询按钮，可随时更新章节数量
- 章节数量字段为只读，不可手动修改

### 4. 实时反馈
- 操作状态提示（搜索中、更新中等）
- 成功/错误消息显示
- 表单验证和错误处理

## 技术实现

### 后端API

#### 1. 搜索小说
```
POST /api/novel/search-by-title
Content-Type: application/json

{
  "title": "小说名称"
}
```

#### 2. 获取章节数量
```
GET /api/novel/:id/chapter-count
```

#### 3. 更新小说信息
```
PUT /api/novel/:id/update
Content-Type: application/json

{
  "title": "新标题",
  "author": "作者",
  "translator": "译者",
  "description": "简介",
  "chapters": 100,
  "licensed_from": "版权来源"
}
```

#### 4. 上传封面图片
```
POST /api/novel/:id/cover
Content-Type: multipart/form-data

Form Data:
- cover: 图片文件
```

### 前端组件

- **NovelEdit.tsx**: 主要组件，包含搜索和编辑功能
- **NovelEdit.module.css**: 样式文件，提供现代化的UI设计
- 响应式设计，支持移动端访问

## 使用方法

### 1. 访问页面
- 登录后点击导航栏用户头像
- 在下拉菜单中选择"修改小说"
- 或直接访问 `/edit` 路径

### 2. 搜索小说
- 在搜索框中输入小说名称（支持部分匹配）
- 点击"搜索"按钮或按回车键
- 查看搜索结果列表

### 3. 选择小说
- 点击搜索结果中的小说卡片
- 选中的小说会高亮显示
- 小说信息会自动加载到编辑表单中

### 4. 编辑信息
- 修改需要更新的字段
- 章节数量可通过查询按钮手动更新
- 支持封面图片上传和预览
- 所有文本字段都支持实时编辑
- 左侧表单布局，右侧图片显示区域
- 整体布局居中排布，图片尺寸适中
- 简洁的界面设计，提升用户体验

### 5. 保存修改
- 点击"保存修改"按钮
- 系统会显示更新状态和结果
- 成功更新后会有确认提示

## 数据库表结构

### novel 表
```sql
CREATE TABLE `novel` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `author` varchar(100) DEFAULT NULL,
  `translator` varchar(100) DEFAULT NULL,
  `description` text,
  `chapters` int DEFAULT '0',
  `licensed_from` varchar(100) DEFAULT NULL,
  -- 其他字段...
  PRIMARY KEY (`id`)
);
```

### chapter 表
```sql
CREATE TABLE `chapter` (
  `id` int NOT NULL AUTO_INCREMENT,
  `novel_id` int NOT NULL,
  -- 其他字段...
  `is_visible` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  FOREIGN KEY (`novel_id`) REFERENCES `novel` (`id`)
);
```

## 安全考虑

- 所有API请求都经过验证
- 输入数据经过清理和验证
- 错误信息不会暴露敏感的系统信息
- 支持事务处理确保数据一致性

## 扩展功能

该功能可以进一步扩展：

1. **权限控制**: 添加用户角色验证，只允许管理员或编辑人员访问
2. **操作日志**: 记录所有修改操作的历史
3. **批量操作**: 支持批量修改多个小说
4. **版本控制**: 保存修改历史，支持回滚操作
5. **审核流程**: 添加修改审核机制

## 文件结构

```
frontend/src/
├── pages/
│   ├── NovelEdit.tsx          # 小说修改页面组件
│   └── NovelEdit.module.css   # 样式文件
├── components/NavBar/
│   └── NavBar.tsx             # 导航栏（添加了修改小说链接）
└── config.ts                  # API配置

backend/
└── server.js                  # 后端API实现
```

## 注意事项

1. 确保MySQL服务正常运行
2. 检查数据库连接配置
3. 确保前端和后端服务都已启动
4. 建议在修改重要数据前先备份数据库
