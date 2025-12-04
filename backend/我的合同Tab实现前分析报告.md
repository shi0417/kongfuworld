# 后台"我的收款账户 + 编辑结算管理"页面结构分析报告

> **目的**：为在"我的收款账户"页面新增「我的合同」Tab做准备，全面梳理现有代码结构和数据库设计。

---

## 一、前端：后台"我的收款账户 + 编辑结算管理"页面结构

### 1.1 主页面组件定位

**主组件文件**：
- **路径**：`frontend/src/pages/AdminPanel/AdminPayoutAccounts.tsx`
- **组件名**：`AdminPayoutAccounts`
- **当前行数**：约 731 行（**注意：接近2500行限制，但仍在安全范围内**）

**Tab状态管理**：
```typescript
const [editorTab, setEditorTab] = useState<'account' | 'editorIncome' | 'editorSettlement'>('account');
```

**当前Tab导航结构**（第254-273行）：
```tsx
<div className={styles.tabs}>
  <button
    className={`${styles.tab} ${editorTab === 'account' ? styles.active : ''}`}
    onClick={() => setEditorTab('account')}
  >
    收款账户
  </button>
  <button
    className={`${styles.tab} ${editorTab === 'editorIncome' ? styles.active : ''}`}
    onClick={() => setEditorTab('editorIncome')}
  >
    编辑收入
  </button>
  <button
    className={`${styles.tab} ${editorTab === 'editorSettlement' ? styles.active : ''}`}
    onClick={() => setEditorTab('editorSettlement')}
  >
    编辑结算管理
  </button>
</div>
```

**Tab内容条件渲染**（第276-730行）：
- `editorTab === 'account'`：显示收款账户列表和新增/编辑Modal
- `editorTab === 'editorIncome'`：渲染 `<AdminEditorIncomeTab />`
- `editorTab === 'editorSettlement'`：渲染 `<AdminEditorSettlementTab />`

---

### 1.2 子组件结构

#### 1.2.1 编辑收入Tab组件

**文件路径**：`frontend/src/pages/AdminPanel/AdminEditorIncomeTab.tsx`
- **组件名**：`AdminEditorIncomeTab`
- **当前行数**：约 358 行（**安全范围内**）

**主要功能模块**：
- **筛选区域**：月份选择器、作品下拉、角色下拉
- **统计卡片**：本月编辑总收入、主编收入、责任编辑收入、参与作品数
- **"按作品汇总"表格**：作品 | 角色 | 本月编辑收入(USD) | 本月状态
- **"收入明细"表格**：时间 | 作品 | 角色 | 收入来源 | 收入金额(USD)，带分页

**使用的API**：
- `GET /api/admin/editor-income/novels`：获取编辑参与的作品列表
- `GET /api/admin/editor-income/summary`：获取收入汇总
- `GET /api/admin/editor-income/by-novel`：按作品汇总
- `GET /api/admin/editor-income/details`：收入明细（分页）

---

#### 1.2.2 编辑结算管理Tab组件

**文件路径**：`frontend/src/pages/AdminPanel/AdminEditorSettlementTab.tsx`
- **组件名**：`AdminEditorSettlementTab`
- **当前行数**：约 418 行（**安全范围内**）

**内部二级Tab结构**：
```typescript
const [subTab, setSubTab] = useState<'monthly' | 'payout'>('monthly');
```

**二级Tab导航**（使用 `.subTabs` / `.subTab` 样式）：
```tsx
<div className={styles.subTabs}>
  <button
    className={`${styles.subTab} ${subTab === 'monthly' ? styles.active : ''}`}
    onClick={() => setSubTab('monthly')}
  >
    月度结算
  </button>
  <button
    className={`${styles.subTab} ${subTab === 'payout' ? styles.active : ''}`}
    onClick={() => setSubTab('payout')}
  >
    支付记录
  </button>
</div>
```

