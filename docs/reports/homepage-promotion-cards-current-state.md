# Homepage Promotion Cards - Current State Report

> 约束确认：本次仅做【代码现状摸清 + 运行验证 + 报告】。未改动任何业务逻辑代码；仅新增了一个**证据脚本**用于只读查询（已在 G 节说明用途与位置）。

---

## A. 前端首页渲染链路（HomeV2 入口 + 模块顺序 + 插入点候选）

### A1) HomeV2 首页入口链路（Home.tsx → HomeV2Page.tsx）

**证据（入口与 v2 选择逻辑）**

- 文件：`frontend/src/pages/Home.tsx`（L34-L42, L130-L133）

```ts
// 关键要求：首页只请求 1 次接口。
// 这里直接请求 /api/homepage/all，一次拿到旧字段 + v2（若存在），避免二次请求。
const all = await homepageService.getHomepageAll(6);
const preferV2 = process.env.REACT_APP_HOME_V2 !== '0';

if (preferV2 && all && all.success && all.data && all.data.v2) {
  setV2(all.data.v2);
  return;
}
...
// V2 首页（Wuxiaworld 风格排布）
if (v2) {
  return <HomeV2Page v2={v2} onNovelClick={handleNovelClick} />;
}
```

**证据（HomeV2 模块顺序）**

- 文件：`frontend/src/components/HomeV2/HomeV2Page.tsx`（L20-L23, L29-L40, L42-L80）

```tsx
/**
 * Wuxiaworld 风格首页 V2（模块顺序）
 * Hero双列 -> Popular This Week -> New Books -> Popular Genres -> Champion -> Recent Updates -> Footer
 */
...
<div className={styles.heroRow}>
  <HeroCarousel items={v2.hero?.items || []} />
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <AnnouncementsPanel ... />
    <TrendingRankPanel ... />
  </div>
</div>
...
<HorizontalRail title="Popular This Week" ... />
<BecauseYouReadSection ... />
<HorizontalRail title="New Releases" ... />
<PopularGenresTabs ... />
<ChampionSneakPeeks ... />
<RecentUpdatesTable ... />
```

### A2) “折扣促销卡区域”最佳插入位置（至少 2 个候选）

#### 候选点 1（强烈推荐）：Hero 右侧竖列顶部（Announcements/Trending 同列）

- 位置：`HomeV2Page.tsx` 的 `heroRow` 右侧 `<div style={{ flexDirection:'column'... }}>` 内，**放在 Announcements 之前或之后**
- 原因：
  - **视觉**：与 WuxiaWorld 右侧 Promo/Subscribe 卡一致，天然是“推广信息区域”
  - **性能**：与公告/Trending 同为公共数据（不个性化），可复用 `/api/homepage/all` 公共缓存
  - **交互**：不影响主内容流（Hero/rails），且高度可控

**证据（heroRow 双列布局）**

- 文件：`frontend/src/components/HomeV2/HomeV2.module.css`（L12-L17）

```css
.heroRow {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 18px;
  margin: 18px 0 26px;
}
```

#### 候选点 2：Hero Row 下方、Popular This Week 上方（主内容区第一段）

- 位置：`HomeV2Page.tsx` 中 `</div>{/* heroRow end */}` 之后、`<HorizontalRail title="Popular This Week" ... />` 之前
- 原因：
  - **视觉**：在用户第一屏仍可见（紧贴 Hero），并且横向空间更充足，便于做“两张大卡并排”
  - **数据**：同样是公共数据，可与首页 payload 同步
  - **性能**：依旧一次请求即可拿到，不额外引入 N+1

---

## B. 前端现有卡片/横条组件复用性（组件清单 + Props 结构 + 双列支持判断）

### B1) 可复用组件列表（HomeV2 体系内）

#### 1) `HeroCarousel`（大图主卡轮播）

- 文件：`frontend/src/components/HomeV2/HeroCarousel.tsx`（L8-L10）

```ts
type Props = {
  items: HomepageV2HeroItem[];
};
```

