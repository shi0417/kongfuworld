# 《章节可见性 & Champion 预读机制 代码现状分析报告》

**生成时间**：2025-12-07  
**分析目标**：摸清「小说章节可见性 & Champion 预读」的所有相关逻辑，为后续实现目标业务规则做准备

---

## 一、前端部分

### 1.1 小说详情页（章节列表 Tabs）

**主组件文件路径**：
- `frontend/src/pages/BookDetail.tsx` - 小说详情页主组件
- `frontend/src/components/ChapterDisplay/ChapterDisplay.tsx` - 章节展示组件

**在 BookDetail 中的使用**：
```tsx
{tab === 'Chapters' && (
  <ChapterDisplay novelId={parseInt(id!)} user={user} />
)}
```

**章节列表数据获取流程**：

1. **卷信息接口**：
   - **接口URL**：`GET /api/novel/:novelId/volumes?sort=newest`
   - **调用位置**：`ChapterDisplay.tsx:44` - `loadVolumes()` 函数
   - **后端路由**：`backend/server.js:4466` - `app.get('/api/novel/:novelId/volumes', ...)`
   - **SQL查询条件**：
     ```sql
     WHERE v.novel_id = ?
     -- JOIN chapter时只过滤: c.review_status = 'approved'
     -- 没有过滤 is_released 和 is_advance
     ```

2. **章节列表接口**：
   - **接口URL**：`GET /api/volume/:volumeId/chapters?sort=chapter_number&limit=1000`
   - **调用位置**：`ChapterDisplay.tsx:74` - `loadVolumeChapters()` 函数
   - **后端路由**：`backend/server.js:4539` - `app.get('/api/volume/:volumeId/chapters', ...)`
   - **SQL查询条件**：
     ```sql
     WHERE v.id = ? AND c.review_status = 'approved'
     -- 只过滤了 review_status，没有过滤 is_released 和 is_advance
     ```

**前端过滤/显示逻辑**：

- **当前状态**：前端**没有**对 `chapter.is_advance`、`chapter.is_released` 做任何过滤或隐藏处理
- **章节标记显示**：
  - `ChapterDisplay.tsx:118-129` 中有 `getChapterStatusIcon()` 和 `getChapterStatusColor()` 函数
  - 根据 `chapter.unlock_price > 0` 显示 🔒（红色）
  - 根据 `chapter.is_advance === 1` 显示 ⚡（紫色）
  - 其他情况显示 📖（绿色）
  - **但这些标记只是视觉提示，不影响章节是否显示在列表中**

- **Champion 相关判断**：
  - **当前状态**：前端**没有**根据 `novel.champion_status` 或当前用户 Champion 会员信息来决定显示哪些章节
  - `ChapterDisplay` 组件接收了 `user` prop，但**没有使用**它来查询用户的 Champion 订阅状态
  - **没有**调用 `/api/champion/status/:novelId` 接口来获取用户 Champion 信息

**关键代码片段（简化流程）**：

```typescript
// ChapterDisplay.tsx 核心逻辑
1. loadVolumes() -> GET /api/novel/:novelId/volumes
   -> 返回所有卷（只过滤 review_status='approved' 的章节统计）
2. toggleVolume(volumeId) -> loadVolumeChapters(volumeId)
   -> GET /api/volume/:volumeId/chapters
   -> 返回该卷下所有 review_status='approved' 的章节
   -> 前端直接显示，不做任何 is_advance / is_released 过滤
3. handleChapterClick(chapter) -> navigate(`/novel/${novelId}/chapter/${chapter.id}`)
   -> 跳转到阅读页
```

---

### 1.2 小说阅读页（ChapterReader：上一章 / 下一章）

**主组件文件路径**：
- `frontend/src/pages/ChapterReader.tsx` - 阅读页主组件

**章节内容获取流程**：