**"月度结算"子Tab内容**：
- **顶部统计卡片**：累计编辑收入、累计已支付、累计未支付
- **表格字段**：月份 | 参与作品数 | 收入记录条数 | 总收入(USD) | 已支付 | 未支付(USD) | 状态
- **数据来源**：`GET /api/admin/editor-settlement/monthly`

**"支付记录"子Tab内容**：
- **表格字段**：月份 | 当月收入(USD) | 支付币种 | 支付金额 | 支付方式 | 支付时间 | 收款账号 | 交易单号 | 状态 | 操作
- **数据来源**：`GET /api/admin/editor-payout/list`（分页）
- **详情弹窗**：点击"查看详情"按钮打开 `<AdminEditorPayoutDetailModal />`

**详情弹窗组件**：
- **文件路径**：`frontend/src/pages/AdminPanel/AdminEditorPayoutDetailModal.tsx`
- **组件名**：`AdminEditorPayoutDetailModal`
- **数据来源**：`GET /api/admin/editor-payout/detail/:payoutId`

---

### 1.3 样式文件

**样式文件路径**：`frontend/src/pages/AdminPanel/AdminEditorIncome.module.css`

**可复用的样式类**：

| 样式类名 | 用途 | 说明 |
|---------|------|------|
| `.tabs` / `.tab` / `.tab.active` | 顶部一级Tab导航 | 用于"收款账户 / 编辑收入 / 编辑结算管理 / 我的合同" |
| `.subTabs` / `.subTab` / `.subTab.active` | 二级Tab导航 | 用于"月度结算 / 支付记录"（如果"我的合同"需要子Tab） |
| `.summaryCards` / `.summaryCard` | 顶部统计卡片容器 | 可显示合同总数、活跃合同数、已结束合同数等 |
| `.cardTitle` / `.cardValue` | 统计卡片标题和数值 | 用于显示统计数字 |
| `.section` | 白色卡片区块 | 包裹表格、筛选区域等 |
| `.filters` / `.filterItem` | 筛选区域 | 用于按小说、角色、状态筛选合同 |
| `.table` / `.table th` / `.table td` | 表格样式 | 用于合同列表表格 |
| `.status` / `.status.completed` / `.status.pending` / `.status.error` | 状态标签 | 用于显示合同状态（active/ended/cancelled） |
| `.loading` | 加载中提示 | 数据加载时显示 |
| `.emptyCell` | 空数据提示 | 无数据时显示 |

---

## 二、数据库与后端：novel_editor_contract 相关

### 2.1 novel_editor_contract 表结构

**表结构定义位置**：
- `backend/migrations/007_add_novel_editor_system.sql`（第11-30行）
- `backend/migrations/007_create_tables_only.sql`（第2-21行）

**完整表结构**：

| 字段名 | 类型 | 是否可空 | 说明 |
|--------|------|---------|------|
| `id` | INT AUTO_INCREMENT | NOT NULL | 主键，合同ID |
| `novel_id` | INT | NOT NULL | 小说ID（外键关联 `novel.id`） |
| `editor_admin_id` | INT | NOT NULL | 编辑管理员ID（外键关联 `admin.id`） |
| `role` | ENUM('chief_editor', 'editor', 'proofreader') | NOT NULL | 编辑角色：主编/编辑/校对 |
| `share_type` | ENUM('percent_of_book', 'percent_of_author') | NOT NULL | 分成类型：按作品总收入/按作者收入 |
| `share_percent` | DECIMAL(8,4) | NULL | 分成比例（例：0.0300 = 3%） |
| `start_chapter_id` | INT | NULL | 起始章节ID（可选） |
| `end_chapter_id` | INT | NULL | 结束章节ID（可选） |
| `start_date` | DATETIME | NOT NULL | 合同开始时间 |
| `end_date` | DATETIME | NULL | 合同结束时间（NULL表示无结束时间） |
| `status` | ENUM('active', 'ended', 'cancelled') | NOT NULL | 合同状态：活跃/已结束/已取消 |
| `created_at` | DATETIME | NOT NULL | 创建时间（默认 CURRENT_TIMESTAMP） |
| `updated_at` | DATETIME | NOT NULL | 更新时间（默认 CURRENT_TIMESTAMP ON UPDATE） |