- 结论：偏“单张大卡”，可复用其 **深色遮罩+封面+描述** 视觉，但不直接是“双列促销卡”。

#### 2) `AnnouncementsPanel`（右侧公告卡）

- 文件：`frontend/src/components/HomeV2/AnnouncementsPanel.tsx`（L7-L10）

```ts
type Props = {
  items: HomepageV2Announcement[];
  viewAllUrl: string;
};
```

- 结论：与“右侧 Promo 卡”视觉位置一致，**更适合作为促销卡的同列组件**（插入点候选 1）。

#### 3) `TrendingRankPanel`（右侧榜单卡）

- 文件：`frontend/src/components/HomeV2/TrendingRankPanel.tsx`（L7-L11）

```ts
type Props = {
  tabs: HomepageV2GenreTab[];
  itemsByTab: Record<string, Novel[]>;
  viewAllUrl: string;
};
```

#### 4) `HorizontalRail`（横向书卡列表）

- 文件：`frontend/src/components/HomeV2/HorizontalRail.tsx`（L6-L11）

```ts
type Props = {
  title: string;
  viewAllUrl?: string;
  items: Novel[];
  onNovelClick?: (novel: Novel) => void;
};
```

#### 5) `BecauseYouReadSection`（个性化 rail）

- 文件：`frontend/src/components/HomeV2/BecauseYouReadSection.tsx`（L6-L13）

```ts
type Props = {
  becauseYouRead?: {
    continue_reading: HomepageV2ContinueReadingItem[];
    recommendations: Novel[];
    view_all_url: string;
  } | null;
  onNovelClick?: (novel: Novel) => void;
};
```

#### 6) `PopularGenresTabs`（tabs + rail）

- 文件：`frontend/src/components/HomeV2/PopularGenresTabs.tsx`（L5-L9）

```ts
type Props = {
  tabs: HomepageV2GenreTab[];
  itemsByTab: Record<string, Novel[]>;
  onNovelClick?: (novel: Novel) => void;
};
```

#### 7) `ChampionSneakPeeks`（Subscribe CTA + rail）

- 文件：`frontend/src/components/HomeV2/ChampionSneakPeeks.tsx`（L5-L8）

```ts
type Props = {
  ctaUrl: string;
  items: Novel[];
};
```

**证据（该组件已存在“Subscribe”类 CTA 卡，最接近 WuxiaWorld Promo/Subscribe 卡的风格）**

- 文件：`frontend/src/components/HomeV2/ChampionSneakPeeks.tsx`（L12-L20）

```tsx
<div style={{ background: 'linear-gradient(...)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, marginBottom: 12 }}>
  <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 6 }}>Sneak Peeks</div>
  <div style={{ color: 'rgba(255,255,255,0.75)', marginBottom: 12 }}>
    Become a Champion and get a preview of upcoming series!
  </div>
  <a href={ctaUrl} style={{ display: 'inline-block', background: '#2d6cdf', color: '#fff', padding: '10px 14px', borderRadius: 999, fontWeight: 900, textDecoration: 'none' }}>
    Subscribe
  </a>
</div>
```

#### 8) `RecentUpdatesTable`（表格模块）

- 文件：`frontend/src/components/HomeV2/RecentUpdatesTable.tsx`（L8-L11）

```ts
type Props = {
  items: HomepageV2RecentUpdateItem[];
  viewAllUrl: string;
};
```

### B2) 是否已有“Promo/Subscribe 卡”专用组件？

**结论：没有独立的 PromoCard/PromotionCard 组件**；最接近的是 `ChampionSneakPeeks` 里那张 CTA 卡（见上）。

**静态证据：HomeV2 目录内匹配 Subscribe/promo 的文件仅命中 `ChampionSneakPeeks.tsx`**

- grep 命中（文件列表）：`frontend/src/components/HomeV2/ChampionSneakPeeks.tsx`

### B3) 是否支持“双列大卡（两张并排）”？

**结论：目前没有现成“双列大卡”组件**。

