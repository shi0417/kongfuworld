# Writers-Zone 政策文档与公告功能审计报告

**审计时间**：2025-12-18  
**审计范围**：writers-zone 页面结构、admin 公告管理、站点政策管理、相关接口与数据库表  
**审计目标**：摸清现有实现，判断可复用性，识别缺口

---

## R1. 前端路由入口

### writers-zone 路由
- **路由定义文件**：`frontend/src/App.tsx`
- **Route 配置**：第 62 行
  ```tsx
  <Route path="/writers-zone" element={<WritersZone />} />
  ```
- **入口组件名**：`WritersZone`
- **组件文件路径**：`frontend/src/pages/WritersZone.tsx`

### admin 路由
- **路由定义文件**：`frontend/src/App.tsx`
- **Route 配置**：第 66 行
  ```tsx
  <Route path="/admin" element={<AdminPanel />} />
  ```
- **入口组件名**：`AdminPanel`
- **组件文件路径**：`frontend/src/pages/AdminPanel.tsx`

---

## R2. writers-zone 顶部 Tabs / 菜单结构

### Header 区域按钮（非 Tab 切换）
- **组件位置**：`frontend/src/pages/WritersZone.tsx` 第 406-439 行
- **按钮结构**：
  - "作家交流区"：`onClick={() => navigate('/writers-exchange')}`（第 410-412 行）
  - "签约政策"：`onClick={() => navigate('/contract-policy')}`（第 413-415 行）
  - "消息"：无 onClick 处理（第 416-418 行，仅显示按钮）
- **实现方式**：使用 `navigate()` 跳转路由，非内部 state 切换
- **国际化 key**：
  - `t('header.writerExchange')` → "作家交流区" / "Writer Exchange"
  - `t('header.contractPolicy')` → "签约政策" / "Contract Policy"
  - `t('header.messages')` → "消息" / "Messages"
- **国际化文件**：`frontend/src/contexts/LanguageContext.tsx` 第 279-282 行（zh）、第 15-18 行（en）

### 左侧导航菜单（内部 state 切换）
- **状态变量**：`const [activeNav, setActiveNav] = useState('home')`（第 175 行）
- **切换方式**：通过 `setActiveNav()` 改变内部 state，非路由切换
- **菜单项渲染逻辑**：第 559-573 行
  ```tsx
  {activeNav === 'commentManagement' ? <CommentManagement /> : 
   activeNav === 'incomeManagement' ? <IncomeManagement /> : 
   activeNav === 'workData' ? <WorkData /> : 
   activeNav === 'personalInfo' ? <PersonalInfo /> : 
   activeNav === 'novels' ? <NovelListSection /> : 
   <HomeContent />}
  ```
- **各 Tab 对应组件**：
  - `home` → 首页内容（第 700-1004 行）
  - `commentManagement` → `CommentManagement` 组件（第 562 行）
  - `incomeManagement` → `IncomeManagement` 组件（第 564 行）
  - `workData` → `WorkData` 组件（第 566 行）
  - `personalInfo` → `PersonalInfo` 组件（第 568 行）
  - `novels` → 小说列表视图（第 573-699 行）

---

## R3. writers-zone "官方动态"区块

### 组件位置
- **文件路径**：`frontend/src/pages/WritersZone.tsx`
- **代码位置**：第 912-935 行
- **组件结构**：直接内嵌在 `WritersZone` 组件中，非独立组件

### 当前实现（硬编码数据）
- **标题**：`{t('announcements.title')}` → "官方动态" / "Official Announcements"
- **"更多"链接**：`<a href="#" className={styles.link}>{t('announcements.more')}</a>`（第 915 行）
  - 当前为 `href="#"`，无实际跳转逻辑
- **数据来源**：硬编码在 JSX 中（第 918-933 行）
  ```tsx
  <div className={styles.announcementItem}>
    <span className={styles.date}>10-31</span>
    <span className={styles.content}>
      {language === 'zh' ? '版权运营相关更新说明' : 'Copyright Operations Update'}
    </span>
  </div>
  ```
- **展示字段**：
  - `date`：硬编码字符串（如 "10-31"）
  - `content`：硬编码字符串（中英文切换）

### Props/数据流
- **无 props**：该区块不接受任何外部数据
- **无 API 调用**：当前无任何数据获取逻辑
- **无状态管理**：无 useState/useEffect 相关代码