**索引**：
- `PRIMARY KEY (id)`
- `KEY idx_novel_id (novel_id)`
- `KEY idx_editor_admin_id (editor_admin_id)`
- `KEY idx_status (status)`

**外键约束**：
- `CONSTRAINT fk_editor_contract_novel FOREIGN KEY (novel_id) REFERENCES novel(id) ON DELETE CASCADE`
- `CONSTRAINT fk_editor_contract_admin FOREIGN KEY (editor_admin_id) REFERENCES admin(id) ON DELETE CASCADE`

**关键字段说明**：
- **与小说的关联**：`novel_id` → `novel.id`
- **与管理员的关联**：`editor_admin_id` → `admin.id`（当前登录编辑的ID）
- **状态字段**：`status`（'active'=生效中，'ended'=已结束，'cancelled'=已取消）
- **角色字段**：`role`（'chief_editor'=主编，'editor'=编辑，'proofreader'=校对）
- **结算比例**：`share_percent`（DECIMAL(8,4)，例如 0.0300 = 3%）
- **起止时间**：`start_date`（必填）、`end_date`（可选，NULL表示无结束时间）

---

### 2.2 与 novel_editor_contract 相关的后端接口

#### 2.2.1 超级管理员合同管理接口（仅 super_admin 可访问）

**文件路径**：`backend/routes/admin.js`（第11073-11221行）

| 路由URL | HTTP方法 | 权限要求 | 主要用途 | 返回字段 |
|---------|---------|---------|---------|---------|
| `/api/admin/editor-contracts` | GET | `super_admin` | 获取合同列表（分页+筛选+排序） | `{ success, data: { list, total, page, pageSize } }` |
| `/api/admin/editor-contracts/check-active` | GET | `super_admin` | 检查是否存在活跃合同 | `{ success, data: { hasActive, contractId } }` |
| `/api/admin/editor-contracts/:id` | GET | `super_admin` | 获取单个合同详情 | `{ success, data: contract }` |
| `/api/admin/editor-contracts` | POST | `super_admin` | 创建新合同 | `{ success, message, data: contract }` |
| `/api/admin/editor-contracts/:id` | PUT | `super_admin` | 更新合同 | `{ success, message, data: contract }` |
| `/api/admin/editor-contracts/:id/terminate` | PATCH | `super_admin` | 终止合同 | `{ success, message, data: contract }` |

**Service层**：`backend/services/editorContractService.js`
- `getContractList(params)`：支持按小说标题/ID、编辑用户名、角色、状态、分成类型、开始日期范围筛选，支持分页和排序
- `getContractById(id)`：获取合同详情（包含小说标题、编辑姓名）
- `createContract(params)`：创建合同（带冲突检查，确保同一小说+角色同一时间只有一个active合同）
- `updateContract(id, params)`：更新合同
- `terminateContract(id)`：终止合同（将status改为'ended'）

---

#### 2.2.2 小说编辑合同查询接口（基于权限）

**文件路径**：`backend/routes/admin.js`（第10460-10501行）

| 路由URL | HTTP方法 | 权限要求 | 主要用途 | 返回字段 |
|---------|---------|---------|---------|---------|
| `/api/admin/novels/:novelId/editor-contracts` | GET | 有该小说权限的管理员 | 获取某小说的所有编辑合同列表 | `{ success, data: contracts[] }` |

**SQL查询**（第10479-10488行）：
```sql
SELECT 
  nec.*,
  a.name as editor_name,
  a.role as editor_role
FROM novel_editor_contract nec
LEFT JOIN admin a ON nec.editor_admin_id = a.id
WHERE nec.novel_id = ?
ORDER BY nec.created_at DESC
```

**权限检查**：使用 `checkNovelPermission(db, adminId, role, novelId)` 检查当前管理员是否有权限访问该小说。