- 右侧列（heroRow 第二列）天然是 **竖向 stack**（Announcements + Trending），可扩展为“多张卡垂直排列”
- 若要“两张并排大卡”，更适合放在候选点 2（Hero 下方），用一个 `display: grid; grid-template-columns: 1fr 1fr;` 的容器实现

---

## C. pricing_promotion 表使用现状（全仓搜索结果 + 是否已有“当前生效 promotion”查询）

### C1) 关键命中点（后端）

#### 1) 章节价格计算：查询当前促销并返回 `finalPrice`

- 文件：`backend/routes/pricing.js`（L164-L185, L247-L276）

```js
function applyPromotion(basePrice, promotion) {
  if (basePrice === 0) return basePrice;
  if (!promotion) return basePrice;
  const discount = promotion.discount_value;
  if (discount === 0) return 0;
  let discounted = Math.ceil(basePrice * discount);
  if (discounted < 1) discounted = 1;
  return discounted;
}
...
// 查找当前生效的促销活动
const now = new Date();
const [promotions] = await db.execute(
  `SELECT * FROM pricing_promotion 
   WHERE novel_id = ? 
     AND status IN ('scheduled', 'active')
     AND start_at <= ? 
     AND end_at >= ?
   ORDER BY discount_value ASC, start_at DESC
   LIMIT 1`,
  [chapter.novel_id, now, now]
);
...
res.json({ success: true, data: { basePrice, finalPrice, promotion: ... } });
```

#### 2) Champion 订阅：查询促销并映射到 Stripe Coupon（写回 `stripe_coupon_id`）

- 文件：`backend/services/championService.js`（L471-L521, L539-L616）

```js
async getOrCreateStripeCouponForPromotion({ novelId, basePrice, currency = 'USD' }) {
  // 1. 查询当前生效的促销活动
  const [promotions] = await this.db.execute(
    `SELECT id, promotion_type, discount_value, stripe_coupon_id, start_at, end_at, status
     FROM pricing_promotion 
     WHERE novel_id = ? 
       AND status IN ('scheduled', 'active')
       AND start_at <= ? 
       AND end_at >= ?
     ORDER BY discount_value ASC, start_at DESC
     LIMIT 1`,
    [novelId, now, now]
  );
  ...
  // 5. 将 coupon.id 写回 pricing_promotion.stripe_coupon_id
  await this.db.execute(
    'UPDATE pricing_promotion SET stripe_coupon_id = ? WHERE id = ?',
    [coupon.id, promotion.id]
  );
}
```

#### 3) Champion 订阅路由：实际调用 coupon 逻辑

- 文件：`backend/routes/payment.js`（L535-L567）

```js
const couponInfo = await championService.getOrCreateStripeCouponForPromotion({
  novelId: parseInt(novelId),
  basePrice: priceInfo.monthlyPrice,
  currency: priceInfo.currency
});
...
const subscriptionResult = await stripeService.createChampionSubscription({
  ...
  couponId: couponInfo.couponId || null
});
```

#### 4) 促销审批/冲突校验/状态机分布

- 作者端冲突校验与状态约束：`backend/routes/author.js`（L540-L555）
- 运营端审核时将 `approved` 映射为 `active/scheduled/expired`：`backend/routes/admin.js`（L10338-L10363）

```js
// author.js：时间冲突（排除已拒绝/已过期）
AND status IN ('pending', 'approved', 'scheduled', 'active')
...
// admin.js：审核通过时按时间纠正状态
if (status === 'approved') {
  if (startTime <= now && endTime >= now) finalStatus = 'active';
  else if (startTime > now) finalStatus = 'scheduled';
  else if (endTime < now) finalStatus = 'expired';
  ...
}
```

### C2) 关键命中点（前端）

#### 1) 章节解锁弹窗展示 promotion 倒计时/折扣信息

- 文件：`frontend/src/components/ChapterUnlockModal/ChapterUnlockModal.tsx`（L16-L56, L83-L110, L157-L168）