### "更多"入口
- **当前状态**：存在但无功能（`href="#"`）
- **推断目标路由**：可能应为 `/announcements` 或 `/writers-zone/announcements`
- **现有公告列表页**：`frontend/src/pages/AnnouncementsPage.tsx`（存在，但未在 writers-zone 中引用）

---

## R4. admin - 公告管理（homepage_announcements）

### 前端页面
- **列表页文件路径**：`frontend/src/pages/AdminPanel/AdminAnnouncementManagement.tsx`
- **编辑/新建方式**：Modal 弹窗（非独立页面）
  - Modal 状态：`const [modalOpen, setModalOpen] = useState(false)`（第 52 行）
  - 编辑状态：`const [editing, setEditing] = useState<AnnouncementRow | null>(null)`（第 53 行）
- **Modal 位置**：第 295-395 行

### 后端接口
- **GET 列表**：`GET /api/admin/homepage-announcements`
  - **后端路由文件**：`backend/routes/admin.js`
  - **路由定义**：第 4223-4247 行
  - **权限**：`authenticateAdmin + requireRole('editor', 'super_admin')`
  - **返回结构**：
    ```json
    {
      "success": true,
      "data": [
        {
          "id": number,
          "title": string,
          "content": string,
          "content_format": "markdown" | "html",
          "link_url": string | null,
          "display_order": number,
          "is_active": number (0|1),
          "start_date": string | null,
          "end_date": string | null,
          "created_at": string,
          "updated_at": string
        }
      ]
    }
    ```

- **POST 创建**：`POST /api/admin/homepage-announcements`
  - **后端路由文件**：`backend/routes/admin.js`
  - **路由定义**：第 4250-4286 行
  - **请求体字段**：`title`, `content`, `content_format`, `link_url`, `display_order`, `is_active`, `start_date`, `end_date`

- **PUT 更新**：`PUT /api/admin/homepage-announcements/:id`
  - **后端路由文件**：`backend/routes/admin.js`
  - **路由定义**：第 4289-4356 行
  - **支持部分更新**：仅更新传入的字段

- **DELETE 删除**：`DELETE /api/admin/homepage-announcements/:id`
  - **后端路由文件**：`backend/routes/admin.js`
  - **路由定义**：第 4359-4377 行

### SQL 查询
- **列表查询**（第 4229-4236 行）：
  ```sql
  SELECT
    id, title, content, content_format, link_url, display_order, is_active,
    start_date, end_date, created_at, updated_at
  FROM homepage_announcements
  ORDER BY display_order ASC, id DESC
  ```
- **创建插入**（第 4269-4276 行）：
  ```sql
  INSERT INTO homepage_announcements
    (title, content, content_format, link_url, display_order, is_active, start_date, end_date)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ```
- **更新查询**（第 4347 行）：
  ```sql
  UPDATE homepage_announcements SET ${updates.join(', ')} WHERE id = ?
  ```

### 过滤条件
- **后端接口**：无查询参数过滤（admin 接口返回全部记录）
- **前端过滤**：无（列表页直接显示所有记录）
- **数据库表字段**：
  - `is_active`：0=禁用，1=启用
  - `start_date`：开始展示时间（DATETIME，可为 NULL）
  - `end_date`：结束展示时间（DATETIME，可为 NULL）

### 排序规则
- **后端 SQL**：`ORDER BY display_order ASC, id DESC`（第 4235 行）
- **前端二次排序**：无（直接使用后端返回顺序）

### content_format 渲染规则
- **前端渲染位置**：`frontend/src/pages/AdminPanel/AdminAnnouncementManagement.tsx` 第 324-333 行
- **渲染方式**：
  - `content_format === 'markdown'`：使用 `<textarea>` 显示原始 Markdown（编辑时）
  - `content_format === 'html'`：使用 `<textarea>` 显示原始 HTML（编辑时）
  - **注意**：admin 管理页面仅显示原始文本，不进行 Markdown/HTML 渲染

