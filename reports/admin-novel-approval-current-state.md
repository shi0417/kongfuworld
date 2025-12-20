# 现状报告：小说审批列表（权限/数据链路）

**生成时间**: 2025-01-XX  
**审计范围**: 小说审批列表的完整数据链路（前端路由 → API → SQL → 权限过滤）  
**审计方法**: 静态代码分析 + 全仓搜索

---

## C1. 路由与页面入口

### 1.1 前端路由定义

**文件路径**: `frontend/src/App.tsx`

**路由配置**:
```65:65:frontend/src/App.tsx
        <Route path="/admin" element={<AdminPanel />} />
```

**结论**: `/admin` 路由直接渲染 `AdminPanel` 组件，无嵌套路由。

---

### 1.2 小说审批页面组件

**文件路径**: `frontend/src/pages/AdminPanel/NovelReview/index.tsx`

**组件导入位置**: `frontend/src/pages/AdminPanel.tsx`
```5:5:frontend/src/pages/AdminPanel.tsx
import NovelReview from './AdminPanel/NovelReview';
```

**组件渲染位置**: `frontend/src/pages/AdminPanel.tsx`
```1746:1749:frontend/src/pages/AdminPanel.tsx
          {/* 小说审批选项卡 */}
          {activeTab === 'novel-review' && (
            <NovelReview onError={setError} />
          )}
```

**Tab 类型定义**: `frontend/src/pages/AdminPanel.tsx`
```62:62:frontend/src/pages/AdminPanel.tsx
type TabType = 'novel-review' | 'new-novel-pool' | 'chapter-approval' | 'payment-stats' | 'author-income' | 'reader-income' | 'base-income' | 'author-royalty' | 'commission-transaction' | 'editor-base-income' | 'commission-settings' | 'settlement-overview' | 'editor-management' | 'ai-batch-translation' | 'admin-payout-account' | 'admin-banner-management' | 'announcement-management';
```

**菜单配置**: `frontend/src/pages/adminMenuConfig.ts`
```68:68:frontend/src/pages/adminMenuConfig.ts
  { key: 'novel-review', label: '小说审批', icon: '📚', tab: 'novel-review' },
```

**结论**: 
- 小说审批页面通过 `activeTab === 'novel-review'` 条件渲染
- 组件路径: `frontend/src/pages/AdminPanel/NovelReview/index.tsx`
- 组件接受 `onError` 回调用于错误处理

---

## C2. 前端：当前用户与 role 的来源

### 2.1 Token 存储位置

**存储方式**: `localStorage`

**Key**: `adminToken`

**证据代码**: `frontend/src/pages/AdminPanel/NovelReview/index.tsx`
```53:53:frontend/src/pages/AdminPanel/NovelReview/index.tsx
    const token = localStorage.getItem('adminToken');
```

**登录时存储**: `frontend/src/pages/AdminPanel.tsx`
```1493:1494:frontend/src/pages/AdminPanel.tsx
        localStorage.setItem('adminToken', token);
        setAdminToken(token);
```

---

### 2.2 Token 解码与 role 获取

**解码函数调用**: `frontend/src/pages/AdminPanel.tsx`
```1498:1501:frontend/src/pages/AdminPanel.tsx
        const decoded = decodeToken(token);
        if (decoded) {
          setCurrentAdminName(decoded.name || decoded.username || '未知用户');
          setCurrentAdminRole(decoded.role || '');
        }
```

**结论**: 
- Token 存储在 `localStorage` 的 `adminToken` key
- 登录后通过 `decodeToken` 解码 JWT，提取 `role` 字段
- `role` 存储在组件状态 `currentAdminRole` 中
- **注意**: `NovelReview` 组件内部**不直接使用** `currentAdminRole`，而是通过 API 请求时携带 token，后端从 token 中解析 role

---

### 2.3 API 请求中的 Token 传递

**请求函数**: `frontend/src/pages/AdminPanel/NovelReview/index.tsx`
```52:84:frontend/src/pages/AdminPanel/NovelReview/index.tsx
  const adminApiRequest = async (endpoint: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('adminToken');
    
    // 检查是否是 FormData，如果是则不设置 Content-Type（让浏览器自动设置）
    const isFormData = options.body instanceof FormData;
    
    // 构建请求头
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
    };
    
    // 只有当不是 FormData 且没有指定 Content-Type 时才设置默认值
    if (!isFormData && !options.headers) {
      headers['Content-Type'] = 'application/json';
    } else if (!isFormData && options.headers) {
      // 如果已有 headers，合并它们
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]) => {
          headers[key] = value;
        });
      } else {
        Object.assign(headers, options.headers);
      }
    }
    
    const response = await fetch(`http://localhost:5000/api${endpoint}`, {
      ...options,
      headers,
    });