```ts
promotion?: {
  id: number;
  promotion_type: string;
  discount_value: number;
  discount_percentage: number;
  base_price: number;
  discounted_price: number;
  ...
} | null;
...
const response = await ApiService.request(`/chapter-unlock/status/${chapterId}/${userId}`);
...
if (isOpen && unlockStatus?.promotion) { /* 每秒更新促销倒计时 */ }
```

#### 2) Champion 购买页展示 promotion 并计算折扣价

- 文件：`frontend/src/components/ChampionDisplay/ChampionDisplay.tsx`（L24-L33, L100-L105, L129-L141）

```ts
const configResponse = await ApiService.request(`/champion/config/${novelId}`);
...
setPromotion(configResponse.data.promotion || null);
...
const discounted = Math.ceil(basePrice * discount * 100) / 100;
```

### C3) 是否已有“当前生效 promotion”查询函数？

**结论：后端已经存在多处“当前生效 promotion”查询，但实现分散、返回结构不统一。**

- 章节价格：`backend/routes/pricing.js`（返回 `{ basePrice, finalPrice, promotion }`）
- 章节解锁状态：`backend/routes/chapter_unlock.js`（返回 `promotionInfo`，带倒计时、折扣百分比、base/discounted_price）
- Champion config：`backend/routes/champion.js`（返回 `promotion`，带折扣百分比+倒计时）
- Champion Stripe coupon：`backend/services/championService.js`（返回 `{ couponId, promotionInfo }`，并可能写回 `stripe_coupon_id`）

---

## D. 促销与支付/订阅（Stripe coupon）的关联现状

### D1) Stripe coupon 的来源：pricing_promotion.stripe_coupon_id

**证据（字段来自迁移）**

- 文件：`backend/migrations/20251204_add_stripe_coupon_id_to_pricing_promotion.sql`（L4-L7）

```sql
ALTER TABLE `pricing_promotion`
  ADD COLUMN `stripe_coupon_id` VARCHAR(128) DEFAULT NULL COMMENT 'Stripe Coupon ID，用于订阅折扣' AFTER `discount_value`;
CREATE INDEX `idx_stripe_coupon_id` ON `pricing_promotion` (`stripe_coupon_id`);
```

### D2) Stripe coupon 的创建与复用策略

**证据（duration=once，且会写回 DB）**

- 文件：`backend/services/championService.js`（L572-L579, L597-L601）

```js
const couponData = {
  duration: 'once',
  metadata: { promotion_id: ..., novel_id: ..., discount_value: ... }
};
...
await this.db.execute(
  'UPDATE pricing_promotion SET stripe_coupon_id = ? WHERE id = ?',
  [coupon.id, promotion.id]
);
```

### D3) 折扣目前用于哪里：仅结算/扣款？还是已在 UI 展示？

**结论：两者都有。**

- **UI 展示（已存在）**
  - 章节解锁弹窗展示 promotion + 倒计时（`ChapterUnlockModal.tsx`）
  - Champion 页面展示 promotion 并显示折扣价（`ChampionDisplay.tsx`）
- **结算/扣款（已存在）**
  - 章节 Karma 解锁：后端按 promotion 计算 `finalPrice` 并实际扣减（`backend/routes/chapter_unlock.js`）
  - Champion Stripe 自动续费订阅：创建 subscription 时若存在促销，传入 couponId（`backend/routes/payment.js` → `stripeService.createChampionSubscription`）

### D4) “同一时间不能有 2 个活动”校验是否存在？

**结论：存在（作者端/运营端均有冲突校验逻辑），但查询口径是 `status IN (...)` 组合，且状态机较复杂。**

- 文件：`backend/routes/author.js`（L540-L555）
- 文件：`backend/routes/pricing.js`（L449-L464，作者申请促销时同样查冲突）

**【风险点】**：多处业务查询使用 `status IN ('scheduled','active') AND start_at <= now AND end_at >= now`。

- 若状态未被定时任务/审核流程及时切换，可能出现：
  - “本应 active 但仍 scheduled”的数据仍会被当作生效（因为 start_at<=now）
  - “approved” 状态是否应该参与展示取决于业务定义（当前主页目标只要 active）