### 数据库表结构
- **表名**：`homepage_announcements`
- **迁移文件**：`backend/migrations/20251213_create_homepage_announcements.sql`
- **字段列表**：
  - `id` INT PK AI
  - `title` VARCHAR(255) NOT NULL
  - `content` TEXT NULL
  - `content_format` ENUM('markdown','html')（通过迁移 `20251214_add_homepage_announcements_content_format.sql` 添加）
  - `link_url` VARCHAR(500) NULL
  - `display_order` INT NOT NULL DEFAULT 0
  - `is_active` TINYINT(1) NOT NULL DEFAULT 1
  - `start_date` DATETIME NULL
  - `end_date` DATETIME NULL
  - `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
  - `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
- **索引**：
  - `KEY idx_active_order (is_active, display_order)`
  - `KEY idx_active_window (is_active, start_date, end_date)`

---

## R5. admin - 站点政策（site_legal_documents）

### 前端页面
- **列表页文件路径**：`frontend/src/pages/AdminPanel/AdminLegalDocsManagement.tsx`
- **编辑/新建方式**：Modal 弹窗（非独立页面）
  - Modal 状态：`const [modalOpen, setModalOpen] = useState(false)`（第 66 行）
  - 编辑状态：`const [editing, setEditing] = useState<LegalDocRow | null>(null)`（第 67 行）
- **Modal 位置**：第 395-507 行

### 后端接口
- **GET 列表**：`GET /api/admin/legal-docs?doc_key=&language=&status=`
  - **后端路由文件**：`backend/routes/admin.js`
  - **路由定义**：第 13548-13589 行
  - **权限**：`authenticateAdmin + requireRole('editor', 'super_admin')`
  - **查询参数**：
    - `doc_key`：可选，过滤文档类型
    - `language`：可选，过滤语言
    - `status`：可选，过滤状态（draft/published/archived）
  - **返回结构**：
    ```json
    {
      "success": true,
      "data": [
        {
          "id": number,
          "doc_key": "terms_of_service" | "privacy_policy" | "cookie_policy",
          "language": string,
          "title": string,
          "version": string,
          "content_md": string,
          "status": "draft" | "published" | "archived",
          "is_current": number (0|1),
          "effective_at": string | null,
          "created_by": number | null,
          "updated_by": number | null,
          "created_at": string,
          "updated_at": string
        }
      ]
    }
    ```

- **POST 创建**：`POST /api/admin/legal-docs`
  - **后端路由文件**：`backend/routes/admin.js`
  - **路由定义**：第 13592-13633 行
  - **请求体字段**：`doc_key`, `language`, `title`, `version`, `content_md`, `effective_at`
  - **默认值**：`status='draft'`, `is_current=0`

- **PUT 更新**：`PUT /api/admin/legal-docs/:id`
  - **后端路由文件**：`backend/routes/admin.js`
  - **路由定义**：第 13635-13736 行
  - **限制**：已发布（published）版本只允许改为 archived，不允许修改正文

- **POST 设为当前**：`POST /api/admin/legal-docs/:id/set-current`
  - **后端路由文件**：`backend/routes/admin.js`
  - **路由定义**：第 13738-13780 行
  - **事务逻辑**：先清零同 `doc_key+language` 的所有 `is_current=0`，再设置当前记录为 1

- **DELETE 删除**：`DELETE /api/admin/legal-docs/:id`
  - **后端路由文件**：`backend/routes/admin.js`
  - **路由定义**：第 13782-13804 行
  - **限制**：仅允许删除 `status='draft'` 的记录

### SQL 查询
- **列表查询**（第 13555-13577 行）：
  ```sql
  SELECT 
    id, doc_key, language, title, version, content_md, status, is_current,
    effective_at, created_by, updated_by, created_at, updated_at
  FROM site_legal_documents
  WHERE 1=1
    [AND doc_key = ?]
    [AND language = ?]
    [AND status = ?]
  ORDER BY doc_key ASC, language ASC, is_current DESC, effective_at DESC, updated_at DESC
  ```
- **设为当前事务**（第 13761-13775 行）：
  ```sql
  BEGIN TRANSACTION;
  UPDATE site_legal_documents SET is_current = 0 WHERE doc_key = ? AND language = ?;
  UPDATE site_legal_documents SET is_current = 1 WHERE id = ?;
  COMMIT;
  ```

