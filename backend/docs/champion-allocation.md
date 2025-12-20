# Champion 分摊统计口径（champion_revenue / champion_active_count）

> 目的：固化“Champion 分摊统计”的口径共识，避免未来误改为“按阅读行为过滤”或误当作“收款日现金流”。
>
> 本文面向：工程师 / 运营 / 财务。

---

## 口径结论（必须贯彻）

- **采用方案 A：不看阅读行为。**
- Champion 收入是**时间型订阅收入（按服务期覆盖日分摊）**，不是“当日是否阅读”的行为型收入。
- `champion_active_count` 表示**当日有效订阅用户数**，不是“当日阅读活跃 Champion 用户数”。

> 如果业务确实需要“Champion 阅读活跃用户数”，应另建指标，例如 `champion_reading_active_count`（读取 `reading_log` 等），不要混入本文口径。

---

## 字段定义（文档级字段说明）

### `novel_advanced_stats_daily.champion_revenue`

- **含义**：某小说在 `stat_date` 当天的 Champion 订阅收入（USD），按服务期覆盖日分摊后的“当日应计收入”。
- **数据源表**：`user_champion_subscription_record`
- **过滤条件**：
  - `payment_status = 'completed'`
  - `payment_amount > 0`
- **服务期覆盖判定**（半开区间交集）：
  - `start_date < dayEnd AND end_date > dayStart`
  - 其中 `dayStart = '${stat_date} 00:00:00'`，`dayEnd = '${next_date(stat_date)} 00:00:00'`
- **分摊公式**：
  - 单条记录当日分摊额 = `payment_amount / subscription_duration_days`
  - 当天收入 = 对覆盖当天的记录求和
  - 若 `subscription_duration_days` 为 `NULL/0`：该条分摊额按 **0** 处理（并在统计日志中 warn）

### `novel_advanced_stats_daily.champion_active_count`

- **含义**：某小说在 `stat_date` 当天的有效 Champion 订阅用户数（去重用户）。
- **数据源表**：`user_champion_subscription`
- **过滤条件**：
  - `is_active = 1`
- **服务期覆盖判定**（半开区间交集）：
  - `start_date < dayEnd AND end_date > dayStart`
- **计数**：
  - `COUNT(DISTINCT user_id)`

---

## 生产代码位置（可复现路径）

- **每日统计（写入 daily）**：`backend/services/novelAnalyticsService.js`
  - `computeDailyStatsForDate(statDate)`：计算 `champion_revenue` / `champion_active_count` 并 upsert 写入 `novel_advanced_stats_daily`
  - `startDailyStatsTask()`：每天 03:00（Asia/Shanghai）跑昨天的 daily + 重新计算综合评分
- **手动批量回算**：`backend/runNovelAnalyticsOnce.js`
  - 逐日调用 `manualTriggerDailyStats(dateStr)`（内部会跑 daily + overall）
- **对外接口**：
  - `GET /api/analytics/novels/:novelId/daily`：返回 daily 的 `champion_revenue/champion_active_count`
  - `GET /api/analytics/novels/:novelId/summary`：`total_champion_revenue` 来自 daily 的分摊求和累计（不是收款日现金流）

---

## 分摊示例（30 天订阅跨天覆盖）

假设有一条订阅记录（`user_champion_subscription_record`）：

- `payment_amount = 30.00`
- `subscription_duration_days = 30`
- 服务期：`start_date = 2025-12-01 10:00:00`，`end_date = 2025-12-31 10:00:00`
- `payment_status = 'completed'`

当统计 `stat_date = '2025-12-02'`：

- `dayStart = 2025-12-02 00:00:00`
- `dayEnd = 2025-12-03 00:00:00`
- 覆盖判定：`start_date < dayEnd` 且 `end_date > dayStart` ⇒ **该记录计入当日**
- 分摊额：`30 / 30 = 1.00`

> 关键点：哪怕用户当天没有阅读任何章节，只要服务期覆盖当天，仍会产生当日 `champion_revenue` 和 `champion_active_count`（时间型订阅口径）。

---

## 重要声明：严禁引入“按阅读行为过滤”

以下行为会改变口径，**禁止**：

- 在 `champion_revenue` 或 `champion_active_count` 的计算中 JOIN `reading_log` / `reading_history` / `chapter_read_log` 等阅读表
- 增加“当日阅读才计入”的条件（例如 `EXISTS (SELECT 1 FROM reading_log ...)`）
- 把 `champion_revenue` 改为按 `created_at` 聚合（那是现金流口径）

---

## 已知风险点提示（只提示，不改逻辑）

1) **subscription_duration_days 与真实日期差不一致**
   - daily 分摊使用 `subscription_duration_days` 做分母
   - 但后台某些拆分/结算逻辑可能使用“真实日期差（毫秒）”做更精确的分摊（两套口径并存）

2) **cron 的 stat_date 与时区**
   - cron 设置了 `Asia/Shanghai`
   - 但某些地方使用 `toISOString().split('T')[0]` 生成日期字符串（UTC 语义），需要注意跨日边界

3) **退款/订阅状态同步**
   - `payment_status` 从 completed → refunded 的同步是否可靠
   - `user_champion_subscription.is_active` 是否随取消/退款及时更新

4) **同一用户多条记录覆盖同日**
   - `champion_revenue`：多条覆盖会叠加（多买多计）
   - `champion_active_count`：按用户去重（同一用户当日只计 1）

---

## 手工校验（无测试框架时的最小校验）

### 1) 校验某小说某天的分摊收入（直接用源表重算）

```sql
-- 替换 :novel_id, :day_start, :day_end
SELECT
  COALESCE(
    SUM(
      CASE
        WHEN subscription_duration_days IS NULL OR subscription_duration_days = 0 THEN 0
        ELSE payment_amount / subscription_duration_days
      END
    ),
    0
  ) AS champion_revenue
FROM user_champion_subscription_record
WHERE novel_id = :novel_id
  AND payment_status = 'completed'
  AND payment_amount > 0
  AND start_date < :day_end
  AND end_date > :day_start;
```

### 2) 校验某小说某天的有效订阅用户数

```sql
SELECT COUNT(DISTINCT user_id) AS champion_active_count
FROM user_champion_subscription
WHERE novel_id = :novel_id
  AND is_active = 1
  AND start_date < :day_end
  AND end_date > :day_start;
```

### 3) 对比 daily 落库结果

```sql
SELECT stat_date, novel_id, champion_revenue, champion_active_count
FROM novel_advanced_stats_daily
WHERE novel_id = :novel_id
  AND stat_date = :stat_date;
```