---

## E. 后端首页接口现状（/api/homepage/all：组装 v2 payload + 公共缓存）

### E1) 公共缓存结构（仅缓存 /api/homepage/all 整体 payload）

- 文件：`backend/server.js`（L1819-L1865）

```js
// ---- Homepage V2 内存缓存（最小实现）----
// 说明：仅用于 /api/homepage/all 的整体缓存；TTL 到期自动刷新。
const __homepageAllCache = { expiresAt: 0, payload: null };
const HOMEPAGE_ALL_TTL_MS = 90 * 1000;
...
function isHomepageCacheValid() {
  return __homepageAllCache.payload && Date.now() < __homepageAllCache.expiresAt;
}
function setHomepageCache(payload) {
  __homepageAllCache.payload = payload;
  __homepageAllCache.expiresAt = Date.now() + HOMEPAGE_ALL_TTL_MS;
}
```

### E2) v2 payload 组装位置与结构（无 promotions 区块）

- 文件：`backend/server.js`（L2661-L2731）

```js
const payload = {
  success: true,
  data: {
    ...旧字段...,
    v2: {
      hero: { items: heroResult || [] },
      announcements: { items: announcementsResult || [], view_all_url: '/announcements' },
      popular_this_week: { items: popularResult || [], view_all_url: '/series?sort=popular_week' },
      trending: { tabs: trendingTabs, items_by_tab: trendingItemsByTab, view_all_url: '/series?sort=trending' },
      new_books: { items: newBooksFinal || [], view_all_url: '/series?sort=new' },
      popular_genres: { tabs: popularGenresTabs, items_by_tab: popularGenresItemsByTab },
      champion: { cta_url: '/champion', items: championItems },
      recent_updates: { items: recentUpdatesResult || [], view_all_url: '/updates' },
      because_you_read: baseBecauseYouRead
    }
  }
};
setHomepageCache(payload);
```

### E3) SQL 组织方式/并行策略/个性化隔离

- 并行获取多个模块数据：`Promise.all([...])`（`backend/server.js` L2328-L2341）
- `because_you_read` 走用户级小缓存，不进入公共缓存：`__becauseYouReadCache`（L1841-L1856）+ 请求命中时 patched 覆盖（L2258-L2296 / L2711-L2728）

---

## F. 后端是否已有 promotion 的“公开接口”？

### F1) 已存在但“非首页专用”的接口/返回

1) **章节价格接口（按 chapterId）**
- `GET /api/chapters/:chapterId/price`（`backend/routes/pricing.js` L188-L277）
- 返回：`{ basePrice, finalPrice, promotion }`

2) **章节解锁状态接口（按 chapterId+userId）**
- `GET /api/chapter-unlock/status/:chapterId/:userId`（`backend/routes/chapter_unlock.js`，返回含 `promotion` 结构，见 C2）

3) **Champion 配置接口（按 novelId）**
- `GET /api/champion/config/:novelId`（`backend/routes/champion.js` L14-L72）
- 返回：`{ tiers, promotion }`

4) **促销管理接口（作者/运营/定价管理）**
- 作者端：`backend/routes/author.js`
- 运营端：`backend/routes/admin.js`
- 定价管理：`backend/routes/pricing.js`

### F2) 是否存在“主页可直接拿到的活动列表接口”？

**结论：没有专门面向首页的一次性“活动列表（多本书）”公开接口**，当前首页 v2 payload 也没有 promotions 区块（见 E2）。

### F3) /api 路由挂载证据（pricing routes 是公开挂载在 /api 下）

- 文件：`backend/server.js`（L237-L238）

```js
const pricingRoutes = require('./routes/pricing');
app.use('/api', pricingRoutes);
```

**【风险点】**：`backend/routes/pricing.js` 内包含“申请促销”等写接口（见 C1），但此文件本身未见 auth 中间件包裹（需后续专门审计）。主页促销展示建议走“只读接口/只读 SQL”避免误用写路径。

