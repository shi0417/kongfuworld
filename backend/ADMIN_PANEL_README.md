# 后台管理系统使用说明

## 概述

这是一个独立的后台管理系统，用于审批网站的申请项（小说）。该系统有独立的登录入口，不在主网站显示入口。

## 数据库设置

### 1. 创建 admin 表

运行以下 SQL 脚本创建 admin 表并初始化数据：

```sql
-- 创建 admin 表
CREATE TABLE IF NOT EXISTS `admin` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '管理员用户名',
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '密码（明文存储，实际应该使用哈希）',
  `level` int DEFAULT 1 COMMENT '管理员级别（1=普通管理员，2=超级管理员）',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入初始管理员数据
INSERT INTO `admin` (`id`, `name`, `password`, `level`) VALUES
(1, 'adminshi', '123456', 1)
ON DUPLICATE KEY UPDATE `name`=`name`;
```

或者直接运行：
```bash
mysql -u root -p kongfuworld < backend/create_admin_table.sql
```

## 访问地址

后台管理系统的访问地址为：
```
http://localhost:3000/admin
```

## 登录信息

- **用户名**: `adminshi`
- **密码**: `123456`

## 功能说明

### 1. 登录功能
- 访问 `/admin` 路径会自动显示登录界面
- 输入管理员用户名和密码进行登录
- 登录成功后，token 会保存在 localStorage 中

### 2. 审批功能
- **查看待审批小说**: 显示所有状态为 `submitted` 或 `reviewing` 的小说
- **筛选功能**: 可以按状态筛选小说（全部待审批、已提交、审核中、已批准、已拒绝）
- **查看详情**: 点击"查看详情"按钮可以查看小说的详细信息
- **批准/拒绝**: 对于待审批的小说，可以点击"批准"或"拒绝"按钮进行审批

### 3. 小说状态
- **submitted**: 已提交（待审核）
- **reviewing**: 审核中
- **approved**: 已批准
- **rejected**: 已拒绝

## API 接口

### 管理员登录
```
POST /api/admin/login
Body: { name: string, password: string }
```

### 获取待审批小说列表
```
GET /api/admin/pending-novels
Headers: { Authorization: Bearer <token> }
```

### 获取小说列表（带筛选）
```
GET /api/admin/novels?status=<status>&page=<page>&limit=<limit>
Headers: { Authorization: Bearer <token> }
```

### 审批小说
```
POST /api/admin/review-novel
Headers: { Authorization: Bearer <token> }
Body: { novelId: number, action: 'approve' | 'reject' }
```

### 获取小说详情
```
GET /api/admin/novel/:id
Headers: { Authorization: Bearer <token> }
```

## 安全说明

1. **密码存储**: 当前版本使用明文存储密码，生产环境应该使用 bcrypt 等哈希算法
2. **Token 安全**: 管理员 token 使用独立的密钥 `admin-secret-key`，与普通用户 token 分离
3. **访问控制**: 所有管理接口都需要管理员 token 验证
4. **独立入口**: 后台管理系统不在主网站显示入口，只能通过直接访问 `/admin` 路径进入

## 文件结构

```
backend/
├── routes/
│   └── admin.js              # 后台管理路由
├── create_admin_table.sql    # 创建 admin 表的 SQL 脚本
└── ADMIN_PANEL_README.md     # 本说明文档

frontend/src/pages/
├── AdminPanel.tsx            # 后台管理页面组件
└── AdminPanel.module.css    # 后台管理页面样式
```

## 注意事项

1. 确保数据库连接配置正确（在 `backend/routes/admin.js` 中）
2. 确保后端服务运行在 `http://localhost:5000`
3. 确保前端服务运行在 `http://localhost:3000`
4. 首次使用前需要运行 SQL 脚本创建 admin 表
5. 建议在生产环境中修改默认密码和 token 密钥