---

#### 2.2.3 按编辑维度查询合同列表（**缺口：需要新增**）

**现状**：
- ❌ **目前没有专门按 `editor_admin_id` 查询当前登录编辑所有合同的接口**
- ✅ 现有的 `/api/admin/editor-contracts` 接口需要 `super_admin` 权限，且支持按 `editorKeyword` 筛选，但返回的是所有编辑的合同，不是当前登录编辑自己的合同

**建议新增接口**：
- **路由URL**：`GET /api/admin/my-contracts` 或 `GET /api/admin/editor-contracts/my`
- **权限要求**：普通编辑/主编/超管都可以访问（使用 `req.admin.adminId` 自动过滤）
- **参数**：
  - `page`、`pageSize`：分页参数
  - `novel_id`（可选）：按小说筛选
  - `role`（可选）：按角色筛选（'editor' / 'chief_editor'）
  - `status`（可选）：按状态筛选（'active' / 'ended' / 'cancelled'）
  - `sortField`、`sortOrder`：排序字段和顺序
- **返回结构**：
  ```json
  {
    "success": true,
    "data": {
      "list": [
        {
          "id": 1,
          "novel_id": 13,
          "novel_title": "小说标题",
          "editor_admin_id": 2,
          "role": "editor",
          "share_type": "percent_of_book",
          "share_percent": 0.0500,
          "start_chapter_id": null,
          "end_chapter_id": null,
          "start_date": "2025-11-29 00:00:00",
          "end_date": null,
          "status": "active",
          "created_at": "2025-11-29 10:00:00",
          "updated_at": "2025-11-29 10:00:00"
        }
      ],
      "total": 10,
      "page": 1,
      "pageSize": 20
    }
  }
  ```

**SQL查询建议**：
```sql
SELECT 
  c.id,
  c.novel_id,
  n.title as novel_title,
  c.editor_admin_id,
  c.role,
  c.share_type,
  c.share_percent,
  c.start_chapter_id,
  c.end_chapter_id,
  c.start_date,
  c.end_date,
  c.status,
  c.created_at,
  c.updated_at
FROM novel_editor_contract c
LEFT JOIN novel n ON c.novel_id = n.id
WHERE c.editor_admin_id = ?  -- 使用 req.admin.adminId
  AND (novel_id = ? OR ? IS NULL)  -- 可选的小说筛选
  AND (role = ? OR ? IS NULL)  -- 可选的角色筛选
  AND (status = ? OR ? IS NULL)  -- 可选的状态筛选
ORDER BY c.created_at DESC
LIMIT ? OFFSET ?
```

---

### 2.3 与其他表的关联情况

**典型SQL关联查询示例**：

1. **与 `novel` 表关联**（获取小说标题）：
   ```sql
   SELECT 
     c.*,
     n.title as novel_title
   FROM novel_editor_contract c
   LEFT JOIN novel n ON c.novel_id = n.id
   WHERE c.editor_admin_id = ?
   ```

2. **与 `admin` 表关联**（获取编辑姓名）：
   ```sql
   SELECT 
     c.*,
     a.name as editor_name,
     a.role as editor_role
   FROM novel_editor_contract c
   LEFT JOIN admin a ON c.editor_admin_id = a.id
   WHERE c.novel_id = ?
   ```

3. **与 `editor_income_monthly` 表关联**（用于统计合同产生的收入，可选）：
   ```sql
   SELECT 
     c.id,
     c.novel_id,
     n.title as novel_title,
     SUM(eim.editor_income_usd) as total_income_usd
   FROM novel_editor_contract c
   LEFT JOIN novel n ON c.novel_id = n.id
   LEFT JOIN editor_income_monthly eim ON eim.novel_id = c.novel_id 
     AND eim.editor_admin_id = c.editor_admin_id
     AND eim.role = c.role
   WHERE c.editor_admin_id = ?
   GROUP BY c.id, c.novel_id, n.title
   ```

---

## 三、现有"合同管理"页面梳理