---

## G. 数据库与样例数据验证（只读 SQL + 本地实际执行结果）

### G1) 推荐用于“首页应展示 promotions”的 SQL（仅写入报告，不改库）

```sql
SELECT
  pp.id,
  pp.novel_id,
  n.title AS novel_title,
  pp.promotion_type,
  pp.discount_value,
  pp.stripe_coupon_id,
  pp.start_at,
  pp.end_at,
  pp.status
FROM pricing_promotion pp
JOIN novel n ON n.id = pp.novel_id
WHERE pp.status = 'active'
  AND pp.start_at <= NOW()
  AND (pp.end_at IS NULL OR pp.end_at >= NOW())
  AND pp.promotion_type IN ('discount','free')
  AND n.review_status = 'published'
ORDER BY pp.start_at DESC, pp.id DESC
LIMIT 50;
```

### G2) 本地 DB 实际执行结果（最多 2 行样例）

**运行证据（本次新增临时脚本，仅只读查询）**

- 脚本文件：`docs/reports/_evidence/query_promotions.js`
- 执行命令：在 `backend/` 目录执行 `node ..\\docs\\reports\\_evidence\\query_promotions.js`
- 控制台输出（2025-12-15）：

```text
rows = 1
sample = [
  {
    "id": 3,
    "novel_id": 7,
    "novel_title": "红楼梦",
    "promotion_type": "discount",
    "discount_value": "0.7000",
    "stripe_coupon_id": "fnGvlJ27",
    "start_at": "2025-11-30T05:39:00.000Z",
    "end_at": "2025-12-30T06:41:00.000Z",
    "status": "active"
  }
]
```

---

## H. 本地运行时证据（/api/homepage/all：Network/缓存/字段/大小）

### H1) 浏览器 Network 证据：首页请求确实拉取了 `/api/homepage/all?limit=6`

**运行证据（Browser Network Requests 列表节选）**

- 访问：`http://localhost:3000/`
- Network Requests 中包含：
  - `[GET] http://localhost:5000/api/homepage/all?limit=6`

（来自浏览器工具输出：`browser_network_requests`）

### H2) curl 响应头：payload 大小

**运行证据**

```text
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Content-Length: 52122
ETag: W/"cb9a-jLnT4Ip6jzwhlQL7q5H6eBZeSLc"
```

### H3) v2 payload 是否已有 promotions 字段？

**运行证据（Node fetch 解析）**

```text
httpStatus= 200
v2 keys= [
  'hero',
  'announcements',
  'popular_this_week',
  'trending',
  'new_books',
  'popular_genres',
  'champion',
  'recent_updates',
  'because_you_read'
]
hasPromotionsInV2= false
```

### H4) 缓存命中辅助证据（两次请求 time_total 对比）

```text
first time=0.006354s size=52122
second time=0.004169s size=52122
```

结合 E 节的 `HOMEPAGE_ALL_TTL_MS=90s` 内存缓存实现，可合理推断第二次请求命中了内存缓存（但当前接口未设置显式 `X-Cache` header）。

---

## I. 最小接入点建议（只建议，不实现）

### 方案 1：在 `/api/homepage/all` 的 v2 增加 `promotions` 区块（公共数据，随 TTL 缓存）

- **做法**：在 `backend/server.js` 组装 `payload.data.v2` 时，增加 `promotions: { items: [...] }`
- **缓存**：跟随 `__homepageAllCache` 90s TTL
- **优点**
  - 前端零额外请求（首页仍然 1 次接口）
  - 数据一致性更好（hero/rails/promotions 同一响应）
- **缺点**
  - promotion 有时间窗（开始/结束），TTL 可能导致展示延迟（最多 90s）
  - 需要谨慎避免触发“Stripe coupon 创建/写回”这类副作用逻辑（应仅做只读查询）

### 方案 2：新增独立接口 `/api/homepage/promotions`（前端并行拉取）