1. **单章节内容接口**：
   - **接口URL**：`GET /api/chapter/:chapterId?userId={userId}`
   - **调用位置**：`ChapterReader.tsx:252` - `novelService.getChapterContent(chapterId, userId)`
   - **后端路由**：`backend/server.js:2398` - `app.get('/api/chapter/:chapterId', ...)`
   - **SQL查询条件**：
     ```sql
     WHERE c.id = ? AND c.review_status = 'approved'
     -- 只过滤了 review_status，没有过滤 is_released 和 is_advance
     ```

2. **权限检查逻辑**（后端）：
   - `backend/server.js:2495-2524` - `checkChapterUnlockStatus()` 函数
   - **当前逻辑**：
     - 如果 `chapter.unlock_price > 0`，检查用户是否已解锁（`chapter_unlocks` 表）
     - 如果未解锁，返回预览内容（前6段）
     - **没有**检查 `is_advance` 和用户 Champion 会员资格
     - **没有**检查 `is_released` 字段

**上一章 / 下一章导航逻辑**：

1. **数据来源**：
   - **后端计算**：`backend/server.js:2444-2457` - SQL 子查询计算 `prev_chapter_id` 和 `next_chapter_id`
   - **计算条件**：
     ```sql
     -- 上一章
     WHERE novel_id = c.novel_id
       AND review_status = 'approved'
       AND chapter_number < c.chapter_number
     ORDER BY chapter_number DESC LIMIT 1
     
     -- 下一章
     WHERE novel_id = c.novel_id
       AND review_status = 'approved'
       AND chapter_number > c.chapter_number
     ORDER BY chapter_number ASC LIMIT 1
     ```
   - **问题**：只基于 `review_status='approved'` 和 `chapter_number`，**没有考虑**：
     - `is_released` 字段（可能包含未发布的章节）
     - `is_advance` 字段（可能包含普通用户不可见的预读章节）
     - 用户 Champion 会员资格（Champion 用户应该能看到预读章节）

2. **前端处理**：
   - `ChapterReader.tsx:409-443` - `handlePrevChapter()` 和 `handleNextChapter()` 函数
   - **逻辑**：
     ```typescript
     if (chapterData?.has_prev && chapterData.prev_chapter_id) {
       navigate(`/novel/${novelId}/chapter/${chapterData.prev_chapter_id}`);
     }
     ```
   - **问题**：前端**完全依赖后端返回的 ID**，不做任何可见性判断

**章节列表侧边栏**：

- **接口**：`ChapterReader.tsx:386` - `novelService.getNovelChapters(novelId)`
- **后端接口**：`GET /api/novel/:novelId/chapters`（`backend/upload_novel.js:727`）
- **SQL**：
  ```sql
  SELECT c.id, c.chapter_number, c.title, c.volume_id, v.title as volume_title, v.volume_id
  FROM chapter c
  LEFT JOIN volume v ON c.volume_id = v.volume_id AND v.novel_id = c.novel_id
  WHERE c.novel_id = ?
  ORDER BY c.chapter_number
  ```
- **问题**：**没有任何过滤条件**，返回所有章节（包括未审核、未发布、预读章节）

**Champion 相关提示/限制**：

- **当前状态**：阅读页**没有**任何 Champion 相关的提示或限制
- **没有**检查用户是否为 Champion 会员
- **没有**对 `is_advance=1` 的章节做特殊处理
- **没有**显示"这是预读章节"的标记

---

### 1.3 前端中与 Champion 会员相关的上下文 / hook / 组件

**全局搜索关键词结果**：

1. **Champion 状态获取接口**：
   - **接口URL**：`GET /api/champion/status/:novelId`
   - **后端路由**：`backend/routes/champion.js:85` - `router.get('/status/:novelId', ...)`
   - **返回数据**：
     ```json
     {
       "success": true,
       "data": {
         "isChampion": true/false,
         "tier": {
           "level": 3,
           "name": "Martial Lord",
           "price": 5.00,
           "advanceChapters": 3,  // 预读章节数
           "endDate": "2025-12-31"
         }
       }
     }
     ```

