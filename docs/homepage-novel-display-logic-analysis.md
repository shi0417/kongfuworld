# 首页小说展示逻辑分析报告

**生成时间**：2025-12-01  
**分析目标**：梳理首页上"Popular This Week"、"New Releases"、"Top Series"等区块的小说筛选逻辑，明确与 `novel.review_status` 字段的关系，为后续实现"只有 `review_status = 'published'` 的小说才在首页展示"做准备

---

## 一、首页小说展示入口总览

### 1.1 首页页面组件

**主页面文件**：
- `frontend/src/pages/Home.tsx` - 首页组件（主要使用）
- `frontend/src/pages/HomeDynamic.tsx` - 动态首页组件（备用）

**展示区块**：
1. **Banner 轮播图**（`BannerCarousel` 组件）
2. **Popular This Week**（本周热门，`NovelListSection` 组件）
3. **New Releases**（最新发布，`NovelListSection` 组件）
4. **Top Series**（高分系列，`NovelListSection` 组件）

### 1.2 前端数据获取

**服务文件**：`frontend/src/services/homepageService.ts`

**主要方法**：
- `getAllHomepageData()` - 组合接口，一次性获取所有首页数据
  - 内部调用：
    - `getBanners()` → `GET /api/homepage/banners`
    - `getPopularThisWeek()` → `GET /api/homepage/popular-this-week`
    - `getNewReleases()` → `GET /api/homepage/new-releases`
    - `getTopSeries()` → `GET /api/homepage/top-series`
    - `getHomepageConfig()` → `GET /api/homepage/config`

**前端组件调用链**：
```
Home.tsx / HomeDynamic.tsx
  └─> homepageService.getAllHomepageData()
      └─> 并行调用 5 个 API 接口
```

---

## 二、各模块的后端查询条件明细

### 2.1 Banner 轮播图

**接口路径**：`GET /api/homepage/banners`  
**路由位置**：`backend/server.js:1770-1791`

**SQL 查询**：
```sql
SELECT 
  hb.id, hb.title, hb.subtitle, hb.image_url, hb.link_url,
  n.id as novel_id, n.title as novel_title
FROM homepage_banners hb
LEFT JOIN novel n ON hb.novel_id = n.id
WHERE hb.is_active = 1 
  AND (hb.start_date IS NULL OR hb.start_date <= NOW())
  AND (hb.end_date IS NULL OR hb.end_date >= NOW())
ORDER BY hb.display_order ASC
```

**关键发现**：
- ❌ **没有过滤 `novel.review_status`**
- ❌ **没有过滤 `novel.status`**
- 只检查 `homepage_banners` 表的 `is_active` 和时间范围
- 如果 `hb.novel_id` 关联的小说不存在或状态不符合要求，仍会返回 banner（`novel_id` 和 `novel_title` 为 NULL）

---

### 2.2 Popular This Week（本周热门）

**接口路径**：`GET /api/homepage/popular-this-week`  
**路由位置**：`backend/server.js:1794-1819`

**SQL 查询**：
```sql
SELECT 
  n.id, n.title, n.author, n.cover, n.rating, n.reviews, n.status,
  COALESCE(SUM(ns.views), 0) as weekly_views,
  COALESCE(SUM(ns.reads), 0) as weekly_reads
FROM novel n
LEFT JOIN novel_statistics ns ON n.id = ns.novel_id 
  AND ns.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
GROUP BY n.id
HAVING weekly_views > 0
ORDER BY weekly_views DESC, weekly_reads DESC
LIMIT ?
```

**关键发现**：
- ❌ **没有 WHERE 条件过滤 `novel.review_status`**
- ❌ **没有 WHERE 条件过滤 `novel.status`**
- 只通过 `HAVING weekly_views > 0` 过滤（必须有本周访问量）
- 排序：按本周访问量（`weekly_views`）降序，然后按本周阅读量（`weekly_reads`）降序

---

### 2.3 New Releases（最新发布）

**接口路径**：`GET /api/homepage/new-releases`  
**路由位置**：`backend/server.js:1822-1845`

