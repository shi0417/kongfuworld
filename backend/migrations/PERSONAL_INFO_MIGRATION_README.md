# 个人信息功能数据库迁移说明

## 概述

此迁移脚本用于创建个人信息管理功能所需的数据库表和字段，包括：
- 用户基础信息字段（QQ、微信、紧急联系方式等）
- 收货地址表
- 实名认证表
- 银行卡绑定表
- 银行卡变更记录表

## 执行步骤

### 1. 执行数据库迁移

在 `backend/migrations` 目录下运行：

```bash
node execute_personal_info_migration.js
```

或者直接执行SQL文件：

```bash
mysql -u root -p kongfuworld < create_personal_info_tables.sql
```

### 2. 验证迁移结果

检查以下表和字段是否创建成功：

**user表新增字段：**
- `qq_number` - QQ号码
- `wechat_number` - 微信号码
- `emergency_contact_relationship` - 紧急联系人关系
- `emergency_contact_phone` - 紧急联系人电话
- `is_real_name_verified` - 是否已实名认证
- `phone_number` - 手机号码

**新建表：**
- `user_addresses` - 收货地址表
- `user_identity_verifications` - 实名认证表
- `user_bank_card_bindings` - 银行卡绑定表
- `user_bank_card_change_logs` - 银行卡变更记录表

### 3. 注意事项

- 如果字段或表已存在，迁移脚本会跳过相关错误
- 身份证号和银行卡号会使用AES-256加密存储
- 确保数据库用户有足够的权限执行ALTER TABLE和CREATE TABLE操作

## API端点

迁移完成后，以下API端点将可用：

### 基础信息
- `GET /api/personal-info/:userId` - 获取完整个人信息
- `PUT /api/personal-info/:userId/basic` - 更新基础信息

### 收货地址
- `GET /api/personal-info/:userId/addresses` - 获取地址列表
- `POST /api/personal-info/:userId/addresses` - 添加地址
- `PUT /api/personal-info/:userId/addresses/:addressId` - 更新地址
- `DELETE /api/personal-info/:userId/addresses/:addressId` - 删除地址

### 实名认证
- `GET /api/personal-info/:userId/identity` - 获取认证信息
- `POST /api/personal-info/:userId/identity` - 提交认证

### 银行卡绑定
- `GET /api/personal-info/:userId/bank-cards` - 获取银行卡列表
- `POST /api/personal-info/:userId/bank-cards` - 绑定银行卡
- `PUT /api/personal-info/:userId/bank-cards/:bindingId` - 更换银行卡
- `DELETE /api/personal-info/:userId/bank-cards/:bindingId` - 解绑银行卡
- `GET /api/personal-info/:userId/bank-cards/change-logs` - 获取变更记录

### 账号安全
- `PUT /api/personal-info/:userId/phone` - 更新手机号

## 前端使用

个人信息功能已集成到 `http://localhost:3000/writers-zone` 页面中，点击左侧导航栏的"个人信息"即可访问。

## 安全说明

1. **加密存储**：身份证号和银行卡号使用AES-256加密存储
2. **脱敏显示**：前端显示时自动脱敏处理（如：330****2916）
3. **权限控制**：所有API端点应添加JWT认证中间件（待实现）

## 后续优化建议

1. 添加JWT认证中间件到所有个人信息API
2. 实现银行卡变更记录的前端展示
3. 添加数据验证和错误处理
4. 实现密码修改功能
5. 添加操作日志记录