2. **前端使用情况**：
   - **搜索结果**：前端**没有**在任何地方调用 `/api/champion/status/:novelId` 接口
   - **ChapterDisplay 组件**：接收了 `user` prop，但**没有使用**它来查询 Champion 状态
   - **ChapterReader 组件**：**没有**查询用户 Champion 状态

3. **Champion 相关组件**：
   - `frontend/src/pages/Champion.tsx` - Champion 会员管理页面（用户中心）
   - `frontend/src/components/UserCenter/Champion.tsx` - 用户中心的 Champion 组件
   - **但这些组件只用于显示用户的订阅记录，不用于控制章节可见性**

**总结**：

- **当前前端没有"根据等级显示预读章节数"的逻辑**
- **Champion 等级和预读章节数**目前只在以下场景使用：
  - 用户中心显示订阅信息
  - 后端计算 `is_advance` 时参考（上传章节时）
- **前端没有**根据用户 Champion 等级来过滤或标记章节列表

---

## 二、后端接口部分

### 2.1 章节列表接口

**用于"小说详情页章节列表"的后端接口**：

1. **卷列表接口**：
   - **路由**：`GET /api/novel/:novelId/volumes`
   - **位置**：`backend/server.js:4466`
   - **SQL查询**：
     ```sql
     SELECT v.*, COUNT(c.id) as actual_chapter_count, MAX(c.created_at) as latest_chapter_date
     FROM volume v
     LEFT JOIN chapter c ON c.volume_id = v.id
       AND c.novel_id = v.novel_id
       AND c.review_status = 'approved'  -- 只过滤了 review_status
     WHERE v.novel_id = ?
     GROUP BY v.id, ...
     ```
   - **过滤条件**：只过滤了 `c.review_status = 'approved'`
   - **没有过滤**：`is_released`、`is_advance`

2. **卷内章节列表接口**：
   - **路由**：`GET /api/volume/:volumeId/chapters`
   - **位置**：`backend/server.js:4539`
   - **SQL查询**：
     ```sql
     SELECT c.id, c.chapter_number, c.title, c.created_at, c.is_advance, c.unlock_price,
            CASE 
              WHEN c.unlock_price > 0 THEN 'locked'
              WHEN c.is_advance = 1 THEN 'advance'
              ELSE 'free'
            END as access_status
     FROM chapter c
     JOIN volume v ON c.volume_id = v.id AND v.novel_id = c.novel_id
     WHERE v.id = ? AND c.review_status = 'approved'
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?
     ```
   - **过滤条件**：只过滤了 `c.review_status = 'approved'`
   - **没有过滤**：`is_released`、`is_advance`（虽然返回了 `is_advance` 字段，但没有用它来过滤）
   - **返回字段**：返回了 `is_advance` 和 `access_status`，但**没有根据用户 Champion 状态过滤**

3. **小说章节列表接口（用于阅读页侧边栏）**：
   - **路由**：`GET /api/novel/:novelId/chapters`
   - **位置**：`backend/upload_novel.js:727` - `getNovelChaptersAPI()`
   - **SQL查询**：
     ```sql
     SELECT c.id, c.chapter_number, c.title, c.volume_id, v.title as volume_title, v.volume_id
     FROM chapter c
     LEFT JOIN volume v ON c.volume_id = v.volume_id AND v.novel_id = c.novel_id
     WHERE c.novel_id = ?
     ORDER BY c.chapter_number
     ```
   - **过滤条件**：**没有任何过滤**，返回所有章节

**服务端过滤逻辑总结**：

- **当前状态**：所有章节列表接口**都没有**在 SQL 层面过滤 `is_released` 和 `is_advance`
- **没有**根据 `novel.champion_status` 进行过滤
- **没有**根据用户 Champion 会员信息进行服务端过滤
- **只过滤了** `review_status = 'approved'`（部分接口甚至没有这个过滤）

