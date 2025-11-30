# reader_spending 表增加 chapter_id 字段 - 代码分析报告

## 一、确认数据库表结构

### 1. reader_spending 表结构

**文件位置**: `backend/create_commission_system_tables.sql` (第57-74行)

```sql
CREATE TABLE IF NOT EXISTS `reader_spending` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL COMMENT '读者用户ID',
  `novel_id` BIGINT NOT NULL COMMENT '小说ID',
  `karma_amount` INT NOT NULL DEFAULT 0 COMMENT '消费使用的karma数量（章节解锁时有）',
  `amount_usd` DECIMAL(20,8) NOT NULL COMMENT '换算后的美元金额（高精度）',
  `source_type` ENUM('chapter_unlock','subscription') NOT NULL COMMENT '来源类型',
  `source_id` BIGINT NOT NULL COMMENT '对应chapter_unlocks.id或subscription_record.id',
  `spend_time` DATETIME NOT NULL COMMENT '消费时间',
  `settlement_month` DATE NULL COMMENT '结算月份，如2025-10-01表示10月份',
  `settled` TINYINT NOT NULL DEFAULT 0 COMMENT '是否已结算',
  `settled_batch_id` BIGINT NULL COMMENT '结算批次ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_source` (`source_type`, `source_id`),
  KEY `idx_user_month` (`user_id`, `settlement_month`),
  KEY `idx_month_settled` (`settlement_month`, `settled`),
  KEY `idx_spend_time` (`spend_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='读者消费汇总表';
```

**字段说明**:
- `user_id`: 读者用户ID
- `novel_id`: 小说ID（通过 JOIN chapter 表获取）
- `karma_amount`: 消费使用的karma数量（章节解锁时才有值）
- `amount_usd`: 换算后的美元金额（高精度）
- `source_type`: 来源类型，枚举值：'chapter_unlock'（章节解锁）或 'subscription'（订阅）
- `source_id`: 对应 `chapter_unlocks.id` 或 `user_champion_subscription_record.id`
- `spend_time`: 消费时间
- `settlement_month`: 结算月份
- **注意**: 当前表结构**没有 `chapter_id` 字段**，也没有 `volume_id` 字段

---

### 2. chapter_unlocks 表结构

**文件位置**: `backend/create_chapter_unlock_tables.js` (第59-76行)

```sql
CREATE TABLE IF NOT EXISTS chapter_unlocks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  chapter_id INT NOT NULL,  -- ✅ 有 chapter_id 字段
  unlock_method ENUM('free', 'key', 'karma', 'subscription', 'auto_unlock') NOT NULL,
  cost INT DEFAULT 0 COMMENT '实际花费的钥匙或业力数量',
  unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
  FOREIGN KEY (chapter_id) REFERENCES chapter(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_chapter (user_id, chapter_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

**关键字段**:
- `chapter_id`: **章节ID（直接存在）** ✅
- `user_id`: 用户ID
- `unlock_method`: 解锁方式（'karma' 表示用业力解锁）
- `cost`: 实际花费的业力数量
- `unlocked_at`: 解锁时间

**关联关系**:
- `chapter_unlocks.chapter_id` → `chapter.id`
- `chapter.novel_id` → `novel.id`（通过 JOIN 获取）

---

### 3. user_champion_subscription_record 表结构

**文件位置**: `backend/database/user_champion_subscription_record.sql` (第3-60行)

```sql
CREATE TABLE IF NOT EXISTS `user_champion_subscription_record` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `novel_id` int(11) NOT NULL COMMENT '小说ID',
  `payment_record_id` int(11) NOT NULL COMMENT '关联的payment_record表ID',
  `tier_level` int(2) NOT NULL COMMENT '订阅等级',
  `tier_name` varchar(50) NOT NULL COMMENT '订阅等级名称',
  `monthly_price` decimal(10,2) NOT NULL COMMENT '月费价格',
  `payment_amount` decimal(10,2) NOT NULL COMMENT '实际支付金额',
  `payment_method` varchar(20) NOT NULL COMMENT '支付方式',
  `payment_status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '支付状态',
  `subscription_type` varchar(20) NOT NULL DEFAULT 'new' COMMENT '订阅类型',
  `subscription_duration_months` int(3) NOT NULL DEFAULT 1 COMMENT '订阅时长(月)',
  `start_date` datetime NOT NULL COMMENT '订阅开始时间',
  `end_date` datetime NOT NULL COMMENT '订阅结束时间',
  ...
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_novel_id` (`novel_id`),
  ...
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户Champion订阅支付记录表';
```

**关键字段**:
- `user_id`: 用户ID
- `novel_id`: **小说ID（存在）** ✅
- `payment_amount`: 实际支付金额
- `start_date` / `end_date`: 订阅时间范围
- **注意**: 该表**没有 `chapter_id` 字段**，因为订阅是针对整本小说的，不是针对单个章节

**与 reader_spending 的关联**:
- `user_champion_subscription_record.id` → `reader_spending.source_id` (当 `source_type='subscription'` 时)

---

## 二、查找「生成 reader_spending 数据」的后端逻辑

### 1. 全局搜索 reader_spending 出现的文件

**文件列表**:
1. `backend/routes/admin.js` - **主要插入和查询逻辑**
2. `backend/routes/writer.js` - 可能包含查询逻辑
3. `backend/create_commission_system_tables.sql` - 表结构定义
4. `backend/migrations/001_high_precision_amount_fields.sql` - 迁移脚本
5. `backend/docs/READER_INCOME_STATS_EXPLANATION.md` - 文档说明
6. `backend/COMMISSION_SYSTEM_README.md` - 文档说明
7. `sql-query/reader_spending.sql` - 查询脚本

---

### 2. 插入 reader_spending 的逻辑

**唯一插入位置**: `backend/routes/admin.js`

#### 函数1: `POST /api/admin/generate-reader-spending`

**文件位置**: `backend/routes/admin.js` 第1635-1787行

**功能**: 生成基础收入数据（reader_spending），从两个来源生成：
- **来源A**: `chapter_unlocks` 表（章节解锁）
- **来源B**: `user_champion_subscription_record` 表（订阅）

**完整代码**:

```javascript
router.post('/generate-reader-spending', authenticateAdmin, async (req, res) => {
  // ... 省略前面的代码 ...
  
  // Step 1: 从 chapter_unlocks 表生成数据
  const [chapterUnlocks] = await db.execute(
    `SELECT 
      cu.id,
      cu.user_id,
      cu.chapter_id,  -- ✅ 查询中已经获取了 chapter_id
      cu.cost as karma_amount,
      cu.unlocked_at,
      c.novel_id     -- ✅ 通过 JOIN chapter 表获取 novel_id
    FROM chapter_unlocks cu
    INNER JOIN chapter c ON cu.chapter_id = c.id
    WHERE cu.unlocked_at >= ? 
      AND cu.unlocked_at < ?
      AND cu.unlock_method = 'karma'
      AND cu.cost > 0
    ORDER BY cu.unlocked_at`,
    [monthStart, monthEnd]
  );
  
  for (const unlock of chapterUnlocks) {
    // ... 计算汇率和金额 ...
    
    // 插入 reader_spending
    await db.execute(
      `INSERT INTO reader_spending 
       (user_id, novel_id, karma_amount, amount_usd, source_type, source_id, spend_time, settlement_month)
       VALUES (?, ?, ?, ?, 'chapter_unlock', ?, ?, ?)`,
      [
        unlock.user_id,
        unlock.novel_id,
        unlock.karma_amount,
        amountUsd.toNumber(),
        unlock.id,              // source_id = chapter_unlocks.id
        unlock.unlocked_at,
        settlementMonth
      ]
    );
    // ⚠️ 注意：这里没有插入 chapter_id，但 unlock.chapter_id 是可用的！
  }
  
  // Step 2: 从 user_champion_subscription_record 表生成数据
  const [subscriptions] = await db.execute(
    `SELECT 
      id,
      user_id,
      novel_id,
      payment_amount as amount_usd,
      created_at as spend_time
    FROM user_champion_subscription_record
    WHERE created_at >= ? 
      AND created_at < ?
      AND payment_status = 'completed'
      AND payment_amount > 0
    ORDER BY created_at`,
    [monthStart, monthEnd]
  );
  
  for (const sub of subscriptions) {
    // 插入 reader_spending
    await db.execute(
      `INSERT INTO reader_spending 
       (user_id, novel_id, karma_amount, amount_usd, source_type, source_id, spend_time, settlement_month)
       VALUES (?, ?, 0, ?, 'subscription', ?, ?, ?)`,
      [
        sub.user_id,
        sub.novel_id,
        amountUsd.toNumber(),
        sub.id,                 // source_id = user_champion_subscription_record.id
        sub.spend_time,
        settlementMonth
      ]
    );
    // ⚠️ 注意：订阅记录没有 chapter_id，应该设为 NULL
  }
});
```

**调用位置**: 
- 管理员后台手动触发：`POST /api/admin/generate-reader-spending`
- 前端页面：基础收入统计页面（`frontend/src/pages/AdminPanel/BaseIncome/index.tsx`）

**当前字段关联**:
- **从 chapter_unlocks 生成时**:
  - `user_id` ← `chapter_unlocks.user_id`
  - `novel_id` ← `chapter.novel_id` (通过 JOIN 获取)
  - `source_id` ← `chapter_unlocks.id`
  - **`chapter_id`**: ❌ **未插入，但 `unlock.chapter_id` 可用**
  
- **从 user_champion_subscription_record 生成时**:
  - `user_id` ← `user_champion_subscription_record.user_id`
  - `novel_id` ← `user_champion_subscription_record.novel_id`
  - `source_id` ← `user_champion_subscription_record.id`
  - **`chapter_id`**: ❌ **未插入，且订阅记录本身没有 chapter_id**

---

## 三、区分两条来源：chapter_unlocks 和 user_champion_subscription_record

### 1. 从 chapter_unlocks 生成 reader_spending

**函数**: `POST /api/admin/generate-reader-spending` (Step 1)

**代码位置**: `backend/routes/admin.js` 第1670-1725行

**当前实现**:
```javascript
// 查询 chapter_unlocks，已经获取了 chapter_id
const [chapterUnlocks] = await db.execute(
  `SELECT 
    cu.id,
    cu.user_id,
    cu.chapter_id,        -- ✅ 已查询到 chapter_id
    cu.cost as karma_amount,
    cu.unlocked_at,
    c.novel_id            -- ✅ 通过 JOIN 获取 novel_id
  FROM chapter_unlocks cu
  INNER JOIN chapter c ON cu.chapter_id = c.id
  WHERE ...
`);
```

**插入时**:
```javascript
await db.execute(
  `INSERT INTO reader_spending 
   (user_id, novel_id, karma_amount, amount_usd, source_type, source_id, spend_time, settlement_month)
   VALUES (?, ?, ?, ?, 'chapter_unlock', ?, ?, ?)`,
  [
    unlock.user_id,
    unlock.novel_id,
    unlock.karma_amount,
    amountUsd.toNumber(),
    unlock.id,              // source_id
    unlock.unlocked_at,
    settlementMonth
  ]
);
// ⚠️ unlock.chapter_id 没有被使用，但它是可用的！
```

**结论**: 
- ✅ **`chapter_id` 可以直接从 `unlock.chapter_id` 获取**
- ✅ 数据流：`chapter_unlocks.chapter_id` → 可以直接插入到 `reader_spending.chapter_id`

---

### 2. 从 user_champion_subscription_record 生成 reader_spending

**函数**: `POST /api/admin/generate-reader-spending` (Step 2)

**代码位置**: `backend/routes/admin.js` 第1727-1764行

**当前实现**:
```javascript
// 查询 user_champion_subscription_record
const [subscriptions] = await db.execute(
  `SELECT 
    id,
    user_id,
    novel_id,              -- ✅ 只有 novel_id，没有 chapter_id
    payment_amount as amount_usd,
    created_at as spend_time
  FROM user_champion_subscription_record
  WHERE ...
`);
```

**插入时**:
```javascript
await db.execute(
  `INSERT INTO reader_spending 
   (user_id, novel_id, karma_amount, amount_usd, source_type, source_id, spend_time, settlement_month)
   VALUES (?, ?, 0, ?, 'subscription', ?, ?, ?)`,
  [
    sub.user_id,
    sub.novel_id,
    amountUsd.toNumber(),
    sub.id,                 // source_id
    sub.spend_time,
    settlementMonth
  ]
);
// ⚠️ 订阅记录没有 chapter_id，应该设为 NULL
```

**结论**: 
- ❌ **订阅记录本身没有 `chapter_id`**（订阅是针对整本小说的）
- ✅ **应该将 `chapter_id` 设为 `NULL`**

---

## 四、前端/统计使用情况梳理

### 1. 读取 reader_spending 的接口

#### 接口1: `GET /api/admin/reader-spending`

**文件位置**: `backend/routes/admin.js` 第1790-1874行

**功能**: 获取基础收入数据（reader_spending）的汇总和明细

**查询逻辑**:
```javascript
// 汇总统计
const [summary] = await db.execute(
  `SELECT 
    COUNT(*) as total_count,
    COALESCE(SUM(amount_usd), 0) as total_amount_usd,
    SUM(CASE WHEN source_type = 'chapter_unlock' THEN 1 ELSE 0 END) as chapter_unlock_count,
    SUM(CASE WHEN source_type = 'subscription' THEN 1 ELSE 0 END) as subscription_count,
    ...
  FROM reader_spending
  WHERE settlement_month = ?`,
  [settlementMonth]
);

// 详细列表
const [details] = await db.execute(
  `SELECT 
    rs.*,
    u.username,
    u.pen_name,
    n.title as novel_title
  FROM reader_spending rs
  LEFT JOIN user u ON rs.user_id = u.id
  LEFT JOIN novel n ON rs.novel_id = n.id
  WHERE rs.settlement_month = ?
  ORDER BY rs.spend_time DESC
  LIMIT 1000`,
  [settlementMonth]
);
```

**统计维度**:
- ✅ 按月份 (`settlement_month`)
- ✅ 按来源类型 (`source_type`)
- ✅ 按用户 (`user_id`)
- ✅ 按小说 (`novel_id`)
- ❌ **目前没有按章节 (`chapter_id`) 统计**

---

#### 接口2: `GET /api/admin/reader-income-stats`

**文件位置**: `backend/routes/admin.js` 第1424-1632行

**功能**: 获取读者收入统计（包含 reader_spending 的汇总）

**查询逻辑**:
```javascript
// 读者消费汇总
let spendingQuery = `
  SELECT 
    rs.user_id,
    u.username,
    u.pen_name,
    COALESCE(SUM(rs.amount_usd), 0) as total_spending_usd,
    COUNT(*) as spending_count
  FROM reader_spending rs
  LEFT JOIN user u ON rs.user_id = u.id
  WHERE rs.settlement_month = ?
  GROUP BY rs.user_id, u.username, u.pen_name
  ORDER BY total_spending_usd DESC
`;
```

**统计维度**:
- ✅ 按用户分组汇总
- ❌ **没有按章节维度统计**

---

#### 接口3: 生成作者基础收入 (`POST /api/admin/author-royalty/generate`)

**文件位置**: `backend/routes/admin.js` 第2040-2186行

**功能**: 从 `reader_spending` 生成 `author_royalty`

**查询逻辑**:
```javascript
const [spendings] = await db.execute(
  `SELECT 
    rs.id,
    rs.user_id,
    rs.novel_id,        -- ✅ 只用到 novel_id
    rs.amount_usd,
    rs.spend_time
  FROM reader_spending rs
  WHERE rs.settlement_month = ?
  ORDER BY rs.spend_time`,
  [settlementMonth]
);
```

**使用字段**:
- ✅ `novel_id` - 用于查找作者和合同
- ❌ **没有使用 `chapter_id`**

---

#### 接口4: 生成推广佣金 (`POST /api/admin/commission-transaction/generate`)

**文件位置**: `backend/routes/admin.js` 第2356-2646行

**功能**: 从 `reader_spending` 生成 `commission_transaction`

**查询逻辑**:
```javascript
const [spendings] = await db.execute(
  `SELECT 
    rs.id,
    rs.user_id,
    rs.novel_id,        -- ✅ 只用到 novel_id
    rs.amount_usd,
    rs.spend_time
  FROM reader_spending rs
  WHERE rs.settlement_month = ?
  ORDER BY rs.spend_time`,
  [settlementMonth]
);
```

**使用字段**:
- ✅ `novel_id` - 用于记录推广的小说
- ❌ **没有使用 `chapter_id`**

---

### 2. 现有统计/页面依赖情况

**当前统计维度**:
- ✅ 按用户 (`user_id`)
- ✅ 按小说 (`novel_id`)
- ✅ 按月份 (`settlement_month`)
- ✅ 按来源类型 (`source_type`)
- ❌ **没有按章节 (`chapter_id`) 统计**

**前端页面**:
- `frontend/src/pages/AdminPanel/BaseIncome/index.tsx` - 基础收入统计页面
  - 显示：用户、小说、金额、来源类型
  - ❌ **没有显示章节信息**

**结论**: 
- ✅ **现有代码不依赖 `chapter_id` 字段**
- ✅ **添加 `chapter_id` 字段不会破坏现有功能**
- ✅ **未来可以基于 `chapter_id` 做章节维度的统计**

---

## 五、综合分析 & 输出总结

### 1. 当前 reader_spending 表结构概况

**当前状态**:
- ❌ **没有 `chapter_id` 字段**
- ✅ 有 `novel_id` 字段（通过 JOIN chapter 表获取）
- ✅ 有 `source_type` 和 `source_id` 字段（可以间接关联到章节）

**数据来源**:
- **来源A**: `chapter_unlocks` 表（章节解锁）
  - `source_type = 'chapter_unlock'`
  - `source_id = chapter_unlocks.id`
  - ✅ **`chapter_unlocks.chapter_id` 可以直接使用**
  
- **来源B**: `user_champion_subscription_record` 表（订阅）
  - `source_type = 'subscription'`
  - `source_id = user_champion_subscription_record.id`
  - ❌ **订阅记录没有 `chapter_id`，应该设为 NULL**

---

### 2. 具体函数/接口清单

#### A. 从 chapter_unlocks 生成 reader_spending

**函数**: `POST /api/admin/generate-reader-spending` (Step 1)

**文件位置**: `backend/routes/admin.js` 第1670-1725行

**当前实现**:
- ✅ 查询时已经获取了 `cu.chapter_id`
- ❌ 插入时没有使用 `unlock.chapter_id`
- ✅ **可以直接使用 `unlock.chapter_id` 插入到 `reader_spending.chapter_id`**

**修改点**:
```javascript
// 需要修改 INSERT 语句，添加 chapter_id 字段
await db.execute(
  `INSERT INTO reader_spending 
   (user_id, novel_id, chapter_id, karma_amount, amount_usd, source_type, source_id, spend_time, settlement_month)
   VALUES (?, ?, ?, ?, ?, 'chapter_unlock', ?, ?, ?)`,
  [
    unlock.user_id,
    unlock.novel_id,
    unlock.chapter_id,      // ✅ 新增：直接使用查询到的 chapter_id
    unlock.karma_amount,
    amountUsd.toNumber(),
    unlock.id,
    unlock.unlocked_at,
    settlementMonth
  ]
);
```

---

#### B. 从 user_champion_subscription_record 生成 reader_spending

**函数**: `POST /api/admin/generate-reader-spending` (Step 2)

**文件位置**: `backend/routes/admin.js` 第1727-1764行

**当前实现**:
- ❌ 订阅记录本身没有 `chapter_id`
- ✅ **应该将 `chapter_id` 设为 `NULL`**

**修改点**:
```javascript
// 需要修改 INSERT 语句，添加 chapter_id 字段（设为 NULL）
await db.execute(
  `INSERT INTO reader_spending 
   (user_id, novel_id, chapter_id, karma_amount, amount_usd, source_type, source_id, spend_time, settlement_month)
   VALUES (?, ?, NULL, 0, ?, 'subscription', ?, ?, ?)`,
  [
    sub.user_id,
    sub.novel_id,
    null,                   // ✅ 新增：订阅记录没有 chapter_id，设为 NULL
    amountUsd.toNumber(),
    sub.id,
    sub.spend_time,
    settlementMonth
  ]
);
```

---

### 3. 现成的 chapter_id 可用性分析

**从 chapter_unlocks 生成时**:
- ✅ **有现成的 `chapter_id`**: `unlock.chapter_id` 可以直接使用
- ✅ 数据流：`chapter_unlocks.chapter_id` → `reader_spending.chapter_id`

**从 user_champion_subscription_record 生成时**:
- ❌ **没有现成的 `chapter_id`**: 订阅是针对整本小说的，不是针对单个章节
- ✅ **应该设为 `NULL`**

---

### 4. 需要修改的函数清单

#### 必须修改的函数

**函数1**: `POST /api/admin/generate-reader-spending`
- **文件**: `backend/routes/admin.js` 第1635-1787行
- **修改点1** (Step 1 - chapter_unlocks):
  - 修改 INSERT 语句，添加 `chapter_id` 字段
  - 使用 `unlock.chapter_id` 作为值
- **修改点2** (Step 2 - subscription):
  - 修改 INSERT 语句，添加 `chapter_id` 字段
  - 使用 `NULL` 作为值

---

#### 可选修改的函数（用于查询/统计）

**函数2**: `GET /api/admin/reader-spending`
- **文件**: `backend/routes/admin.js` 第1790-1874行
- **说明**: 查询接口，可以添加 `chapter_id` 到返回结果中（如果需要显示章节信息）

**函数3**: `GET /api/admin/reader-income-stats`
- **文件**: `backend/routes/admin.js` 第1424-1632行
- **说明**: 统计接口，目前不依赖 `chapter_id`，可以保持不变

**函数4**: `POST /api/admin/author-royalty/generate`
- **文件**: `backend/routes/admin.js` 第2040-2186行
- **说明**: 生成作者收入，目前不依赖 `chapter_id`，可以保持不变

**函数5**: `POST /api/admin/commission-transaction/generate`
- **文件**: `backend/routes/admin.js` 第2356-2646行
- **说明**: 生成推广佣金，目前不依赖 `chapter_id`，可以保持不变

---

### 5. 总结

**当前状态**:
- ✅ `reader_spending` 表没有 `chapter_id` 字段
- ✅ 从 `chapter_unlocks` 生成时，`chapter_id` 是可用的（已查询但未使用）
- ✅ 从 `user_champion_subscription_record` 生成时，应该将 `chapter_id` 设为 `NULL`

**需要修改的地方**:
1. **数据库迁移**: 添加 `chapter_id` 字段（允许 NULL）
2. **插入逻辑**: 
   - `POST /api/admin/generate-reader-spending` (Step 1) - 添加 `chapter_id`，使用 `unlock.chapter_id`
   - `POST /api/admin/generate-reader-spending` (Step 2) - 添加 `chapter_id`，使用 `NULL`

**不需要修改的地方**:
- ✅ 现有查询/统计接口不依赖 `chapter_id`，可以保持不变
- ✅ 前端页面不显示章节信息，可以保持不变

**未来扩展**:
- ✅ 可以基于 `chapter_id` 做章节维度的统计
- ✅ 可以在前端显示章节信息
- ✅ 可以分析哪些章节最受欢迎（消费最多）

---

## 附录：相关文件清单

### 数据库表结构文件
- `backend/create_commission_system_tables.sql` - reader_spending 表定义
- `backend/create_chapter_unlock_tables.js` - chapter_unlocks 表定义
- `backend/database/user_champion_subscription_record.sql` - user_champion_subscription_record 表定义

### 后端代码文件
- `backend/routes/admin.js` - 主要插入和查询逻辑
  - 第1635-1787行: `POST /api/admin/generate-reader-spending` - **需要修改**
  - 第1790-1874行: `GET /api/admin/reader-spending` - 可选修改
  - 第1424-1632行: `GET /api/admin/reader-income-stats` - 不需要修改
  - 第2040-2186行: `POST /api/admin/author-royalty/generate` - 不需要修改
  - 第2356-2646行: `POST /api/admin/commission-transaction/generate` - 不需要修改

### 前端代码文件
- `frontend/src/pages/AdminPanel/BaseIncome/index.tsx` - 基础收入统计页面（可选：未来可以显示章节信息）

### 文档文件
- `backend/docs/READER_INCOME_STATS_EXPLANATION.md` - 数据流说明文档

