# 定时发布功能数据库迁移总结

## 迁移日期
2025-01-XX

## 迁移内容

### 1. 为 chapter 表添加 is_released 字段

**字段信息**:
- **字段名**: `is_released`
- **类型**: `tinyint(1)`
- **默认值**: `1` (已发布)
- **说明**: 是否已发布（0=未发布，1=已发布）

**位置**: 在 `review_status` 字段之后

### 2. 创建 scheduledrelease 表

**表结构**:
```sql
CREATE TABLE `scheduledrelease` (
  `id` int NOT NULL AUTO_INCREMENT,
  `novel_id` int NOT NULL COMMENT '小说ID',
  `chapter_id` int NOT NULL COMMENT '章节ID',
  `release_time` datetime NOT NULL COMMENT '计划发布时间',
  `is_released` tinyint(1) DEFAULT '0' COMMENT '是否已发布（0=未发布，1=已发布）',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_novel_id` (`novel_id`),
  KEY `idx_chapter_id` (`chapter_id`),
  KEY `idx_release_time` (`release_time`),
  KEY `idx_is_released` (`is_released`),
  CONSTRAINT `scheduledrelease_ibfk_1` FOREIGN KEY (`novel_id`) REFERENCES `novel` (`id`) ON DELETE CASCADE,
  CONSTRAINT `scheduledrelease_ibfk_2` FOREIGN KEY (`chapter_id`) REFERENCES `chapter` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='定时发布管理表';
```

**字段说明**:
- `id`: 主键，自增
- `novel_id`: 小说ID，外键关联 `novel.id`
- `chapter_id`: 章节ID，外键关联 `chapter.id`
- `release_time`: 计划发布时间
- `is_released`: 是否已发布（0=未发布，1=已发布）
- `created_at`: 创建时间
- `updated_at`: 更新时间（自动更新）

**索引**:
- `idx_novel_id`: 用于快速查询某小说的定时发布记录
- `idx_chapter_id`: 用于快速查询某章节的定时发布记录
- `idx_release_time`: 用于快速查询需要发布的章节（按时间排序）
- `idx_is_released`: 用于快速查询已发布/未发布的记录

**外键约束**:
- 删除小说时，自动删除相关的定时发布记录
- 删除章节时，自动删除相关的定时发布记录

## 迁移结果

### 数据统计
- **总章节数**: 326
- **已发布章节数**: 312 (is_released = 1)
- **未发布章节数**: 14 (is_released = 0)

### 初始化逻辑
迁移脚本自动初始化了现有章节的 `is_released` 字段：
- `review_status = 'approved'` → `is_released = 1` (已发布)
- `review_status IN ('draft', 'submitted', 'reviewing')` → `is_released = 0` (未发布)

## 使用场景

### scheduledrelease 表用途
1. **定时发布管理**: 存储计划定时发布的章节信息
2. **发布状态跟踪**: 通过 `is_released` 字段跟踪是否已执行发布
3. **批量查询**: 可以快速查询需要发布的章节（`release_time <= NOW() AND is_released = 0`）

### chapter.is_released 字段用途
1. **发布状态标识**: 标识章节是否已发布
2. **查询过滤**: 可以快速过滤已发布/未发布的章节
3. **业务逻辑**: 配合 `review_status` 使用，更精确地控制章节状态

## 后续开发建议

### 1. 定时发布任务
建议创建一个定时任务（cron job 或 scheduled task），定期检查 `scheduledrelease` 表：
```sql
SELECT * FROM scheduledrelease 
WHERE release_time <= NOW() 
  AND is_released = 0
```

### 2. API 接口
建议创建以下 API 接口：
- `POST /api/scheduled-release/create` - 创建定时发布任务
- `GET /api/scheduled-release/novel/:novelId` - 获取某小说的定时发布列表
- `PUT /api/scheduled-release/:id` - 更新定时发布任务
- `DELETE /api/scheduled-release/:id` - 删除定时发布任务
- `POST /api/scheduled-release/execute` - 执行定时发布（由定时任务调用）

### 3. 前端功能
- 在草稿箱的"定时发布"按钮中，创建定时发布任务
- 显示定时发布列表
- 允许修改或取消定时发布

## 迁移脚本

- SQL 脚本：`backend/migrations/create_scheduledrelease_table.sql`
- 执行脚本：`backend/migrations/execute_scheduledrelease_migration.js`

执行命令：
```bash
cd backend
node migrations/execute_scheduledrelease_migration.js
```

## 注意事项

1. **数据一致性**: 确保 `chapter.is_released` 和 `scheduledrelease.is_released` 保持同步
2. **定时任务**: 需要实现定时任务来检查并执行定时发布
3. **并发控制**: 定时发布任务执行时需要考虑并发控制，避免重复发布
4. **错误处理**: 发布失败时需要记录错误信息，并更新状态