### 过滤条件
- **doc_key**：前端下拉选项（第 49-53 行）：
  ```tsx
  const DOC_KEY_OPTIONS = [
    { value: 'terms_of_service', label: 'Terms of Service' },
    { value: 'privacy_policy', label: 'Privacy Policy' },
    { value: 'cookie_policy', label: 'Cookie Policy' }
  ];
  ```
  - **维护位置**：前端硬编码（`AdminLegalDocsManagement.tsx` 第 49-53 行）
  - **后端校验**：`backend/routes/admin.js` 第 13545 行
    ```js
    const ALLOWED_DOC_KEYS = ['terms_of_service', 'privacy_policy', 'cookie_policy'];
    ```
- **language**：前端下拉选项（第 274-280 行）：`en` / `zh`
- **status**：前端下拉选项（第 55-59 行）：`draft` / `published` / `archived`

### 排序规则
- **后端 SQL**：`ORDER BY doc_key ASC, language ASC, is_current DESC, effective_at DESC, updated_at DESC`（第 13577 行）

### is_current 切换逻辑
- **实现位置**：`backend/routes/admin.js` 第 13738-13780 行
- **事务保证**：使用 `db.beginTransaction()` / `db.commit()` / `db.rollback()`
- **逻辑**：
  1. 查询目标记录，校验 `status === 'published'`
  2. 事务开始
  3. `UPDATE site_legal_documents SET is_current = 0 WHERE doc_key = ? AND language = ?`
  4. `UPDATE site_legal_documents SET is_current = 1 WHERE id = ?`
  5. 事务提交
- **结论**：**会自动把同 doc_key+language 的其他记录置 0**

### 数据库表结构
- **表名**：`site_legal_documents`
- **迁移文件**：`backend/migrations/20251216_create_site_legal_documents.sql`
- **字段列表**：
  - `id` INT PK AI
  - `doc_key` VARCHAR(64) NOT NULL（值：terms_of_service/privacy_policy/cookie_policy）
  - `language` VARCHAR(16) NOT NULL DEFAULT 'en'
  - `title` VARCHAR(255) NOT NULL
  - `version` VARCHAR(64) NOT NULL
  - `content_md` LONGTEXT NOT NULL
  - `status` ENUM('draft','published','archived') NOT NULL DEFAULT 'draft'
  - `is_current` TINYINT(1) NOT NULL DEFAULT 0
  - `effective_at` DATETIME NULL
  - `created_by` INT NULL（admin.id）
  - `updated_by` INT NULL（admin.id）
  - `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
  - `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
- **索引**：
  - `KEY idx_doc_key_lang (doc_key, language)`
  - `KEY idx_status_current (status, is_current)`

---

## R6. 现有公共接口/工具

### 公开读取站点政策接口
- **接口 URL**：`GET /api/legal/:docKey?lang=en`
- **后端路由文件**：`backend/routes/legal.js`
- **路由定义**：第 27-74 行
- **挂载位置**：`backend/server.js` 第 181-182 行
  ```js
  const legalRoutes = require('./routes/legal');
  app.use('/api/legal', legalRoutes);
  ```
- **权限**：公开接口，无需登录
- **docKey 映射**（第 15-24 行）：
  ```js
  const DOC_KEY_MAP = {
    'terms': 'terms_of_service',
    'privacy': 'privacy_policy',
    'cookies': 'cookie_policy',
    'cookie': 'cookie_policy',
    'terms_of_service': 'terms_of_service',
    'privacy_policy': 'privacy_policy',
    'cookie_policy': 'cookie_policy'
  };
  ```
- **查询条件**：`WHERE doc_key = ? AND language = ? AND status = 'published' AND is_current = 1`
- **返回结构**：
  ```json
  {
    "success": true,
    "data": {
      "title": string,
      "content_md": string,
      "version": string,
      "effective_at": string | null,
      "updated_at": string
    }
  }
  ```
- **使用示例**：`frontend/src/pages/LegalDocumentPage.tsx` 第 54 行
  ```tsx
  const res = await ApiService.get(`/legal/${docKey}?lang=en`);
  ```

### 公开读取公告接口
- **接口 URL**：`GET /api/news`
- **后端路由文件**：`backend/routes/publicNews.js`
- **路由定义**：第 29-45 行
- **挂载位置**：`backend/server.js` 第 262 行（通过 `createPublicNewsRouter` 函数创建）
- **权限**：公开接口，无需登录
- **查询条件**：
  ```sql
  WHERE is_active = 1
    AND (start_date IS NULL OR start_date <= NOW())
    AND (end_date IS NULL OR end_date >= NOW())
  ```