```

**结论**: 
- Token 通过 `Authorization: Bearer ${token}` 请求头传递
- 所有 API 请求统一使用 `adminApiRequest` 函数
- 前端**不直接读取** `role`，完全依赖后端从 token 解析

---

## C3. 前端：审批列表请求（URL/参数/触发时机/状态tab映射）

### 3.1 列表请求函数

**文件路径**: `frontend/src/pages/AdminPanel/NovelReview/index.tsx`

**函数定义**:
```110:140:frontend/src/pages/AdminPanel/NovelReview/index.tsx
  // 加载小说列表
  const loadNovels = async () => {
    try {
      setLoading(true);
      const endpoint = filterStatus === 'all' 
        ? '/admin/pending-novels' 
        : `/admin/novels?status=${filterStatus}`;
      
      const { data } = await adminApiRequest(endpoint);
      
      if (data.success) {
        setNovels(data.data || []);
        if (onError) {
          onError(''); // 清除之前的错误
        }
      } else {
        if (onError) {
          onError(data.message || '加载失败');
        }
      }
    } catch (err: any) {
      // token 过期错误已经在 adminApiRequest 中处理了
      if (!err.message || !err.message.includes('Token')) {
        if (onError) {
          onError(err.message || '加载失败');
        }
      }
    } finally {
      setLoading(false);
    }
  };
```

**触发时机**: `useEffect` 监听 `filterStatus` 变化
```142:146:frontend/src/pages/AdminPanel/NovelReview/index.tsx
  // 当筛选状态改变时重新加载
  useEffect(() => {
    loadNovels();
    loadEditors();
  }, [filterStatus]);
```

---

### 3.2 Tab 状态映射

**Tab 按钮定义**: `frontend/src/pages/AdminPanel/NovelReview/index.tsx`
```330:361:frontend/src/pages/AdminPanel/NovelReview/index.tsx
          <div className={styles.filterButtons}>
            <button
              className={filterStatus === 'all' ? styles.active : ''}
              onClick={() => setFilterStatus('all')}
            >
              全部待审批
            </button>
            <button
              className={filterStatus === 'submitted' ? styles.active : ''}
              onClick={() => setFilterStatus('submitted')}
            >
              已提交
            </button>
            <button
              className={filterStatus === 'reviewing' ? styles.active : ''}
              onClick={() => setFilterStatus('reviewing')}
            >
              审核中
            </button>
            <button
              className={filterStatus === 'approved' ? styles.active : ''}
              onClick={() => setFilterStatus('approved')}
            >
              已批准
            </button>
            <button
              className={filterStatus === 'rejected' ? styles.active : ''}
              onClick={() => setFilterStatus('rejected')}
            >
              已拒绝
            </button>
          </div>
```

**状态值映射表**:

| Tab 显示名称 | `filterStatus` 值 | API Endpoint | 说明 |
|------------|------------------|--------------|------|
| 全部待审批 | `'all'` | `/admin/pending-novels` | 固定 endpoint，后端过滤 `review_status IN ('created', 'submitted', 'reviewing')` |
| 已提交 | `'submitted'` | `/admin/novels?status=submitted` | 动态 endpoint，后端过滤 `review_status = 'submitted'` |
| 审核中 | `'reviewing'` | `/admin/novels?status=reviewing` | 动态 endpoint，后端过滤 `review_status = 'reviewing'` |
| 已批准 | `'approved'` | `/admin/novels?status=approved` | 动态 endpoint，后端过滤 `review_status = 'approved'` |
| 已拒绝 | `'rejected'` | `/admin/novels?status=rejected` | 动态 endpoint，后端过滤 `review_status = 'rejected'` |

**结论**: 
- `filterStatus` 初始值为 `'all'`（见组件状态定义）
- Tab 切换时更新 `filterStatus`，触发 `useEffect` 重新调用 `loadNovels()`
- 前端**不进行状态值转换**，直接传递字符串给后端

---

### 3.3 请求 URL 构建逻辑

**代码位置**: `frontend/src/pages/AdminPanel/NovelReview/index.tsx:114-116`

```114:116:frontend/src/pages/AdminPanel/NovelReview/index.tsx
      const endpoint = filterStatus === 'all' 
        ? '/admin/pending-novels' 
        : `/admin/novels?status=${filterStatus}`;
```

**完整请求 URL**:
- `filterStatus === 'all'`: `http://localhost:5000/api/admin/pending-novels`
- 其他状态: `http://localhost:5000/api/admin/novels?status={filterStatus}`

**请求方法**: `GET`

**请求头**: 
```
Authorization: Bearer {adminToken}
Content-Type: application/json
```

---

## C4. 后端：审批列表 API（路由/handler/SQL或查询条件/分页/排序）

### 4.1 API 路由定义

**文件路径**: `backend/routes/admin.js`