### 3.1 超级管理员合同管理页面

**组件路径**：`frontend/src/pages/AdminPanel/AdminUserPage/ContractManagementTab.tsx`
- **组件名**：`ContractManagementTab`
- **当前行数**：约 650 行（**安全范围内**）

**页面结构**：
- **筛选区域**：
  - 小说标题/ID搜索框
  - 编辑用户名搜索框
  - 角色下拉（全部角色/主编/编辑/校对）
  - 状态下拉（全部状态/活跃/已结束/已取消）
  - 分成类型下拉
  - 开始日期范围（从/到）
  - 搜索按钮、重置按钮
- **表格字段**：
  - 合同ID | 小说 | 编辑 | 角色 | 分成类型 | 分成比例 | 开始日期 | 结束日期 | 状态 | 操作
- **操作按钮**：
  - "编辑"按钮：打开编辑Modal，可修改分成比例、开始/结束日期、状态、章节范围
  - "终止"按钮：终止合同（将status改为'ended'）
- **编辑Modal**：
  - 分成类型选择
  - 分成比例输入（前端显示百分比，后端存储小数）
  - 起始章节ID、结束章节ID下拉选择
  - 开始日期、结束日期选择器
  - 状态选择（active/ended/cancelled）

**使用的API**：
- `GET /api/admin/editor-contracts`：获取合同列表（带筛选、分页、排序）
- `GET /api/admin/editor-contracts/:id`：获取合同详情
- `GET /api/admin/editor-contracts/check-active`：检查是否有活跃合同冲突
- `PUT /api/admin/editor-contracts/:id`：更新合同
- `PATCH /api/admin/editor-contracts/:id/terminate`：终止合同

**可复用的UI元素**：
- ✅ **筛选区域布局**：可以复用筛选区域的样式和布局结构
- ✅ **表格样式**：可以复用表格的列宽、对齐、状态标签样式
- ✅ **状态标签**：可以复用状态文本映射和样式类（active=活跃，ended=已结束，cancelled=已取消）
- ✅ **角色标签**：可以复用角色文本映射（chief_editor=主编，editor=编辑，proofreader=校对）
- ✅ **分成比例格式化**：可以复用 `formatPercent` 函数（将小数转换为百分比显示）
- ❌ **编辑Modal**：不需要（"我的合同"Tab只读，不允许编辑）
- ❌ **终止按钮**：不需要（普通编辑不能终止自己的合同）

---

### 3.2 前端是否已有"按编辑维度查询合同"的接口调用

**搜索结果**：
- ❌ 前端没有调用"按当前登录编辑ID查询合同列表"的接口
- ✅ 前端有调用 `/api/admin/editor-contracts`，但需要 `super_admin` 权限，且返回所有编辑的合同

---

## 四、对后续实现「我的合同」Tab的建议

### 4.1 前端可复用的结构/组件 Checklist

#### 4.1.1 主Tab结构
- ✅ **Tab导航**：复用 `.tabs` / `.tab` / `.tab.active` 样式，在 `AdminPayoutAccounts.tsx` 中添加第四个Tab按钮
- ✅ **Tab状态**：扩展 `editorTab` 类型为 `'account' | 'editorIncome' | 'editorSettlement' | 'myContracts'`
- ✅ **条件渲染**：添加 `{editorTab === 'myContracts' && <AdminMyContractsTab onError={onError} />}`