**SQL 查询**：
```sql
SELECT 
  n.id, n.title, n.author, n.cover, n.rating, n.reviews, n.status,
  MAX(c.created_at) as latest_chapter_date
FROM novel n
LEFT JOIN chapter c ON n.id = c.novel_id
WHERE n.status = 'Ongoing'
GROUP BY n.id
ORDER BY latest_chapter_date DESC, n.id DESC
LIMIT ?
```

**关键发现**：
- ❌ **没有过滤 `novel.review_status`**
- ✅ **有过滤 `n.status = 'Ongoing'`**（只显示进行中的小说）
- 排序：按最新章节创建时间（`latest_chapter_date`）降序，然后按小说ID降序

---

### 2.4 Top Series（高分系列）

**接口路径**：`GET /api/homepage/top-series`  
**路由位置**：`backend/server.js:1848-1869`

**SQL 查询**：
```sql
SELECT 
  n.id, n.title, n.author, n.cover, n.rating, n.reviews, n.status,
  n.chapters
FROM novel n
WHERE n.rating > 0 AND n.reviews > 0
ORDER BY n.rating DESC, n.reviews DESC
LIMIT ?
```

**关键发现**：
- ❌ **没有过滤 `novel.review_status`**
- ❌ **没有过滤 `novel.status`**
- 只要求 `n.rating > 0 AND n.reviews > 0`（必须有评分和评论）
- 排序：按评分（`rating`）降序，然后按评论数（`reviews`）降序

---

### 2.5 Featured Novels（推荐小说，可选）

**接口路径**：`GET /api/homepage/featured-novels/:section`  
**路由位置**：`backend/server.js:1741-1767`

**说明**：此接口用于获取首页推荐小说（通过 `homepage_featured_novels` 表配置），但当前首页组件（`Home.tsx`）**未使用此接口**。

**SQL 查询**：
```sql
SELECT 
  n.id, n.title, n.author, n.cover, n.rating, n.reviews, n.status,
  hfn.display_order, hfn.section_type
FROM homepage_featured_novels hfn
JOIN novel n ON hfn.novel_id = n.id
WHERE hfn.section_type = ? 
  AND hfn.is_active = 1 
  AND (hfn.start_date IS NULL OR hfn.start_date <= NOW())
  AND (hfn.end_date IS NULL OR hfn.end_date >= NOW())
ORDER BY hfn.display_order ASC, n.rating DESC
LIMIT ?
```

**关键发现**：
- ❌ **没有过滤 `novel.review_status`**
- ❌ **没有过滤 `novel.status`**
- 只检查 `homepage_featured_novels` 表的配置

---

### 2.6 组合接口（All Homepage Data）

**接口路径**：`GET /api/homepage/all`  
**路由位置**：`backend/server.js:1937-2035`

**说明**：此接口并行调用上述所有接口，返回组合数据。前端 `homepageService.getAllHomepageData()` 实际使用的是**独立的 4 个接口**，而不是这个组合接口。

**内部查询**：
- Banner：同 2.1
- Popular This Week：同 2.2（第 1959-1976 行）
- New Releases：同 2.3（第 1977-1992 行）
- Top Series：同 2.4（第 1993-2006 行）

---

## 三、当前"上架条件"的实际实现情况

### 3.1 novel 表字段定义

**表结构**（基于 `backend/database_schema.sql:76-97`）：

```sql
CREATE TABLE `novel` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `status` varchar(50) DEFAULT NULL,  -- ⚠️ 状态字段（可能是 'Ongoing', 'Completed' 等）
  `cover` varchar(255) DEFAULT NULL,
  `rating` int DEFAULT '0',
  `reviews` int DEFAULT '0',
  `author` varchar(100) DEFAULT NULL,
  `translator` varchar(100) DEFAULT NULL,
  `description` text,
  `recommendation` text,
  `languages` varchar(255) DEFAULT NULL,
  `chapters` int DEFAULT '0',
  `licensed_from` varchar(100) DEFAULT NULL,
  `review_status` enum('created','submitted','reviewing','approved','published','unlisted','archived','locked') DEFAULT 'created',  -- ⭐ 审核状态字段
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `champion_status` enum('submitted','invalid','approved','rejected') NOT NULL DEFAULT 'invalid',  -- Champion 状态字段
  PRIMARY KEY (`id`),
  KEY `idx_review_status` (`review_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**字段说明**：