- **排序**：`ORDER BY display_order ASC, created_at DESC`
- **返回结构**：
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": number,
          "title": string,
          "content": string,
          "content_format": "markdown" | "html",
          "created_at": string,
          "updated_at": string,
          "link_url": string | null,
          "display_order": number
        }
      ]
    }
  }
  ```

### 前端 API Client
- **文件路径**：`frontend/src/services/ApiService.ts`
- **类名**：`ApiService`
- **基础 URL**：`http://localhost:5000/api`（第 53 行）
- **主要方法**：
  - `static async request<T>(endpoint: string, options: RequestInit): Promise<ApiResponse<T>>`（第 58-156 行）
  - `static async get<T>(endpoint: string): Promise<ApiResponse<T>>`（第 161-163 行）
  - `static async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>>`（第 168-176 行）
  - `static async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>>`（第 181-189 行）
  - `static async delete<T>(endpoint: string, data?: any): Promise<ApiResponse<T>>`（第 194-199 行）
- **Token 处理**：
  - 管理员 API（`/admin/*`）：使用 `localStorage.getItem('adminToken')`
  - 普通 API：使用 `AuthService.getAuthState().token`
- **返回类型**：`ApiResponse<T>`（第 11-18 行）
  ```typescript
  interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
    status?: number;
    pagination?: PaginationInfo;
  }
  ```

### Markdown Renderer 组件
- **库名**：`react-markdown`
- **版本**：`^10.1.0`（`frontend/package.json` 第 16 行）
- **插件**：`remark-gfm`（GitHub Flavored Markdown）
- **使用位置**：
  1. `frontend/src/pages/LegalDocumentPage.tsx` 第 3-4 行导入，第 101-127 行使用
  2. `frontend/src/pages/NewsDetail.tsx` 第 3-4 行导入，第 94-120 行使用
- **使用示例**（`LegalDocumentPage.tsx` 第 101-127 行）：
  ```tsx
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      a: ({ href, children, ...props }) => {
        const url = typeof href === 'string' ? href : '';
        if (url.startsWith('/')) {
          return <Link to={url}>{children}</Link>;
        }
        return <a href={url} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
      }
    }}
  >
    {doc.content_md || ''}
  </ReactMarkdown>
  ```

---

## R7. writers-zone 需要的目标数据结构（按现状推断）

### "签约政策"读取 site_legal_documents
- **推断接口**：复用 `GET /api/legal/:docKey?lang=en`
- **需要字段**：
  - `title`：文档标题
  - `content_md`：Markdown 内容（用于渲染）
  - `version`：版本号（可选显示）
  - `effective_at`：生效时间（可选显示）
  - `updated_at`：更新时间（可选显示）
- **docKey 推断**：可能需要新增 `contract_policy` 映射到新的 `doc_key`，或复用现有 `terms_of_service`
- **语言参数**：需要根据 `writers-zone` 的 `language` state（第 164 行）动态传入

### "官方动态"读取 homepage_announcements
- **推断接口**：复用 `GET /api/news`
- **需要字段**：
  - `id`：用于跳转详情页
  - `title`：标题
  - `content`：内容预览（截取前 N 字符）
  - `created_at`：创建时间（格式化为 "MM-DD"）
  - `link_url`：跳转链接（如果有）
- **过滤条件推断**：
  - 可能需要限制数量（如 TOP 5）
  - 需要按 `display_order ASC, created_at DESC` 排序（接口已实现）
  - 需要过滤 `is_active=1` 和时间窗口（接口已实现）

---

## R8. 缺口清单（只列事实）

### 缺失的 API
1. **签约政策专用接口**：
   - 现状：`/api/legal/:docKey` 仅支持 `terms_of_service` / `privacy_policy` / `cookie_policy`
   - 缺口：如需 `contract_policy`，需新增 `doc_key` 支持或新增接口

2. **writers-zone 公告列表接口**：
   - 现状：`/api/news` 返回全部公告
   - 缺口：如需限制数量（如 TOP 5），需新增 `limit` 参数或新增接口

### 缺失的页面/组件
1. **"签约政策"页面**：
   - 现状：`/contract-policy` 路由不存在（WritersZone.tsx 第 413 行跳转但路由未定义）
   - 缺口：需创建页面组件或复用 `LegalDocumentPage`