**路由1: 全部待审批** (`GET /admin/pending-novels`)
```223:319:backend/routes/admin.js
router.get('/pending-novels', authenticateAdmin, async (req, res) => {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    // 应用权限过滤
    // - super_admin: 显示所有小说（permissionFilter.where 为空）
    // - editor: 只显示 novel_editor_contract 中该编辑有效的小说（status='active' 且日期在有效期内）
    const permissionFilter = await getNovelPermissionFilter(
      db, 
      req.admin.adminId, 
      req.admin.role
    );
    
    // 查询待审批的小说（created, submitted, reviewing状态），包含标签和主角信息
    const [novels] = await db.execute(
      `SELECT 
        n.*, 
        MAX(u.username) as author_name, 
        MAX(u.pen_name) as pen_name,
        GROUP_CONCAT(DISTINCT g.chinese_name ORDER BY g.id SEPARATOR ',') as genre_names,
        GROUP_CONCAT(DISTINCT p.name ORDER BY p.created_at SEPARATOR ',') as protagonist_names
       FROM novel n
       LEFT JOIN user u ON (n.author = u.pen_name OR n.author = u.username)
       LEFT JOIN novel_genre_relation ngr ON n.id = ngr.novel_id
       LEFT JOIN genre g ON (ngr.genre_id_1 = g.id OR ngr.genre_id_2 = g.id)
       LEFT JOIN protagonist p ON n.id = p.novel_id
       WHERE n.review_status IN ('created', 'submitted', 'reviewing') ${permissionFilter.where}
       GROUP BY n.id
       ORDER BY n.id DESC`,
      permissionFilter.params
    );

    // 处理标签和主角数据
    const processedNovels = novels.map(novel => {
      const genres = novel.genre_names ? novel.genre_names.split(',').filter(g => g && g !== 'null') : [];
      const protagonists = novel.protagonist_names ? novel.protagonist_names.split(',').filter(p => p) : [];
      
      return {
        ...novel,
        genres: genres,
        protagonists: protagonists
      };
    });

    // 计算 can_review 字段：小说审批权限基于 novel_editor_contract，有效合同才能审核
    const { adminId, role } = req.admin;
    let novelIds = processedNovels.map(n => n.id);
    let contractMap = {};

    // super_admin 需要查询是否有合同
    if (role === 'super_admin' && novelIds.length > 0) {
      const placeholders = novelIds.map(() => '?').join(',');
      const [contracts] = await db.execute(
        `SELECT novel_id 
         FROM novel_editor_contract 
         WHERE editor_admin_id = ? 
           AND status = 'active' 
           AND start_date <= NOW()
           AND (end_date IS NULL OR end_date >= NOW())
           AND novel_id IN (${placeholders})`,
        [adminId, ...novelIds]
      );
      contractMap = Object.fromEntries(contracts.map(c => [c.novel_id, true]));
    }

    // 为每本小说添加 can_review 字段
    const result = processedNovels.map(novel => {
      let can_review = false;
      if (role === 'editor' || role === 'chief_editor') {
        // 能看到就说明有合同（已通过 getNovelPermissionFilter 过滤）
        can_review = true;
      } else if (role === 'super_admin') {
        can_review = !!contractMap[novel.id];
      }
      return {
        ...novel,
        can_review
      };
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('获取待审批小说列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取列表失败',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});
```

**路由2: 按状态筛选** (`GET /admin/novels`)
```466:580:backend/routes/admin.js
router.get('/novels', authenticateAdmin, async (req, res) => {
  let db;
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    db = await mysql.createConnection(dbConfig);
    
    // 应用权限过滤
    const permissionFilter = await getNovelPermissionFilter(
      db, 
      req.admin.adminId, 
      req.admin.role
    );
    
    // 确保参数类型正确
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offsetNum = (pageNum - 1) * limitNum;
    
    let query = `SELECT 
                   n.*, 
                   MAX(u.username) as author_name, 
                   MAX(u.pen_name) as pen_name,
                   GROUP_CONCAT(DISTINCT g.chinese_name ORDER BY g.id SEPARATOR ',') as genre_names,
                   GROUP_CONCAT(DISTINCT p.name ORDER BY p.created_at SEPARATOR ',') as protagonist_names
                 FROM novel n
                 LEFT JOIN user u ON (n.author = u.pen_name OR n.author = u.username)
                 LEFT JOIN novel_genre_relation ngr ON n.id = ngr.novel_id
                 LEFT JOIN genre g ON (ngr.genre_id_1 = g.id OR ngr.genre_id_2 = g.id)
                 LEFT JOIN protagonist p ON n.id = p.novel_id`;
    const params = [];
    
    if (status) {
      query += ' WHERE n.review_status = ?';
      params.push(status);
    } else {
      query += ' WHERE 1=1';
    }
    
    // 添加权限过滤条件
    query += ` ${permissionFilter.where}`;
    params.push(...permissionFilter.params);
    
    // LIMIT 和 OFFSET 需要直接插入数值，不能使用占位符
    query += ` GROUP BY n.id ORDER BY n.id DESC LIMIT ${limitNum} OFFSET ${offsetNum}`;
    
    const [novels] = await db.execute(query, params);
    
    // 处理标签和主角数据
    const processedNovels = novels.map(novel => {
      const genres = novel.genre_names ? novel.genre_names.split(',').filter(g => g && g !== 'null') : [];
      const protagonists = novel.protagonist_names ? novel.protagonist_names.split(',').filter(p => p) : [];
      
      return {
        ...novel,
        genres: genres,
        protagonists: protagonists
      };
    });
    
    // 获取总数（需要应用相同的权限过滤）
    let countQuery = 'SELECT COUNT(*) as total FROM novel n';
    const countParams = [];
    if (status) {
      countQuery += ' WHERE n.review_status = ?';
      countParams.push(status);
    } else {
      countQuery += ' WHERE 1=1';
    }
    countQuery += ` ${permissionFilter.where}`;
    countParams.push(...permissionFilter.params);
    const [countResult] = await db.execute(countQuery, countParams);
    const total = countResult[0].total;

    // 计算 can_review 字段：小说审批权限基于 novel_editor_contract，有效合同才能审核
    const { adminId, role } = req.admin;
    let novelIds = processedNovels.map(n => n.id);
    let contractMap = {};

    // super_admin 需要查询是否有合同
    if (role === 'super_admin' && novelIds.length > 0) {
      const placeholders = novelIds.map(() => '?').join(',');
      const [contracts] = await db.execute(
        `SELECT novel_id 
         FROM novel_editor_contract 
         WHERE editor_admin_id = ? 
           AND status = 'active' 
           AND start_date <= NOW()
           AND (end_date IS NULL OR end_date >= NOW())
           AND novel_id IN (${placeholders})`,
        [adminId, ...novelIds]
      );
      contractMap = Object.fromEntries(contracts.map(c => [c.novel_id, true]));
    }

    // 为每本小说添加 can_review 字段
    const result = processedNovels.map(novel => {
      let can_review = false;
      if (role === 'editor' || role === 'chief_editor') {
        // 能看到就说明有合同（已通过 getNovelPermissionFilter 过滤）
        can_review = true;
      } else if (role === 'super_admin') {
        can_review = !!contractMap[novel.id];
      }
      return {
        ...novel,
        can_review
      };
    });

    res.json({
      success: true,
      data: result,
      total: total
    });
```

