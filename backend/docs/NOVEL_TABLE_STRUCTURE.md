# Novel 表结构说明

## 编辑相关字段

### current_editor_admin_id
- **类型**: `INT NULL`
- **位置**: 在 `user_id` 字段之后
- **说明**: 该小说当前责任编辑 admin_id（若无则为NULL）
- **外键**: `fk_novel_current_editor` → `admin(id)` ON DELETE SET NULL
- **索引**: `fk_novel_current_editor`

### chief_editor_admin_id
- **类型**: `INT NULL`
- **位置**: 在 `current_editor_admin_id` 字段之后
- **说明**: 该小说当前主编 admin_id（若无则为NULL）
- **外键**: `fk_novel_chief_editor` → `admin(id)` ON DELETE SET NULL
- **索引**: `idx_novel_chief_editor_admin_id`

## 使用说明

这两个字段用于标识小说的责任编辑和主编：
- `current_editor_admin_id`: 负责该小说的普通编辑
- `chief_editor_admin_id`: 负责该小说的主编

当管理员被删除时，相关字段会自动设置为 NULL（ON DELETE SET NULL）。

## 迁移历史

- **迁移文件**: `015_add_chief_editor_admin_id.sql`
- **执行脚本**: `execute_015_migration.js`
- **执行时间**: 2025-01-08