#### 4.1.2 新建组件：AdminMyContractsTab.tsx
- **文件路径**：`frontend/src/pages/AdminPanel/AdminMyContractsTab.tsx`
- **建议行数**：控制在 600-800 行以内
- **主要模块**：
  1. **顶部统计卡片**（复用 `.summaryCards` / `.summaryCard`）：
     - 合同总数
     - 活跃合同数
     - 已结束合同数
     - 参与作品数（去重后的 novel_id 数量）
  2. **筛选区域**（复用 `.filters` / `.filterItem`）：
     - 作品下拉（可选，从 `GET /api/admin/editor-income/novels` 获取）
     - 角色下拉（全部角色/主编/编辑）
     - 状态下拉（全部状态/活跃/已结束/已取消）
     - 搜索按钮、重置按钮
  3. **合同列表表格**（复用 `.section` / `.table`）：
     - 列：合同ID | 作品 | 角色 | 分成类型 | 分成比例 | 开始日期 | 结束日期 | 状态 | 操作
     - 状态标签：复用 `.status` / `.status.completed` / `.status.pending` 样式
     - 分页：复用分页组件（20条/页）
  4. **详情Modal**（可选，如果需要）：
     - 显示合同完整信息（包括章节范围、创建时间、更新时间等）
     - 只读，不允许编辑

#### 4.1.3 样式复用
- ✅ 所有样式从 `AdminEditorIncome.module.css` 复用，无需新建样式文件
- ✅ 状态标签：`active` → 绿色（`.status.completed`），`ended` → 黄色（`.status.pending`），`cancelled` → 红色（`.status.error`）
- ✅ 角色标签：可以新增简单的文本显示，或复用 `ContractManagementTab` 中的角色样式类

---

### 4.2 后端是否需要新增"按编辑维度查询合同列表"的接口

**结论**：✅ **需要新增**

**理由**：
1. 现有的 `/api/admin/editor-contracts` 接口需要 `super_admin` 权限，普通编辑无法访问
2. 现有的 `/api/admin/novels/:novelId/editor-contracts` 接口是按小说维度查询，不是按编辑维度
3. "我的合同"Tab需要查询当前登录编辑（`req.admin.adminId`）的所有合同

**建议实现**：

**路由文件**：`backend/routes/admin.js`

**新增接口**：
```javascript
// 获取当前登录编辑的所有合同列表（按编辑维度）
router.get('/api/admin/my-contracts', authenticateAdmin, async (req, res) => {
  try {
    const adminId = req.admin.adminId; // 当前登录编辑的ID
    const { 
      page = 1, 
      pageSize = 20,
      novel_id,      // 可选：按小说筛选
      role,          // 可选：按角色筛选
      status,        // 可选：按状态筛选
      sortField = 'created_at',
      sortOrder = 'DESC'
    } = req.query;
    
    const db = await mysql.createConnection(dbConfig);
    
    try {
      // 构建WHERE条件
      const whereConditions = ['c.editor_admin_id = ?'];
      const queryParams = [adminId];
      
      if (novel_id) {
        whereConditions.push('c.novel_id = ?');
        queryParams.push(novel_id);
      }
      
      if (role) {
        whereConditions.push('c.role = ?');
        queryParams.push(role);
      }
      
      if (status) {
        whereConditions.push('c.status = ?');
        queryParams.push(status);
      }
      
      const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
      
      // 获取总数
      const [countResult] = await db.execute(
        `SELECT COUNT(*) as total 
         FROM novel_editor_contract c
         ${whereClause}`,
        queryParams
      );
      const total = countResult[0].total;
      
      // 获取列表数据
      const pageNum = Math.max(1, parseInt(page) || 1);
      const pageSizeNum = Math.max(1, Math.min(100, parseInt(pageSize) || 20));
      const offset = (pageNum - 1) * pageSizeNum;
      
      // 验证排序字段（防止SQL注入）
      const allowedSortFields = ['created_at', 'start_date', 'status', 'share_percent'];
      const safeSortField = allowedSortFields.includes(sortField) ? sortField : 'created_at';
      const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      
      const [rows] = await db.execute(
        `SELECT 
          c.id,
          c.novel_id,
          n.title as novel_title,
          c.editor_admin_id,
          c.role,
          c.share_type,
          c.share_percent,
          c.start_chapter_id,
          c.end_chapter_id,
          c.start_date,
          c.end_date,
          c.status,
          c.created_at,
          c.updated_at
         FROM novel_editor_contract c
         LEFT JOIN novel n ON c.novel_id = n.id
         ${whereClause}
         ORDER BY c.${safeSortField} ${safeSortOrder}
         LIMIT ? OFFSET ?`,
        [...queryParams, pageSizeNum, offset]
      );
      
      res.json({
        success: true,
        data: {
          list: rows,
          total,
          page: pageNum,
          pageSize: pageSizeNum
        }
      });
    } finally {
      await db.end();
    }
  } catch (error) {
    console.error('获取我的合同列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取合同列表失败',
      error: error.message
    });
  }
});
```