---

### 4.2 SQL 查询结构分析

#### 4.2.1 `/admin/pending-novels` 的 SQL

**基础查询**:
```sql
SELECT 
  n.*, 
  MAX(u.username) as author_name, 
  MAX(u.pen_name) as pen_name,
  GROUP_CONCAT(DISTINCT g.chinese_name ORDER BY g.id SEPARATOR ',') as genre_names,
  GROUP_CONCAT(DISTINCT p.name ORDER BY p.created_at SEPARATOR ',') as protagonist_names
FROM novel n
LEFT JOIN user u ON (n.author = u.pen_name OR n.author = u.username)
LEFT JOIN novel_genre_relation ngr ON n.id = ngr.novel_id
LEFT JOIN genre g ON (ngr.genre_id_1 = g.id OR ngr.genre_id_2 = g.id)
LEFT JOIN protagonist p ON n.id = p.novel_id
WHERE n.review_status IN ('created', 'submitted', 'reviewing') {permissionFilter.where}
GROUP BY n.id
ORDER BY n.id DESC
```

**WHERE 条件**:
- 固定条件: `n.review_status IN ('created', 'submitted', 'reviewing')`
- 动态条件: `{permissionFilter.where}`（由 `getNovelPermissionFilter` 生成）

**JOIN 表**:
- `user` (LEFT JOIN) - 获取作者信息
- `novel_genre_relation` (LEFT JOIN) - 关联标签
- `genre` (LEFT JOIN) - 标签详情
- `protagonist` (LEFT JOIN) - 主角信息

**排序**: `ORDER BY n.id DESC`（按 ID 降序）

**分页**: **无分页**（返回所有匹配记录）

---

#### 4.2.2 `/admin/novels` 的 SQL

**基础查询**:
```sql
SELECT 
  n.*, 
  MAX(u.username) as author_name, 
  MAX(u.pen_name) as pen_name,
  GROUP_CONCAT(DISTINCT g.chinese_name ORDER BY g.id SEPARATOR ',') as genre_names,
  GROUP_CONCAT(DISTINCT p.name ORDER BY p.created_at SEPARATOR ',') as protagonist_names
FROM novel n
LEFT JOIN user u ON (n.author = u.pen_name OR n.author = u.username)
LEFT JOIN novel_genre_relation ngr ON n.id = ngr.novel_id
LEFT JOIN genre g ON (ngr.genre_id_1 = g.id OR ngr.genre_id_2 = g.id)
LEFT JOIN protagonist p ON n.id = p.novel_id
WHERE {status条件} {permissionFilter.where}
GROUP BY n.id
ORDER BY n.id DESC
LIMIT {limitNum} OFFSET {offsetNum}
```

**WHERE 条件**:
- 动态条件1: `n.review_status = ?`（如果 `status` query 参数存在）
- 动态条件2: `{permissionFilter.where}`（权限过滤）

**分页参数**:
- `page`: 默认 `1`
- `limit`: 默认 `20`
- `offset = (page - 1) * limit`

**排序**: `ORDER BY n.id DESC`

**总数查询**: 单独执行 `COUNT(*)` 查询（应用相同的 WHERE 条件）

---

### 4.3 数据库字段映射

**审批状态字段**: `novel.review_status`

**状态值映射**:

| 前端 Tab | 前端 `filterStatus` | 后端 SQL WHERE 条件 | 数据库值 |
|---------|-------------------|-------------------|---------|
| 全部待审批 | `'all'` | `review_status IN ('created', 'submitted', 'reviewing')` | `'created'`, `'submitted'`, `'reviewing'` |
| 已提交 | `'submitted'` | `review_status = 'submitted'` | `'submitted'` |
| 审核中 | `'reviewing'` | `review_status = 'reviewing'` | `'reviewing'` |
| 已批准 | `'approved'` | `review_status = 'approved'` | `'approved'` |
| 已拒绝 | `'rejected'` | `review_status = 'rejected'` | `'rejected'`（实际存储为 `'locked'`） |