2. **"消息"功能页面**：
   - 现状：按钮无 onClick 处理（第 416-418 行）
   - 缺口：需创建消息列表/详情页面

3. **"官方动态"更多页面**：
   - 现状：`href="#"` 无实际跳转（第 915 行）
   - 缺口：需实现跳转到公告列表页或 writers-zone 专用公告页

4. **writers-zone 公告列表组件**：
   - 现状：硬编码数据（第 918-933 行）
   - 缺口：需创建可复用组件，调用 `/api/news` 接口

### 缺失的 doc_key 支持
1. **contract_policy**：
   - 现状：`ALLOWED_DOC_KEYS`（`backend/routes/admin.js` 第 13545 行）仅包含 3 种
   - 缺口：如需支持签约政策，需在 `ALLOWED_DOC_KEYS` 和 `DOC_KEY_MAP` 中添加 `contract_policy`

---

## R9. 风险点

### 可能与现有系统冲突的点
1. **字段命名冲突**：
   - `homepage_announcements.content` vs `site_legal_documents.content_md`
   - 公告使用 `content`，政策使用 `content_md`（命名不一致）

2. **权限冲突**：
   - admin 接口需要 `editor/super_admin` 权限
   - writers-zone 需要公开或作者权限
   - **现状**：已有公开接口 `/api/news` 和 `/api/legal/:docKey`，无冲突

3. **时间过滤冲突**：
   - `homepage_announcements` 使用 `start_date` / `end_date` 时间窗
   - `site_legal_documents` 使用 `effective_at`（单时间点）
   - **影响**：writers-zone 读取时需注意时间过滤逻辑差异

4. **content_format 处理冲突**：
   - `homepage_announcements.content_format`：`markdown` / `html`
   - `site_legal_documents`：固定为 Markdown（`content_md` 字段）
   - **影响**：公告需要判断 `content_format` 选择渲染方式，政策固定用 Markdown

### 可能造成 breaking change 的点
1. **修改现有接口返回结构**：
   - `/api/news` 当前返回 `{ success: true, data: { items: [...] } }`
   - 如需添加 `limit` 参数，需确保向后兼容（默认返回全部）

2. **修改 doc_key 枚举**：
   - 在 `ALLOWED_DOC_KEYS` 中添加新值不影响现有数据
   - 但需同步更新前端 `DOC_KEY_OPTIONS`（`AdminLegalDocsManagement.tsx` 第 49-53 行）

3. **修改数据库表结构**：
   - 如需在 `site_legal_documents` 中添加 `contract_policy` 支持，无需修改表结构（`doc_key` 为 VARCHAR）
   - 如需新增字段，需创建迁移文件

---

## R10. 最小复用路径建议（事实+推断明确标注）

### 可直接复用的部分

#### 1. 公开接口（✅ 可直接复用）
- **`GET /api/news`**：
  - **事实**：已存在，返回公告列表，过滤 `is_active=1` 和时间窗
  - **推断**：writers-zone "官方动态"可直接调用，前端限制显示数量即可
  - **文件位置**：`backend/routes/publicNews.js` 第 29-45 行

- **`GET /api/legal/:docKey?lang=en`**：
  - **事实**：已存在，返回当前生效的政策文档
  - **推断**：如需显示签约政策，需先确认是否复用 `terms_of_service` 或新增 `contract_policy`
  - **文件位置**：`backend/routes/legal.js` 第 27-74 行

#### 2. 前端组件/工具（✅ 可直接复用）
- **`ApiService`**：
  - **事实**：已存在，统一 API 调用封装
  - **推断**：writers-zone 可直接使用 `ApiService.get('/news')` 和 `ApiService.get('/legal/...')`
  - **文件位置**：`frontend/src/services/ApiService.ts`

- **`ReactMarkdown`**：
  - **事实**：已安装并在 `LegalDocumentPage` 和 `NewsDetail` 中使用
  - **推断**：writers-zone 政策页面可直接复用相同渲染逻辑
  - **文件位置**：`frontend/src/pages/LegalDocumentPage.tsx` 第 101-127 行（参考实现）

### 必须新增的部分（因为现有不存在/不匹配）

