# Volume管理功能说明

## 概述

在NovelEdit页面中新增了小说卷轴管理功能，允许用户为小说创建和管理多个卷，每个卷可以指定起始章节和结束章节。

## 功能特性

### 1. 卷信息管理
- 为每卷设置标题（如"第一卷"、"第二卷"等）
- 指定每卷的起始章节和结束章节
- 自动计算每卷的章节数量
- 支持无限添加新卷

### 2. 数据库操作
- 根据`novel_id`、`volume_number`二者的组合进行唯一性检查
- 如果组合存在则更新记录，不存在则新增记录
- 使用数据库事务确保数据一致性

### 3. 用户界面
- 直观的卷管理界面
- 动态添加/删除卷
- 章节范围选择下拉框
- 实时更新和状态反馈

## 数据库表结构

### volume表字段
```sql
CREATE TABLE `volume` (
  `id` int NOT NULL AUTO_INCREMENT,
  `novel_id` int NOT NULL,
  `volume_number` int NOT NULL,
  `title` varchar(255) DEFAULT NULL COMMENT '卷标题',
  `start_chapter` int DEFAULT NULL COMMENT '起始章节号',
  `end_chapter` int DEFAULT NULL COMMENT '结束章节号',
  `chapter_count` int DEFAULT 0 COMMENT '章节数量',
  PRIMARY KEY (`id`),
  KEY `novel_id` (`novel_id`),
  CONSTRAINT `volume_ibfk_1` FOREIGN KEY (`novel_id`) REFERENCES `novel` (`id`)
);
```

## API接口

### 1. 获取卷信息
```
GET /api/novel/:id/volumes
```
返回指定小说的所有卷信息

### 2. 更新卷信息
```
POST /api/novel/:id/volumes
Content-Type: application/json

{
  "volumes": [
    {
      "volume_number": 1,
      "title": "第一卷",
      "start_chapter": 1,
      "end_chapter": 50,
      "chapter_count": 50
    }
  ]
}
```

## 使用步骤

### 1. 搜索小说
- 在搜索框中输入小说名称
- 点击"搜索"按钮
- 系统会自动选择第一个搜索结果

### 2. 查询章节数量
- 点击"查询"按钮获取小说的总章节数
- 章节数量将用于限制卷的章节范围选择

### 3. 管理卷信息
- 系统会自动加载现有的卷信息
- 可以修改卷标题
- 选择起始章节和结束章节
- 点击"+"按钮添加新卷
- 点击"×"按钮删除卷（至少保留一个卷）

### 4. 更新卷信息
- 点击"更新小说卷轴信息"按钮
- 系统会根据唯一性规则更新或创建卷记录
- 显示操作结果消息

## 唯一性规则

系统使用以下组合作为唯一性检查：
- `novel_id`：小说ID
- `volume_number`：卷号

如果二者的组合已存在，则更新现有记录；如果不存在，则创建新记录。

## 注意事项

1. 章节范围选择基于查询到的总章节数
2. 至少需要保留一个卷
3. 删除卷时会自动重新编号
4. 所有操作都有加载状态和错误处理
5. 使用数据库事务确保数据一致性

## 技术实现

### 前端
- React + TypeScript
- 状态管理：useState
- 样式：CSS Modules
- API调用：fetch

### 后端
- Node.js + Express
- MySQL数据库
- 事务处理
- 错误处理和日志记录

## 文件结构

```
frontend/src/pages/
├── NovelEdit.tsx          # 主组件文件
└── NovelEdit.module.css   # 样式文件

backend/
├── server.js              # 服务器主文件
├── database_schema.sql    # 数据库结构
└── update_volume_table.sql # 数据库更新脚本
```