- **做法**：新增只读接口，返回“当前应展示的 promotions + 关联 novel 信息”
- **缓存**：可单独设置更短 TTL（如 15~30s），或按 `start_at/end_at` 动态计算 TTL
- **优点**
  - 不影响现有 `/api/homepage/all` 公共缓存（风险更低）
  - 可以更容易做独立灰度/回滚
- **缺点**
  - 首页会多 1 个请求
  - 前端需要并行加载/占位状态

---

## J. 最终建议的“实现路径”（5~10 条 bullet + 文件清单 + 返回结构草案）

### J1) 建议实现路径（不写代码）

- **先定义“首页促销卡”所需字段**：promotion（折扣/时间窗/类型）+ novel（title/cover/author/chapter 等最少集）
- **做一个纯只读 SQL 查询**（参考 G1），并在后端封装为 `getActiveHomepagePromotions()`（严禁在该路径里创建 Stripe coupon 或写回 DB）
- **优先选方案 1 或 2（二选一）**：
  - 若你坚持“首页只请求一次”：选方案 1（加到 `/api/homepage/all` 的 v2）
  - 若你更看重回滚与低风险：选方案 2（新增独立接口）
- **前端组件层面**：复用 `HomeV2` 的卡片视觉（`mutedCard`、`ChampionSneakPeeks` CTA 风格），新建 `HomepagePromotionCards`（支持 2 张大卡并排 or 右侧 stack）
- **插入位置**：优先 Hero 右侧列顶部（与 WuxiaWorld 一致），备选 Hero 下方双列
- **UI 展示**：仅展示 active+时间窗内的活动；显示折扣（如 “30% OFF”）、倒计时（可选）、关联小说信息
- **灰度/安全**：上线前增加开关（例如 env 或后端 feature flag）与空态兜底（无活动时不渲染）

### J2) 需要新增/修改的文件清单（不实现，只列清单）

**后端（方案 1）**
- `backend/server.js`：在 v2 payload 组装处增加 `promotions` 字段（只读查询结果）
- （可选）`backend/services/homepagePromotionService.js`：封装只读查询（推荐新建，避免把 SQL 塞进 server.js）

**后端（方案 2）**
- `backend/routes/homepagePromotions.js`（新建）：`GET /api/homepage/promotions`
- `backend/server.js`：挂载路由
- （可选）`backend/services/homepagePromotionService.js`

**前端**
- `frontend/src/components/HomeV2/HomeV2Page.tsx`：插入 `HomepagePromotionCards` 区域
- `frontend/src/components/HomeV2/HomepagePromotionCards.tsx` + `.module.css`（新建）
- `frontend/src/services/homepageService.ts`：扩展 `HomepageV2` 类型（增加 promotions）

### J3) 返回数据结构草案（TS interface + JSON 示例）

**TypeScript（草案）**

```ts
export type HomepagePromotionItem = {
  promotion: {
    id: number;
    promotion_type: 'discount' | 'free';
    discount_value: number; // e.g. 0.7
    start_at: string;
    end_at: string | null;
    status: 'active';
    stripe_coupon_id?: string | null; // 仅展示用（可不返回）
  };
  novel: {
    id: number;
    title: string;
    cover: string | null;
    author: string | null;
    status: string | null;
    chapters?: number | null;
  };
};

export type HomepageV2 = {
  ...
  promotions?: { items: HomepagePromotionItem[] };
};
```

**JSON 示例（方案 1：放在 /api/homepage/all 的 v2）**

```json
{
  "success": true,
  "data": {
    "v2": {
      "promotions": {
        "items": [
          {
            "promotion": {
              "id": 3,
              "promotion_type": "discount",
              "discount_value": 0.7,
              "start_at": "2025-11-30T05:39:00.000Z",
              "end_at": "2025-12-30T06:41:00.000Z",
              "status": "active"
            },
            "novel": {
              "id": 7,
              "title": "红楼梦",
              "cover": "/covers/novel_cover_7_xxx.jpg",
              "author": "曹雪芹",
              "status": "ongoing",
              "chapters": 108
            }
          }
        ]
      }
    }
  }
}
```