#### 1. writers-zone "官方动态"组件（❌ 需新增）
- **原因**：当前硬编码数据（`WritersZone.tsx` 第 918-933 行），无 API 调用
- **需实现**：
  - 创建独立组件或修改现有区块
  - 调用 `GET /api/news` 接口
  - 限制显示数量（如 TOP 5）
  - 格式化日期为 "MM-DD"
  - 实现"更多"跳转逻辑

#### 2. "签约政策"页面路由（❌ 需新增）
- **原因**：`/contract-policy` 路由不存在（`WritersZone.tsx` 第 413 行跳转但 `App.tsx` 无定义）
- **需实现**：
  - 方案 A：复用 `LegalDocumentPage`，添加 `/contract-policy` 路由映射到 `/legal/contract-policy`
  - 方案 B：创建独立页面组件
  - **前提**：需确认 `contract_policy` 是否作为新的 `doc_key` 或复用现有

#### 3. doc_key 扩展（❌ 如需支持 contract_policy）
- **原因**：`ALLOWED_DOC_KEYS` 仅包含 3 种（`backend/routes/admin.js` 第 13545 行）
- **需实现**：
  - 在 `backend/routes/admin.js` 第 13545 行添加 `'contract_policy'`
  - 在 `backend/routes/legal.js` 第 15-24 行 `DOC_KEY_MAP` 中添加映射
  - 在 `frontend/src/pages/AdminPanel/AdminLegalDocsManagement.tsx` 第 49-53 行 `DOC_KEY_OPTIONS` 中添加选项
  - 在数据库 `site_legal_documents` 表中创建 `doc_key='contract_policy'` 的记录

#### 4. "消息"功能页面（❌ 需新增）
- **原因**：按钮无 onClick 处理（`WritersZone.tsx` 第 416-418 行）
- **需实现**：创建消息列表/详情页面（不在本次审计范围内，但需注意）

---

## 关键代码片段位置索引

### writers-zone 相关
1. **路由定义**：`frontend/src/App.tsx` 第 62 行
2. **Header 按钮**：`frontend/src/pages/WritersZone.tsx` 第 406-439 行
3. **官方动态区块**：`frontend/src/pages/WritersZone.tsx` 第 912-935 行
4. **activeNav 状态管理**：`frontend/src/pages/WritersZone.tsx` 第 175 行
5. **国际化配置**：`frontend/src/contexts/LanguageContext.tsx` 第 279-282 行（zh）、第 15-18 行（en）

### admin 公告管理相关
1. **前端列表页**：`frontend/src/pages/AdminPanel/AdminAnnouncementManagement.tsx` 第 47-398 行
2. **后端 GET 接口**：`backend/routes/admin.js` 第 4223-4247 行
3. **后端 POST 接口**：`backend/routes/admin.js` 第 4250-4286 行
4. **SQL 列表查询**：`backend/routes/admin.js` 第 4229-4236 行
5. **数据库表结构**：`backend/migrations/20251213_create_homepage_announcements.sql`

### admin 站点政策相关
1. **前端列表页**：`frontend/src/pages/AdminPanel/AdminLegalDocsManagement.tsx` 第 61-507 行
2. **后端 GET 接口**：`backend/routes/admin.js` 第 13548-13589 行
3. **后端 set-current 事务**：`backend/routes/admin.js` 第 13738-13780 行
4. **doc_key 选项定义**：`frontend/src/pages/AdminPanel/AdminLegalDocsManagement.tsx` 第 49-53 行
5. **数据库表结构**：`backend/migrations/20251216_create_site_legal_documents.sql`

### 公开接口相关
1. **政策公开接口**：`backend/routes/legal.js` 第 27-74 行
2. **公告公开接口**：`backend/routes/publicNews.js` 第 29-45 行
3. **路由挂载**：`backend/server.js` 第 181-182 行（legal）、第 262 行（news）
4. **前端使用示例**：`frontend/src/pages/LegalDocumentPage.tsx` 第 54 行

### 工具类相关
1. **ApiService 类**：`frontend/src/services/ApiService.ts` 第 52-200 行
2. **ReactMarkdown 使用**：`frontend/src/pages/LegalDocumentPage.tsx` 第 101-127 行
3. **ReactMarkdown 使用**：`frontend/src/pages/NewsDetail.tsx` 第 94-120 行

---

**报告结束**