**注意**: 
- "已拒绝" 状态在审批操作时实际设置为 `'locked'`（见 `backend/routes/admin.js:375`）
- 但前端 tab 使用 `'rejected'` 作为查询参数，后端可能未正确处理此映射

**其他状态值**（前端状态映射函数）:
```311:323:frontend/src/pages/AdminPanel/NovelReview/index.tsx
  // 获取状态的中文显示名称
  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      'created': '草稿',
      'submitted': '已提交',
      'reviewing': '审核中',
      'approved': '已批准',
      'published': '已上架',
      'unlisted': '已下架',
      'archived': '已归档',
      'locked': '已锁定'
    };
    return statusMap[status] || status;
  };
```

---

## C5. 后端：鉴权与 admin.role 的获取链路

### 5.1 鉴权中间件

**文件路径**: `backend/routes/admin.js`

**中间件定义**: `authenticateAdmin`
```52:91:backend/routes/admin.js
const authenticateAdmin = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ success: false, message: '请先登录' });
  }

  try {
    const decoded = jwt.verify(token, 'admin-secret-key');
    
    // 从数据库获取最新的admin信息（包括role、status）
    const db = await mysql.createConnection(dbConfig);
    const [admins] = await db.execute(
      'SELECT id, name, level, role, status FROM admin WHERE id = ?',
      [decoded.adminId]
    );
    await db.end();
    
    if (admins.length === 0) {
      return res.status(403).json({ success: false, message: '管理员不存在' });
    }
    
    const admin = admins[0];
    
    // 检查账号状态
    if (admin.status === 0) {
      return res.status(403).json({ success: false, message: '账号已被禁用' });
    }
    
    req.admin = {
      ...decoded,
      role: admin.role || 'editor',
      status: admin.status
    };
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Token无效或已过期' });
  }
};
```

**鉴权流程**:
1. 从 `Authorization` 请求头提取 Bearer token
2. 使用 `jwt.verify(token, 'admin-secret-key')` 解码 token，获取 `adminId`
3. **关键**: 从数据库 `admin` 表查询最新信息（包括 `role`）
4. 检查账号状态（`status !== 0`）
5. 将 `adminId`、`role`、`status` 挂载到 `req.admin` 对象

**结论**: 
- `role` **不是从 token 中读取**，而是**每次请求时从数据库查询**
- 这确保了 role 变更后立即生效（无需重新登录）
- `req.admin.role` 可能的值: `'super_admin'`, `'editor'`, `'chief_editor'` 等

---

### 5.2 role 在权限过滤中的使用

**调用位置**: `backend/routes/admin.js:231-235` 和 `backend/routes/admin.js:474-478`

```231:235:backend/routes/admin.js
    const permissionFilter = await getNovelPermissionFilter(
      db, 
      req.admin.adminId, 
      req.admin.role
    );
```

**权限过滤函数**: `backend/middleware/permissionMiddleware.js:getNovelPermissionFilter`
```13:62:backend/middleware/permissionMiddleware.js
async function getNovelPermissionFilter(db, adminId, role) {
  // super_admin：可以看到全部小说，不受合同限制
  // 对于 admin.role = 'super_admin' 的用户，显示所有小说
  if (role === 'super_admin') {
    return { where: '', params: [] };
  }
  
  // editor：只能看到自己在 novel_editor_contract 中拥有"有效合同"的小说
  // 有效合同定义：
  // - status = 'active'
  // - start_date <= NOW() （开始日期在当前时间之前或等于）
  // - (end_date IS NULL OR end_date >= NOW()) （结束日期为空或大于等于当前时间）
  // - editor_admin_id 匹配当前管理员ID
  if (role === 'editor') {
    return {
      where: `AND EXISTS (
        SELECT 1 FROM novel_editor_contract nec
        WHERE nec.novel_id = n.id
          AND nec.editor_admin_id = ?
          AND nec.role = 'editor'
          AND nec.status = 'active'
          AND nec.start_date <= NOW()
          AND (nec.end_date IS NULL OR nec.end_date >= NOW())
      )`,
      params: [adminId]
    };
  }
  
  // chief_editor：只能看到自己在 novel_editor_contract 中拥有"有效合同"的小说
  if (role === 'chief_editor') {
    return {
      where: `AND EXISTS (
        SELECT 1 FROM novel_editor_contract nec
        WHERE nec.novel_id = n.id
          AND nec.editor_admin_id = ?
          AND nec.role = 'chief_editor'
          AND nec.status = 'active'
          AND nec.start_date <= NOW()
          AND (nec.end_date IS NULL OR nec.end_date >= NOW())
      )`,
      params: [adminId]
    };
  }
  
  // 其他角色：无权限
  return {
    where: 'AND 1 = 0', // 永远不匹配
    params: []
  };
}
```

**权限过滤逻辑总结**:

| role | `permissionFilter.where` | `permissionFilter.params` | 说明 |
|------|-------------------------|--------------------------|------|
| `'super_admin'` | `''` (空字符串) | `[]` | 无额外过滤条件，显示所有小说 |
| `'editor'` | `AND EXISTS (SELECT 1 FROM novel_editor_contract ...)` | `[adminId]` | 只显示该编辑有有效合同的小说 |
| `'chief_editor'` | `AND EXISTS (SELECT 1 FROM novel_editor_contract ...)` | `[adminId]` | 只显示该主编有有效合同的小说 |
| 其他 | `'AND 1 = 0'` | `[]` | 永远不匹配，无权限 |

**有效合同条件**（对 editor/chief_editor）:
- `nec.novel_id = n.id` - 合同关联到当前小说
- `nec.editor_admin_id = ?` - 合同属于当前管理员
- `nec.role = 'editor'` 或 `'chief_editor'` - 角色匹配
- `nec.status = 'active'` - 合同状态为活跃
- `nec.start_date <= NOW()` - 开始日期已到
- `(nec.end_date IS NULL OR nec.end_date >= NOW())` - 结束日期未到或为空

---

## C6. 合同表 novel_editor_contract 在现有代码中的使用现状

### 6.1 全仓搜索结果

**搜索命令**: `rg -n "novel_editor_contract|editor_admin_id|chief_editor|contract" backend`

**关键命中点**:

#### 6.1.1 权限中间件中的使用

**文件**: `backend/middleware/permissionMiddleware.js`

**使用位置1**: `getNovelPermissionFilter` 函数（已在上文 C5.2 详述）

**使用位置2**: `checkNovelPermission` 函数
```73:120:backend/middleware/permissionMiddleware.js
async function checkNovelPermission(db, adminId, role, novelId) {
  // 新增：super_admin 直接放行
  if (role === 'super_admin') {
    return true;
  }
  
  // 先检查小说是否存在
  const [novels] = await db.execute(
    'SELECT id FROM novel WHERE id = ?',
    [novelId]
  );
  
  if (novels.length === 0) {
    return false; // 小说不存在
  }
  
  // 现在章节审核权限完全基于 novel_editor_contract，editor 和 chief_editor 必须有有效合同
  // 有效合同定义：
  // - status = 'active'
  // - start_date <= NOW()
  // - (end_date IS NULL OR end_date >= NOW())
  // - role 匹配：editor 对应 'editor'，chief_editor 对应 'chief_editor'
  let roleFilter;
  if (role === 'editor') {
    roleFilter = ['editor'];
  } else if (role === 'chief_editor') {
    roleFilter = ['chief_editor'];
  } else {
    return false; // 其他角色无权限
  }
  
  // 构建 role 过滤条件
  const roleCondition = 'nec.role = ?';
  const queryParams = [novelId, adminId, roleFilter[0]];
  
  const [contracts] = await db.execute(
    `SELECT 1 FROM novel_editor_contract nec
     WHERE nec.novel_id = ?
       AND nec.editor_admin_id = ?
       AND nec.status = 'active'
       AND nec.start_date <= NOW()
       AND (nec.end_date IS NULL OR nec.end_date >= NOW())
       AND ${roleCondition}`,
    queryParams
  );
  
  return contracts.length > 0;
}
```

**使用位置3**: `hasActiveContract` 函数
```130:143:backend/middleware/permissionMiddleware.js
async function hasActiveContract(db, novelId, adminId, role) {
  const [contracts] = await db.execute(
    `SELECT 1 FROM novel_editor_contract nec
     WHERE nec.novel_id = ?
       AND nec.editor_admin_id = ?
       AND nec.role = ?
       AND nec.status = 'active'
       AND nec.start_date <= NOW()
       AND (nec.end_date IS NULL OR nec.end_date >= NOW())
     LIMIT 1`,
    [novelId, adminId, role]
  );
  return contracts.length > 0;
}
```

**使用位置4**: `checkRequiresChiefEdit` 函数
```151:170:backend/middleware/permissionMiddleware.js
async function checkRequiresChiefEdit(db, novel) {
  if (!novel.chief_editor_admin_id) {
    return false;
  }
  
  // 检查主编是否有有效合同
  const [contracts] = await db.execute(
    `SELECT 1 FROM novel_editor_contract nec
     WHERE nec.novel_id = ?
       AND nec.editor_admin_id = ?
       AND nec.role = 'chief_editor'
       AND nec.status = 'active'
       AND nec.start_date <= NOW()
       AND (nec.end_date IS NULL OR nec.end_date >= NOW())
     LIMIT 1`,
    [novel.id, novel.chief_editor_admin_id]
  );
  
  return contracts.length > 0;
}
```

---

#### 6.1.2 审批列表 API 中的使用

**文件**: `backend/routes/admin.js`

**使用位置1**: `/admin/pending-novels` - 计算 `can_review` 字段
```273:286:backend/routes/admin.js
    // super_admin 需要查询是否有合同
    if (role === 'super_admin' && novelIds.length > 0) {
      const placeholders = novelIds.map(() => '?').join(',');
      const [contracts] = await db.execute(
        `SELECT novel_id 
         FROM novel_editor_contract 
         WHERE editor_admin_id = ? 
           AND status = 'active' 
           AND start_date <= NOW()
           AND (end_date IS NULL OR end_date >= NOW())
           AND novel_id IN (${placeholders})`,
        [adminId, ...novelIds]
      );
      contractMap = Object.fromEntries(contracts.map(c => [c.novel_id, true]));
    }
```

