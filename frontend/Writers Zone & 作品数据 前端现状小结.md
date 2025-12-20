# Writers Zone & 作品数据 前端现状小结

**分析时间**：2025-01-XX  
**分析范围**：Writers Zone 页面结构、菜单配置、图表库、API 调用方式

---

## 一、Writers Zone 主页面组件

**文件路径**：`frontend/src/pages/WritersZone.tsx`

**主要特点**：
- 使用 React Hooks（useState, useEffect）管理状态
- 支持多语言（中文/英文）和主题切换（亮色/暗色）
- 左侧菜单导航 + 右侧主内容区域的布局结构
- 菜单项通过 `activeNav` 状态控制显示哪个页面组件

**当前菜单结构**（在 `WritersZone.tsx` 第 442-550 行）：
- 首页（home）
- 作品管理（workManagement）- 可展开子菜单
  - 小说（novels）
  - 短篇（shortStory）
  - 剧本（script）
- 互动管理（interactionManagement）- 可展开子菜单
  - 评论管理（commentManagement）
  - 读者纠错（readerCorrections）
- **作品数据（workData）** - ⚠️ **目前没有绑定路由或点击事件**
- 收入管理（incomeManagement）- 已实现，使用 `IncomeManagement` 组件
- 学习交流（learningExchange）- 可展开子菜单
- 请假管理（leaveManagement）
- 个人信息（personalInfo）
- 我的合同（myContracts）
- 我的帖子（myPosts）

**菜单配置方式**：
- ❌ **没有独立的菜单配置文件**
- ✅ 菜单项直接在 `WritersZone.tsx` 中硬编码
- ✅ 使用 `t('nav.workData')` 等国际化 key 获取文案
- ✅ 通过 `activeNav` 状态控制当前激活的页面

---

## 二、已使用的图表库

**搜索结果**：❌ **项目中未发现任何图表库**

**检查范围**：
- `package.json` 中未发现 `recharts`、`echarts`、`chart.js`、`victory` 等图表库
- 代码中未发现 `LineChart`、`BarChart`、`PieChart` 等图表组件引用
- `IncomeManagement.tsx` 中只使用了表格和卡片，没有图表

**建议**：
- 需要新增图表库，推荐使用 `recharts`（React 友好，TypeScript 支持好）
- 或使用 `echarts`（功能强大，但需要额外封装 React 组件）

---

## 三、已存在的统计类接口调用

### 3.1 作品列表接口

**位置**：`WritersZone.tsx` 第 186-221 行

**接口调用**：
```typescript
const response = await ApiService.get(`/novels/user/${user.id}`);
```

**返回数据结构**（根据代码推断）：
```typescript
interface UserNovel {
  id: number;
  title: string;
  cover?: string;
  status: string; // 'ongoing' | 'completed' | 'hiatus'
  // ... 其他字段
}
```

### 3.2 收入管理相关接口

**位置**：`IncomeManagement.tsx`

**已使用的接口**：
- `/writer/income/summary` - 收入汇总
- `/writer/income/by-novel` - 按作品汇总
- `/writer/income/details/base` - 基础收入明细
- `/writer/income/details/reader-referral` - 读者推广收入明细
- `/writer/income/details/author-referral` - 作者推广收入明细

**返回数据结构示例**（IncomeSummary）：
```typescript
interface IncomeSummary {
  month: string;
  author_base_income: string;
  reader_referral_income: string;
  author_referral_income: string;
  total_income: string;
}
```

### 3.3 作品数据评价系统接口（后端已实现，前端未调用）

**后端接口**（根据 `backend/routes/analytics.js` 和 `backend/routes/rankings.js`）：
- `GET /api/analytics/novels/:novelId/daily` - 获取每日统计数据
- `GET /api/analytics/novels/:novelId/summary` - 获取综合评分摘要
- `GET /api/rankings/overall` - 综合排行榜

**返回数据结构**（根据后端代码推断）：

**每日统计数据**（`/api/analytics/novels/:novelId/daily`）：
```typescript
interface NovelDailyStats {
  id: number;
  novel_id: number;
  stat_date: string; // YYYY-MM-DD
  views: number;
  unique_readers: number;
  views_24h: number;
  views_7d: number;
  effective_reads: number;
  avg_stay_duration_sec: number;
  finish_rate: number;
  avg_read_chapters_per_user: number;
  paid_unlock_count: number;
  time_unlock_count: number;
  paid_reader_count: number;
  chapter_revenue: number;
  champion_revenue: number;
  champion_active_count: number;
  rating_count: number;
  rating_sum: number;
  avg_rating_snapshot: number;
  new_comments: number;
  new_paragraph_comments: number;
  new_comment_likes: number;
  new_comment_dislikes: number;
  created_at: string;
  updated_at: string;
}
```

**综合评分摘要**（`/api/analytics/novels/:novelId/summary`）：
```typescript
interface NovelAnalyticsSummary {
  novel_id: number;
  total_views: number;
  total_unique_readers: number;
  total_chapter_revenue: number;
  total_champion_revenue: number;
  total_comments: number;
  total_paragraph_comments: number;
  avg_rating: number;
  rating_count: number;
  popularity_score: number; // 0-100
  engagement_score: number; // 0-100
  monetization_score: number; // 0-100
  reputation_score: number; // 0-100
  community_score: number; // 0-100
  final_score: number; // 0-100
  last_calculated_at: string;
  created_at: string;
  updated_at: string;
}
```

---

## 四、API 调用方式

**统一服务**：`frontend/src/services/ApiService.ts`

**使用方式**：
```typescript
import ApiService from '../services/ApiService';

// GET 请求
const response = await ApiService.get('/endpoint');

// POST 请求
const response = await ApiService.post('/endpoint', { data });

// 返回格式
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  // ... 其他字段
}
```

---

## 五、样式系统

**CSS Modules**：使用 `.module.css` 文件

**主题系统**：
- 支持亮色/暗色主题切换
- 使用 CSS Variables（`--bg-primary`, `--text-primary` 等）
- 主题变量定义在 `WritersZone.module.css` 中

**卡片样式**（参考 `IncomeManagement.module.css`）：
- `.summaryCards` - 卡片容器（grid 布局）
- `.summaryCard` - 单个卡片
- `.cardTitle` - 卡片标题
- `.cardValue` - 卡片数值

---

## 六、总结

### 6.1 菜单配置
- ✅ **菜单配置文件路径**：无独立配置文件，直接在 `WritersZone.tsx` 中定义
- ⚠️ **"作品数据"菜单项**：已存在（第 498-501 行），但**未绑定路由和点击事件**

### 6.2 图表库
- ❌ **已使用的图表库**：无
- 📝 **建议**：新增 `recharts` 或 `echarts`

### 6.3 统计类接口
- ✅ **作品列表接口**：`/novels/user/:userId`（已使用）
- ✅ **收入管理接口**：`/writer/income/*`（已使用）
- ⚠️ **作品数据接口**：`/api/analytics/*`（后端已实现，前端未调用）

---

**下一步工作**：
1. 安装图表库（推荐 `recharts`）
2. 创建 `WorkData.tsx` 组件
3. 在 `WritersZone.tsx` 中绑定"作品数据"菜单项的路由
4. 实现数据获取和图表展示逻辑

