# Writers-Zone 政策文档与公告功能实现总结

**实现时间**：2025-12-18  
**实现范围**：签约政策页面 + 官方动态区块真实数据拉取

---

## 文件改动清单

### 后端文件

#### 1. `backend/routes/admin.js`
- **改动位置**：第 13545 行
- **改动内容**：在 `ALLOWED_DOC_KEYS` 数组中添加 `'writer_contract_policy'`
- **改动说明**：扩展 admin 后台允许创建的文档类型，支持签约政策

#### 2. `backend/routes/admin.js`
- **改动位置**：第 13599 行
- **改动内容**：更新错误消息，包含 `writer_contract_policy`
- **改动说明**：确保错误提示与新的 doc_key 支持一致

#### 3. `backend/routes/legal.js`
- **改动位置**：第 15-24 行
- **改动内容**：在 `DOC_KEY_MAP` 中添加 `contract-policy`、`contract_policy`、`writer_contract_policy` 映射
- **改动说明**：支持前台通过 `/api/legal/contract-policy` 访问签约政策

### 前端文件

#### 4. `frontend/src/pages/AdminPanel/AdminLegalDocsManagement.tsx`
- **改动位置**：第 49-53 行
- **改动内容**：在 `DOC_KEY_OPTIONS` 数组中添加 `{ value: 'writer_contract_policy', label: 'Writer Contract Policy' }`
- **改动说明**：admin 后台下拉菜单可选择"Writer Contract Policy"类型

#### 5. `frontend/src/pages/ContractPolicyPage.tsx`
- **文件状态**：新建文件
- **文件路径**：`frontend/src/pages/ContractPolicyPage.tsx`
- **功能说明**：
  - 使用 `useLanguage` hook 获取当前语言
  - 调用 `GET /api/legal/contract-policy?lang=${lang}` 获取政策内容
  - 使用 `ReactMarkdown` 渲染 Markdown 内容
  - 复用 `LegalDocumentPage.module.css` 样式

#### 6. `frontend/src/App.tsx`
- **改动位置**：第 33 行（导入）、第 77 行（路由）
- **改动内容**：
  - 导入 `ContractPolicyPage` 组件
  - 添加路由 `<Route path="/contract-policy" element={<ContractPolicyPage />} />`
- **改动说明**：注册 `/contract-policy` 路由，使 writers-zone 顶部按钮可跳转

#### 7. `frontend/src/pages/WritersZone.tsx`
- **改动位置**：第 2 行（导入）、第 186-187 行（状态）、第 237-251 行（加载函数）、第 266 行（调用）、第 912-935 行（渲染）
- **改动内容**：
  - 导入 `Link` 组件
  - 添加 `announcements` 和 `announcementsLoading` 状态
  - 新增 `loadAnnouncements()` 函数，调用 `GET /api/news`
  - 在 `useEffect` 中调用 `loadAnnouncements()`
  - 将硬编码的公告列表改为从接口拉取，限制显示前 5 条
  - 日期格式化为 MM-DD
  - "更多>"链接改为 `<Link to="/announcements">`
  - 点击公告项支持跳转到详情页或外部链接
- **改动说明**：官方动态区块从真实接口拉取数据，支持跳转和"更多"功能

### 数据库迁移文件

#### 8. `backend/migrations/20251218_init_writer_contract_policy.sql`
- **文件状态**：新建文件
- **功能说明**：
  - 插入签约政策示例数据（英文版，published，is_current=1）
  - 插入 3 条公告示例数据用于测试

---

## API 接口验证

### 1. 签约政策接口
```bash
curl http://localhost:5000/api/legal/contract-policy?lang=en
```

**预期返回**：
```json
{
  "success": true,
  "data": {
    "title": "KongFuWorld Writer Contract Policy",
    "content_md": "# KongFuWorld Writer Contract Policy\n\n...",
    "version": "1.0.0",
    "effective_at": "2025-12-18T...",
    "updated_at": "2025-12-18T..."
  }
}
```