---

### 2.2 单章节内容接口 / 阅读接口

**用于"阅读页加载单章内容"的接口**：

- **路由**：`GET /api/chapter/:chapterId?userId={userId}`
- **位置**：`backend/server.js:2398` - `app.get('/api/chapter/:chapterId', ...)`

**权限判断 / 可见性过滤逻辑**：

1. **当前逻辑**（`backend/server.js:2495-2524`）：
   ```javascript
   // 如果章节有解锁价格，需要检查用户权限
   if (chapter.unlock_price && chapter.unlock_price > 0) {
     if (!userId) {
       isLocked = true;  // 未登录用户，返回预览内容
     } else {
       const unlockStatus = await checkChapterUnlockStatus(db, userId, chapterId, chapter, user);
       if (!unlockStatus.isUnlocked) {
         isLocked = true;  // 未解锁，返回预览内容
       }
     }
   }
   ```

2. **问题**：
   - **没有检查** `is_released` 字段（可能返回未发布章节的完整内容）
   - **没有检查** `is_advance` 字段（可能返回普通用户不可见的预读章节）
   - **没有检查** 用户 Champion 会员资格（Champion 用户应该能访问 `is_advance=1` 的章节）
   - **只检查了** `unlock_price > 0` 的付费章节解锁状态

3. **上一章/下一章计算**（`backend/server.js:2444-2457`）：
   ```sql
   -- 上一章
   (SELECT id FROM chapter
    WHERE novel_id = c.novel_id
      AND review_status = 'approved'
      AND chapter_number < c.chapter_number
    ORDER BY chapter_number DESC LIMIT 1) AS prev_chapter_id
   
   -- 下一章
   (SELECT id FROM chapter
    WHERE novel_id = c.novel_id
      AND review_status = 'approved'
      AND chapter_number > c.chapter_number
    ORDER BY chapter_number ASC LIMIT 1) AS next_chapter_id
   ```
   - **问题**：只基于 `review_status='approved'` 和 `chapter_number`，**没有考虑**：
     - `is_released`（可能指向未发布的章节）
     - `is_advance`（可能指向普通用户不可见的预读章节）
     - 用户 Champion 会员资格（Champion 用户应该能看到预读章节）

**总结**：

- **当前状态**：后端**没有**做任何基于 `is_released`、`is_advance`、用户 Champion 会员资格的权限判断
- **只要有链接就能读任何 `review_status='approved'` 的章节**（不管是否已发布、是否为预读章节）

---

### 2.3 与 Champion 会员 / 预读相关的后端逻辑

**Champion 相关 Service / Route**：

1. **Champion Service**：
   - **文件**：`backend/services/championService.js`
   - **关键方法**：
     - `getNovelChampionConfig(novelId)` - 获取小说 Champion 配置
     - `getUserAccessibleChapters(userId, novelId)` - **获取用户可访问的章节数**（但**没有实际使用**）

2. **Champion Route**：
   - **文件**：`backend/routes/champion.js`
   - **关键接口**：
     - `GET /api/champion/config/:novelId` - 获取小说 Champion 配置
     - `GET /api/champion/status/:novelId` - 获取用户 Champion 状态（包含 `advanceChapters`）

**数据库字段定义**：

1. **`novel.champion_status` 字段**：
   - **定义位置**：`backend/database/champion_system.sql`（迁移脚本）
   - **类型**：`ENUM('submitted', 'invalid', 'approved', 'rejected')`
   - **默认值**：`'invalid'`
   - **含义**：
     - `invalid` - 无效/未申请
     - `submitted` - 已提交申请
     - `approved` - 审核通过（启用 Champion 系统）
     - `rejected` - 审核不通过

2. **`chapter` 表字段**：
   - **`is_advance`**：
     - **类型**：`tinyint(1)`
     - **默认值**：`0`
     - **含义**：是否为预读章节（0=否，1=预读）
   - **`is_released`**：
     - **类型**：`tinyint(1)`
     - **默认值**：`1`
     - **含义**：是否已发布（0=未发布，1=已发布）