**使用位置2**: `/admin/novels` - 计算 `can_review` 字段（同上逻辑）

**结论**: 
- `novel_editor_contract` 表**已经在审批列表查询中被使用**
- 通过 `getNovelPermissionFilter` 生成的 EXISTS 子查询进行过滤
- 对于 `editor` 和 `chief_editor`，**已经实现了只看自己负责小说的逻辑**

---

### 6.2 合同表结构推测

**基于代码推断的字段**:
- `id` - 主键
- `novel_id` - 小说ID（外键到 `novel.id`）
- `editor_admin_id` - 编辑管理员ID（外键到 `admin.id`）
- `role` - 角色（`'editor'` 或 `'chief_editor'`）
- `status` - 状态（`'active'` 表示有效）
- `start_date` - 开始日期（DATETIME 或 DATE）
- `end_date` - 结束日期（DATETIME 或 DATE，可为 NULL）

**有效合同判断条件**（已在多处代码中确认）:
```sql
status = 'active'
AND start_date <= NOW()
AND (end_date IS NULL OR end_date >= NOW())
```

---

## C7. "如果要实现 editor 只看自己负责小说"，最可能的插入点（只指出位置，不实现）

### 7.1 现状总结

**结论**: **该功能已经实现**

**证据**:
1. `backend/middleware/permissionMiddleware.js:getNovelPermissionFilter` 函数已经根据 `role` 生成过滤条件
2. `backend/routes/admin.js:/admin/pending-novels` 和 `/admin/novels` 都已经调用 `getNovelPermissionFilter`
3. 对于 `role === 'editor'`，生成的 WHERE 条件包含 `EXISTS (SELECT 1 FROM novel_editor_contract ...)`
4. 该 EXISTS 子查询确保只返回该编辑有有效合同的小说

---

### 7.2 如果未实现，应该插入的位置

**假设场景**: 如果当前代码**没有**实现该功能，应该在哪里添加？

#### 7.2.1 方案A: 在 SQL WHERE 条件中添加 JOIN

**插入位置**: `backend/routes/admin.js:238-254`（`/admin/pending-novels`）和 `backend/routes/admin.js:485-510`（`/admin/novels`）

**修改方式**:
```sql
-- 当前 SQL
FROM novel n
LEFT JOIN user u ON ...
WHERE n.review_status IN (...) ${permissionFilter.where}

-- 应该改为（如果未实现）
FROM novel n
LEFT JOIN user u ON ...
INNER JOIN novel_editor_contract nec ON nec.novel_id = n.id
  AND nec.editor_admin_id = ?
  AND nec.role = 'editor'
  AND nec.status = 'active'
  AND nec.start_date <= NOW()
  AND (nec.end_date IS NULL OR nec.end_date >= NOW())
WHERE n.review_status IN (...)
```

**缺点**: 
- 需要修改两个 API handler
- 代码重复
- 不符合当前架构（权限过滤已抽象到中间件）

---

#### 7.2.2 方案B: 在权限过滤中间件中添加（推荐，已实现）

**插入位置**: `backend/middleware/permissionMiddleware.js:getNovelPermissionFilter`

**当前实现**: 已在 `role === 'editor'` 分支返回 EXISTS 子查询

**如果未实现，应该这样添加**:
```javascript
if (role === 'editor') {
  return {
    where: `AND EXISTS (
      SELECT 1 FROM novel_editor_contract nec
      WHERE nec.novel_id = n.id
        AND nec.editor_admin_id = ?
        AND nec.role = 'editor'
        AND nec.status = 'active'
        AND nec.start_date <= NOW()
        AND (nec.end_date IS NULL OR nec.end_date >= NOW())
    )`,
    params: [adminId]
  };
}
```

**优点**:
- 集中管理权限逻辑
- 所有使用 `getNovelPermissionFilter` 的 API 自动生效
- 代码复用

---

#### 7.2.3 方案C: 在 Service 层封装（如果存在）

**当前架构**: 审批列表 API 直接使用 SQL，未封装到 Service 层

**如果存在 Service 层**（例如 `NovelApprovalService`），应该在 Service 方法中添加过滤逻辑。

**实际**: `backend/services/novelContractApprovalService.js` 存在，但用于合同审批，不用于小说审批列表。

---

### 7.3 实现位置总结

**当前实现位置**: `backend/middleware/permissionMiddleware.js:getNovelPermissionFilter`

**调用位置**:
1. `backend/routes/admin.js:231` - `/admin/pending-novels`
2. `backend/routes/admin.js:474` - `/admin/novels`

**结论**: 
- ✅ **功能已实现**
- ✅ **实现位置合理**（中间件层）
- ✅ **代码复用良好**（两个 API 共享同一过滤逻辑）

---

## C8. 关键待确认点（仅列出事实性不确定项，如字段名/状态值不明）

### 8.1 数据库表结构

**待确认项**:
1. `novel_editor_contract` 表的完整字段定义（需要查看 migration 文件或数据库 schema）
2. `novel.review_status` 字段的所有可能值（当前代码中出现的值: `'created'`, `'submitted'`, `'reviewing'`, `'approved'`, `'published'`, `'unlisted'`, `'archived'`, `'locked'`）
3. `admin.role` 字段的所有可能值（当前代码中出现的值: `'super_admin'`, `'editor'`, `'chief_editor'`，是否还有其他角色？）