### 2. 公告列表接口
```bash
curl http://localhost:5000/api/news
```

**预期返回**：
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "title": "Writer Program Update",
        "content": "...",
        "content_format": "markdown",
        "created_at": "2025-12-18T...",
        "updated_at": "2025-12-18T...",
        "link_url": null,
        "display_order": 0
      },
      ...
    ]
  }
}
```

---

## 验收清单

### A) writers-zone 功能验收

#### ✅ A1. 官方动态真实数据
- **验证步骤**：
  1. 登录 writers-zone（`/writers-zone`）
  2. 查看首页"官方动态"区块
- **预期结果**：
  - 显示从 `/api/news` 接口拉取的真实数据（非硬编码）
  - 最多显示 5 条公告
  - 日期格式为 MM-DD（如 "12-18"）
  - 标题显示公告的 `title` 字段

#### ✅ A2. 官方动态"更多>"跳转
- **验证步骤**：
  1. 在 writers-zone 首页点击"官方动态"区块的"更多>"
- **预期结果**：
  - 跳转到 `/announcements` 页面（AnnouncementsPage）

#### ✅ A3. 官方动态点击跳转
- **验证步骤**：
  1. 点击任意一条公告项
- **预期结果**：
  - 如果公告有 `link_url`：跳转到该链接（站内用 navigate，站外用 window.open）
  - 如果公告无 `link_url`：跳转到 `/news/{id}` 详情页

#### ✅ A4. 签约政策按钮可用
- **验证步骤**：
  1. 在 writers-zone 页面顶部点击"签约政策"按钮
- **预期结果**：
  - 跳转到 `/contract-policy` 页面
  - 页面正常显示，无 404 错误

#### ✅ A5. 签约政策页面渲染
- **验证步骤**：
  1. 访问 `/contract-policy` 页面
- **预期结果**：
  - 页面从 `/api/legal/contract-policy?lang=en`（或当前语言）获取数据
  - 显示政策标题、版本、生效时间、更新时间
  - Markdown 内容正确渲染（支持链接、代码块等）
  - 页面样式与 `LegalDocumentPage` 一致

### B) admin 后台功能验收

#### ✅ B1. 文档类型下拉支持
- **验证步骤**：
  1. 登录 admin 后台
  2. 进入"站点政策管理"页面
  3. 点击"新建版本"按钮
- **预期结果**：
  - "文档类型"下拉菜单包含"Writer Contract Policy"选项

#### ✅ B2. 创建 writer_contract_policy
- **验证步骤**：
  1. 选择"Writer Contract Policy"类型
  2. 填写 title、version、content_md 等信息
  3. 点击保存
- **预期结果**：
  - 创建成功，状态为 draft
  - 列表中显示新创建的记录

#### ✅ B3. 发布并设为当前
- **验证步骤**：
  1. 编辑刚创建的 writer_contract_policy 记录
  2. 将 status 改为 "published"
  3. 保存后点击"设为当前"按钮
- **预期结果**：
  - 状态变为 published
  - is_current 变为 1
  - 同 doc_key+language 的其他记录的 is_current 自动置 0（事务保证）
  - 前台 `/contract-policy` 页面可读取到该内容

---

## 数据库初始化 SQL

### 1. 插入签约政策（英文版）

**注意**：如果同 `doc_key+language` 已有 `is_current=1` 的记录，请先执行：
```sql
UPDATE site_legal_documents 
SET is_current = 0 
WHERE doc_key = 'writer_contract_policy' AND language = 'en';
```

然后执行插入：
```sql
INSERT INTO site_legal_documents
(doc_key, language, title, version, content_md, status, is_current, effective_at, created_by, updated_by)
VALUES
('writer_contract_policy','en','KongFuWorld Writer Contract Policy','1.0.0','# KongFuWorld Writer Contract Policy

## 1. Introduction

Welcome to KongFuWorld Writer Program. This policy outlines the terms and conditions for writers participating in our platform.

## 2. Contract Terms

### 2.1 Eligibility
- Writers must be at least 18 years old
- Writers must have a verified email address
- Writers must agree to our Terms of Service

### 2.2 Content Requirements
- All content must be original
- Content must comply with platform guidelines
- Writers retain copyright ownership

## 3. Revenue Sharing

### 3.1 Royalty Structure
- Base royalty rate: 50% of net revenue
- Additional bonuses for popular works
- Monthly payout schedule

### 3.2 Payment Terms
- Minimum payout threshold: $50 USD
- Payments processed monthly
- Payment methods: Bank transfer, PayPal

## 4. Responsibilities

Writers are responsible for:
- Maintaining content quality
- Regular updates as per schedule
- Engaging with readers

## 5. Termination

Either party may terminate the contract with 30 days notice.

## 6. Contact

For questions, contact: writers@kongfuworld.com

---

*Last Updated: December 18, 2025*','published',1,NOW(),1,1);
```

### 2. 插入公告示例（用于测试）

```sql
INSERT INTO homepage_announcements
(title, content, content_format, link_url, display_order, is_active, start_date, end_date)
VALUES
('Writer Program Update','# Writer Program Update\n\nWe are excited to announce new features for our writer program:\n\n- Enhanced royalty calculation system\n- New writer dashboard\n- Improved payment processing\n\nThank you for being part of KongFuWorld!','markdown',NULL,0,1,NULL,NULL),
('Copyright Operations Update','# Copyright Operations Update\n\nImportant updates regarding copyright protection:\n\n- New DMCA process\n- Enhanced content monitoring\n- Updated reporting system\n\nPlease review the changes in your writer dashboard.','markdown',NULL,1,1,NULL,NULL),
('Writer Achievement System Launched','# Writer Achievement System Launched\n\nWe are launching a new achievement system to recognize outstanding writers:\n\n- Monthly top writer awards\n- Milestone badges\n- Special recognition program\n\nCheck your achievements in the writer center!','markdown',NULL,2,1,NULL,NULL);
```

**完整 SQL 文件**：`backend/migrations/20251218_init_writer_contract_policy.sql`

---

## 技术实现要点

### 1. doc_key 扩展策略
- **最小增量**：仅添加 `writer_contract_policy`，不影响现有 `terms_of_service`、`privacy_policy`、`cookie_policy`
- **三处同步**：后端白名单、前端下拉选项、公开接口映射
- **向后兼容**：现有接口和功能不受影响

### 2. 语言处理
- **ContractPolicyPage**：使用 `useLanguage` hook 获取当前语言，动态传入接口
- **WritersZone 官方动态**：使用当前语言环境，但接口返回数据不受语言限制（公告表无 language 字段）

### 3. 数据拉取策略
- **官方动态**：前端限制显示 5 条（不修改后端接口）
- **日期格式化**：前端处理，将 `created_at` 格式化为 MM-DD
- **跳转逻辑**：优先使用 `link_url`，否则跳转详情页

### 4. 样式复用
- **ContractPolicyPage**：复用 `LegalDocumentPage.module.css`，保持 UI 一致性
- **Markdown 渲染**：复用 `ReactMarkdown` + `remarkGfm`，支持链接、代码块等

---

## 注意事项

1. **数据库初始化**：执行 SQL 前需确认同 `doc_key+language` 无 `is_current=1` 的记录，或先置 0
2. **admin 后台**：创建 `writer_contract_policy` 后需发布（status='published'）并设为当前（set-current）才能在前台显示
3. **语言切换**：ContractPolicyPage 会根据当前语言自动切换，但需确保数据库中有对应语言的记录
4. **公告数量**：官方动态仅显示前 5 条，如需更多请点击"更多>"查看完整列表

---

**实现完成时间**：2025-12-18  
**所有功能已实现并通过 lint 检查**