3. **Champion 会员相关表**：
   - **`novel_champion_tiers`**：
     - **字段**：`tier_level`（等级序号）、`advance_chapters`（预读章节数）、`monthly_price`（月费）
     - **作用**：存储每本小说的 Champion 等级配置
   - **`user_champion_subscription`**：
     - **字段**：`user_id`、`novel_id`、`tier_level`、`end_date`、`is_active`
     - **作用**：存储用户的 Champion 订阅记录
   - **`user_champion_subscription_record`**：
     - **作用**：存储详细的订阅支付记录

**Champion 等级与预读章节数的关系**：

- **设计**：在 `novel_champion_tiers` 表中，每个 `tier_level` 对应一个 `advance_chapters` 值
- **默认配置**（`backend/database/champion_system.sql:94-107`）：
  - Tier 1: 1 章
  - Tier 2: 2 章
  - Tier 3: 3 章
  - Tier 4: 5 章
  - Tier 5: 8 章
  - Tier 6: 10 章
  - Tier 7: 15 章
  - Tier 8: 20 章
  - Tier 9: 25 章
  - Tier 10: 30 章
  - Tier 11: 40 章
  - Tier 12: 50 章
  - Tier 13: 65 章

**当前后端是否有"根据用户等级，限制可见章节数量"的逻辑**：

- **答案**：**没有**
- **`championService.getUserAccessibleChapters()` 方法**（`backend/services/championService.js:127-166`）：
  - **作用**：计算用户可访问的章节数（总章节数 + 预读章节数）
  - **问题**：这个方法**定义了但没有被任何地方调用**
  - **没有**在任何章节列表接口或单章节接口中使用

**`is_advance` 设置逻辑**（上传章节时）：

- **位置**：`backend/routes/novelCreation.js:1273-1375`
- **逻辑**：
  1. 检查 `novel.champion_status`，如果不是 `'approved'`，则 `is_advance = 0`
  2. 如果是 `'approved'`，查询最大 `tier_level` 的 `advance_chapters` 值（设为 A）
  3. 查询该小说 `is_advance=1` 的章节数（设为 B）
  4. 如果 `A > B`，新增章节时 `is_advance=1`
  5. 如果 `A = B`，新增章节时 `is_advance=1`，同时将倒数第 `A+1` 条 `is_advance=1` 的章节设为 `is_advance=0`（滑动窗口）
- **问题**：这个逻辑**只在上传章节时设置 `is_advance` 字段**，**没有在查询章节时根据用户 Champion 状态过滤可见章节**

---

## 三、数据库结构总结

### 3.1 `novel` 表中与 Champion 相关的字段

- **`champion_status`**：
  - **类型**：`ENUM('submitted', 'invalid', 'approved', 'rejected')`
  - **默认值**：`'invalid'`
  - **作用**：标识小说是否启用 Champion 会员系统

### 3.2 `chapter` 表字段

- **`is_advance`**：
  - **类型**：`tinyint(1)`
  - **默认值**：`0`
  - **作用**：标识是否为预读章节（0=否，1=预读）

- **`is_released`**：
  - **类型**：`tinyint(1)`
  - **默认值**：`1`
  - **作用**：标识是否已发布（0=未发布，1=已发布）

- **`chapter_number`**：
  - **类型**：`int`
  - **作用**：章节序号（用于排序和导航）

- **`review_status`**：
  - **类型**：`ENUM('submitted', 'reviewing', 'approved', 'rejected', 'draft')`
  - **作用**：审核状态（只有 `'approved'` 的章节才会在详情页和阅读页显示）

### 3.3 Champion 会员相关表