**建议**: 查看数据库 migration 文件或直接查询数据库 schema

---

### 8.2 状态值映射不一致

**问题**: "已拒绝" tab 的状态值映射

**前端**: `filterStatus === 'rejected'` → 请求 `/admin/novels?status=rejected`

**后端审批操作**: `backend/routes/admin.js:375`
```375:375:backend/routes/admin.js
    const status = action === 'approve' ? 'approved' : 'locked';
```

**结论**: 
- 审批拒绝时，数据库存储为 `'locked'`
- 但前端 tab 查询时使用 `status=rejected`
- **可能的问题**: 查询 `status=rejected` 可能返回空结果（如果数据库中没有 `review_status='rejected'` 的记录）

**待确认**: 
- 数据库中是否存在 `review_status='rejected'` 的记录？
- 或者前端应该查询 `status=locked`？

---

### 8.3 分页实现不一致

**问题**: `/admin/pending-novels` 无分页，`/admin/novels` 有分页

**现状**:
- `/admin/pending-novels`: 返回所有匹配记录（无 LIMIT/OFFSET）
- `/admin/novels`: 支持 `page` 和 `limit` 参数，默认每页 20 条

**影响**: 
- "全部待审批" tab 如果数据量大，可能返回大量记录，影响性能
- 前端未实现分页 UI（需要确认）

**待确认**: 
- 是否需要为 `/admin/pending-novels` 添加分页？
- 前端是否需要显示分页控件？

---

### 8.4 can_review 字段的计算逻辑

**当前逻辑**: `backend/routes/admin.js:289-301` 和 `backend/routes/admin.js:562-574`

**问题**: 
- `super_admin` 的 `can_review` 基于是否有合同（`!!contractMap[novel.id]`）
- `editor`/`chief_editor` 的 `can_review` 固定为 `true`（因为已通过权限过滤）

**待确认**: 
- `super_admin` 如果没有合同，是否应该允许审核？当前逻辑是不允许（`can_review = false`）
- 这个逻辑是否符合业务需求？

---

### 8.5 前端状态显示映射

**问题**: 前端显示状态时，`'rejected'` 和 `'locked'` 的映射关系

**前端状态映射**: `frontend/src/pages/AdminPanel/NovelReview/index.tsx:403-407`
```403:407:frontend/src/pages/AdminPanel/NovelReview/index.tsx
                          {novel.review_status === 'submitted' ? '已提交' :
                           novel.review_status === 'reviewing' ? '审核中' :
                           novel.review_status === 'approved' ? '已批准' :
                           novel.review_status === 'rejected' ? '已拒绝' : novel.review_status}
```

**待确认**: 
- 如果数据库返回 `review_status='locked'`，前端会显示为 `'locked'`（未映射）
- 是否需要将 `'locked'` 映射为 `'已拒绝'`？

---

## 附录：检索命令与结果摘要

### A. 全仓搜索命令执行记录

**命令1**: `rg -n "小说审批|novel approval|approval" frontend backend`
- **结果**: 109 个匹配
- **关键文件**: `frontend/src/pages/AdminPanel/NovelReview/index.tsx`, `backend/routes/admin.js`

**命令2**: `rg -n "admin" frontend/backend`（尤其 role、super_admin、editor）
- **结果**: 190+ 个匹配
- **关键文件**: `backend/routes/admin.js:52-91` (authenticateAdmin), `backend/middleware/permissionMiddleware.js`

**命令3**: `rg -n "novel_editor_contract|editor_admin_id|chief_editor|contract" backend`
- **结果**: 29 个匹配
- **关键文件**: `backend/middleware/permissionMiddleware.js`, `backend/routes/admin.js`

**命令4**: `rg -n "/admin" frontend`
- **结果**: 多个 API 调用点
- **关键文件**: `frontend/src/pages/AdminPanel/NovelReview/index.tsx:114-116`

**命令5**: `rg -n "approve|reject|审核|已批准|已拒绝" frontend backend`
- **结果**: 18 个匹配（review_status 相关）
- **关键文件**: `backend/routes/admin.js:375` (审批操作), `frontend/src/pages/AdminPanel/NovelReview/index.tsx:403-407` (状态显示)

---

### B. 关键代码文件清单

| 文件路径 | 行数范围 | 功能 |
|---------|---------|------|
| `frontend/src/App.tsx` | 65 | 路由定义 |
| `frontend/src/pages/AdminPanel.tsx` | 1746-1749 | 组件渲染 |
| `frontend/src/pages/AdminPanel/NovelReview/index.tsx` | 110-140 | 列表请求函数 |
| `frontend/src/pages/AdminPanel/NovelReview/index.tsx` | 330-361 | Tab 按钮定义 |
| `backend/routes/admin.js` | 52-91 | 鉴权中间件 |
| `backend/routes/admin.js` | 223-319 | `/admin/pending-novels` API |
| `backend/routes/admin.js` | 466-580 | `/admin/novels` API |
| `backend/middleware/permissionMiddleware.js` | 13-62 | 权限过滤函数 |

---

**报告结束**