- `review_status`：审核状态枚举
  - `'created'` - 草稿/已创建
  - `'submitted'` - 已提交
  - `'reviewing'` - 审核中
  - `'approved'` - 审核通过
  - `'published'` - **已上架**（目标状态）
  - `'unlisted'` - 已下架
  - `'archived'` - 已归档
  - `'locked'` - 已锁定/违规锁定
- `status`：小说状态（可能是 `'Ongoing'`、`'Completed'` 等，类型为 `varchar(50)`）
- `champion_status`：Champion 订阅状态（与首页展示无关）

### 3.2 当前首页查询的实际过滤条件

**总结**：**所有首页接口都没有使用 `review_status` 字段进行过滤**。

| 接口 | 当前过滤条件 | 是否使用 `review_status` | 是否使用 `status` |
|------|------------|------------------------|------------------|
| **Banner** | 无（只检查 banner 配置） | ❌ 否 | ❌ 否 |
| **Popular This Week** | `HAVING weekly_views > 0` | ❌ 否 | ❌ 否 |
| **New Releases** | `WHERE n.status = 'Ongoing'` | ❌ 否 | ✅ 是（只显示进行中的） |
| **Top Series** | `WHERE n.rating > 0 AND n.reviews > 0` | ❌ 否 | ❌ 否 |
| **Featured Novels** | 无（只检查推荐配置） | ❌ 否 | ❌ 否 |

**关键发现**：
1. ❌ **没有任何接口使用 `review_status = 'published'` 过滤**
2. ❌ **没有任何接口使用 `review_status = 'approved'` 过滤**
3. ✅ **只有 "New Releases" 使用了 `status = 'Ongoing'` 过滤**
4. ⚠️ **"Popular This Week" 和 "Top Series" 完全没有状态过滤**，可能展示任何状态的小说（包括 `review_status = 'created'`、`'submitted'`、`'reviewing'` 等）

---

## 四、与期望规则的差距

### 4.1 期望规则

**业务目标**：**只有 `review_status = 'published'` 的小说才在首页展示**

### 4.2 当前实现与期望的差距

| 模块 | 当前实现 | 期望实现 | 差距 |
|------|---------|---------|------|
| **Banner** | 无 `review_status` 过滤 | 需要 `review_status = 'published'` | ❌ 不符合 |
| **Popular This Week** | 无 `review_status` 过滤 | 需要 `review_status = 'published'` | ❌ 不符合 |
| **New Releases** | 只过滤 `status = 'Ongoing'` | 需要 `review_status = 'published'` | ❌ 不符合 |
| **Top Series** | 无 `review_status` 过滤 | 需要 `review_status = 'published'` | ❌ 不符合 |
| **Featured Novels** | 无 `review_status` 过滤 | 需要 `review_status = 'published'` | ❌ 不符合 |

**结论**：
- ❌ **所有首页展示模块都不符合期望规则**
- ❌ **没有任何模块已经使用了 `review_status = 'published'` 过滤**
- ⚠️ **当前可能展示未审核通过、审核中、已下架等状态的小说**

---

## 五、后续改造建议（只列清单，不写具体代码）

### 5.1 需要修改的接口

**必须修改的接口**（共 4 个）：

1. **`GET /api/homepage/popular-this-week`**
   - 位置：`backend/server.js:1794-1819`
   - 建议：在 WHERE 子句中添加 `AND n.review_status = 'published'`

2. **`GET /api/homepage/new-releases`**
   - 位置：`backend/server.js:1822-1845`
   - 建议：在现有 `WHERE n.status = 'Ongoing'` 基础上，添加 `AND n.review_status = 'published'`