**统计接口**（可选，用于顶部统计卡片）：
```javascript
// 获取当前登录编辑的合同统计
router.get('/api/admin/my-contracts/summary', authenticateAdmin, async (req, res) => {
  try {
    const adminId = req.admin.adminId;
    const db = await mysql.createConnection(dbConfig);
    
    try {
      const [stats] = await db.execute(
        `SELECT 
          COUNT(*) as total_count,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
          SUM(CASE WHEN status = 'ended' THEN 1 ELSE 0 END) as ended_count,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
          COUNT(DISTINCT novel_id) as novel_count
         FROM novel_editor_contract
         WHERE editor_admin_id = ?`,
        [adminId]
      );
      
      res.json({
        success: true,
        data: stats[0]
      });
    } finally {
      await db.end();
    }
  } catch (error) {
    console.error('获取合同统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取统计失败',
      error: error.message
    });
  }
});
```

---

### 4.3 文件长度检查

**当前文件行数**（基于代码分析）：
- `AdminPayoutAccounts.tsx`：约 731 行（✅ 安全）
- `AdminEditorIncomeTab.tsx`：约 358 行（✅ 安全）
- `AdminEditorSettlementTab.tsx`：约 418 行（✅ 安全）
- `AdminEditorPayoutDetailModal.tsx`：约 150-200 行（✅ 安全）
- `ContractManagementTab.tsx`：约 650 行（✅ 安全）

**建议新建文件**：
- `AdminMyContractsTab.tsx`：控制在 600-800 行以内（✅ 安全）

**结论**：所有文件都在 2500 行限制以内，无需拆分。

---

## 五、总结

### 5.1 关键发现

1. **前端结构清晰**：
   - 主Tab导航使用 `editorTab` state 控制
   - 子组件已拆分，样式统一在 `AdminEditorIncome.module.css`
   - 可以复用现有的Tab结构、样式类和UI组件

2. **数据库表结构完整**：
   - `novel_editor_contract` 表包含所有必要字段
   - 有索引和外键约束，查询性能良好

3. **后端接口缺口**：
   - ❌ 缺少"按当前登录编辑ID查询合同列表"的接口
   - ✅ 需要新增 `GET /api/admin/my-contracts` 接口
   - ✅ 可选：新增 `GET /api/admin/my-contracts/summary` 统计接口

4. **现有合同管理页面可参考**：
   - `ContractManagementTab.tsx` 提供了完整的筛选、表格、状态标签实现
   - 可以复用筛选区域布局、表格样式、状态标签样式
   - 但不需要编辑Modal和终止按钮（"我的合同"Tab只读）

### 5.2 实现步骤建议

1. **后端**：
   - 在 `backend/routes/admin.js` 中新增 `GET /api/admin/my-contracts` 接口
   - 可选：新增 `GET /api/admin/my-contracts/summary` 统计接口

2. **前端**：
   - 在 `AdminPayoutAccounts.tsx` 中添加第四个Tab按钮"我的合同"
   - 扩展 `editorTab` 类型，添加条件渲染
   - 新建 `AdminMyContractsTab.tsx` 组件
   - 复用 `AdminEditorIncome.module.css` 样式
   - 调用新的后端接口获取数据

3. **测试**：
   - 验证普通编辑登录后能看到自己的所有合同
   - 验证筛选、分页、排序功能正常
   - 验证状态标签显示正确

---

**报告生成时间**：2025-12-01
**分析范围**：前端组件结构、数据库表结构、后端接口、现有合同管理页面