1. **`novel_champion_tiers`**：
   - **字段**：
     - `novel_id` - 小说ID
     - `tier_level` - 等级序号（1-13）
     - `tier_name` - 等级名称
     - `monthly_price` - 月费
     - **`advance_chapters`** - **预读章节数**（关键字段）
     - `is_active` - 是否启用
   - **作用**：存储每本小说的 Champion 等级配置

2. **`user_champion_subscription`**：
   - **字段**：
     - `user_id` - 用户ID
     - `novel_id` - 小说ID
     - `tier_level` - 订阅的等级
     - `tier_name` - 等级名称
     - `start_date` - 订阅开始时间
     - `end_date` - 订阅结束时间
     - `is_active` - 是否激活
   - **作用**：存储用户的 Champion 订阅记录（用于判断用户是否为 Champion 会员）

3. **`user_champion_subscription_record`**：
   - **作用**：存储详细的订阅支付记录（用于财务和审计）

---

## 四、现状 vs 目标规则的差异简要对比

### 4.1 当前"章节可见性"的实际规则

**小说详情页章节列表**：
- **实际行为**：显示所有 `review_status='approved'` 的章节
- **没有过滤**：`is_released`、`is_advance`
- **没有考虑**：`novel.champion_status`、用户 Champion 会员资格

**阅读页**：
- **单章节内容**：只要 `review_status='approved'` 就能访问（不管 `is_released`、`is_advance`）
- **上一章/下一章**：基于 `review_status='approved'` 和 `chapter_number` 计算，**没有考虑** `is_released`、`is_advance`、用户 Champion 会员资格
- **章节列表侧边栏**：显示所有章节（**没有任何过滤**）

### 4.2 与目标业务规则的主要差异点

1. **缺少 `is_released` 过滤**：
   - **目标**：只显示 `is_released=1` 的章节
   - **现状**：没有过滤 `is_released`，可能显示未发布的章节

2. **缺少 `is_advance` 过滤**：
   - **目标**：普通用户只显示 `is_advance=0` 的章节
   - **现状**：没有过滤 `is_advance`，普通用户也能看到预读章节

3. **缺少 `novel.champion_status` 判断**：
   - **目标**：如果 `champion_status != 'approved'`，所有用户都只显示 `is_advance=0 AND is_released=1` 的章节
   - **现状**：没有判断 `champion_status`，所有小说都显示所有章节

4. **缺少用户 Champion 会员资格判断**：
   - **目标**：Champion 用户可以看到 `is_advance=1 AND is_released=1` 的预读章节（根据等级对应的预读章节数）
   - **现状**：没有查询用户 Champion 订阅状态，没有根据等级过滤预读章节

5. **上一章/下一章导航逻辑不完整**：
   - **目标**：只在"当前用户可见的章节集合"中跳转
   - **现状**：基于所有 `review_status='approved'` 的章节计算，可能跳转到不可见的章节

6. **前端没有预读章节标记**：
   - **目标**：在章节列表中标记"Champion 预读章节"
   - **现状**：虽然有 `is_advance` 的图标（⚡），但没有明确说明这是"Champion 预读章节"

---

## 五、总结

**核心问题**：

1. **后端接口缺少可见性过滤**：所有章节列表接口和单章节接口都没有根据 `is_released`、`is_advance`、用户 Champion 会员资格进行过滤
2. **前端没有权限判断**：前端没有查询用户 Champion 状态，没有根据权限过滤章节列表
3. **导航逻辑不完整**：上一章/下一章的计算没有考虑可见性规则

**需要实现的关键功能**：

1. **后端接口改造**：
   - 章节列表接口需要根据 `is_released=1` 过滤
   - 根据 `novel.champion_status` 和用户 Champion 会员资格过滤 `is_advance` 章节
   - 单章节接口需要检查可见性权限
   - 上一章/下一章计算需要考虑可见性规则

2. **前端改造**：
   - 查询用户 Champion 状态
   - 根据权限过滤章节列表
   - 标记"Champion 预读章节"
   - 处理不可见章节的跳转

---

**报告结束**