3. **`GET /api/homepage/top-series`**
   - 位置：`backend/server.js:1848-1869`
   - 建议：在 WHERE 子句中添加 `AND n.review_status = 'published'`

4. **`GET /api/homepage/banners`**
   - 位置：`backend/server.js:1770-1791`
   - 建议：在 LEFT JOIN 后添加 `WHERE n.review_status = 'published' OR hb.novel_id IS NULL`（允许没有关联小说的 banner 显示）

**可选修改的接口**（当前未使用，但建议一并修改）：

5. **`GET /api/homepage/featured-novels/:section`**
   - 位置：`backend/server.js:1741-1767`
   - 建议：在 WHERE 子句中添加 `AND n.review_status = 'published'`

6. **`GET /api/homepage/all`**（组合接口）
   - 位置：`backend/server.js:1937-2035`
   - 建议：修改内部 3 个 Promise 查询（Popular、New Releases、Top Series），添加 `review_status = 'published'` 条件

### 5.2 统一封装建议

**建议创建统一的"上架条件"封装函数**：

1. **在 `backend/services/` 中创建 `novelDisplayService.js`**：
   - 提供 `getPublishedNovelsFilter()` 函数
   - 返回统一的 WHERE 条件字符串：`n.review_status = 'published'`
   - 便于后续扩展（例如：同时检查 `champion_status`、`status` 等）

2. **在首页相关接口中统一使用**：
   - 所有首页查询都调用此函数获取过滤条件
   - 确保逻辑一致，便于维护

### 5.3 数据迁移建议

**如果现有数据中 `review_status = 'published'` 的小说数量很少**：

1. **检查现有数据**：
   - 统计当前 `review_status` 的分布情况
   - 确认哪些小说应该设置为 `'published'`

2. **数据迁移**：
   - 如果 `review_status = 'approved'` 的小说应该自动变为 `'published'`，需要执行数据迁移
   - 如果需要在审核通过后手动设置，则无需迁移

### 5.4 测试建议

**修改后需要测试的场景**：

1. **验证过滤效果**：
   - 确认只有 `review_status = 'published'` 的小说出现在首页
   - 确认 `review_status` 为其他值的小说不出现

2. **验证排序和分页**：
   - 确认添加过滤条件后，排序逻辑仍然正确
   - 确认分页功能正常

3. **验证性能**：
   - 确认添加 `review_status` 过滤后，查询性能不受影响（已有索引 `idx_review_status`）

---

## 六、其他发现

### 6.1 其他可能使用 novel 表的接口

**`GET /api/novels`**（获取所有小说列表）：
- 位置：`backend/upload_novel.js:958`（通过 `getAllNovelsAPI` 函数）
- **需要检查**：此接口是否也需要添加 `review_status = 'published'` 过滤（取决于业务需求）

### 6.2 Banner 的特殊情况

**Banner 接口的特殊性**：
- Banner 可能关联小说（`hb.novel_id`），也可能不关联（纯图片 banner）
- 建议：只对关联了小说的 banner 进行 `review_status` 检查
- 如果 banner 没有关联小说（`hb.novel_id IS NULL`），应该允许显示

---

## 七、总结

### 7.1 核心发现

1. **首页所有展示模块都没有使用 `review_status` 过滤**
2. **只有 "New Releases" 使用了 `status = 'Ongoing'` 过滤**
3. **没有任何接口已经实现了 `review_status = 'published'` 的过滤逻辑**

### 7.2 需要修改的接口数量

- **必须修改**：4 个接口（Popular This Week、New Releases、Top Series、Banners）
- **建议修改**：2 个接口（Featured Novels、All Homepage Data）

### 7.3 改造优先级

1. **高优先级**：Popular This Week、New Releases、Top Series（用户最常看到的模块）
2. **中优先级**：Banners（需要处理无关联小说的特殊情况）
3. **低优先级**：Featured Novels、All Homepage Data（当前未使用或使用较少）

---

**报告生成完成时间**：2025-12-01  
**下一步行动**：根据此报告，在相关接口的 SQL 查询中添加 `AND n.review_status = 'published'` 条件，确保只有已上架的小说在首页展示。

