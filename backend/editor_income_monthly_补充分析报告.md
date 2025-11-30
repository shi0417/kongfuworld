# editor_income_monthly 补充分析报告（精准摸底）

**生成时间**：2025-11-29  
**分析目标**：围绕新业务需求（按字数分配、一条 reader_spending 一条基础记录、同一月允许多条）精准分析现有代码实现

**参考报告**：
- 《编辑基础收入-4页面现状分析报告》
- 《editor_income_monthly 表结构与代码使用现状分析报告》

---

## 一、subscription 分配逻辑现状：按章节数还是按字数？是否按 reader_spending 逐条分配？

### 1.1 当前实现：按章节数量分配，不是按字数

**代码位置**：`backend/services/editorBaseIncomeService.js` 第 147-191 行（订阅章节统计缓存）

**关键代码片段**：

```javascript
// 第 154-159 行：查询章节时只查询了 editor_admin_id 和 chief_editor_admin_id，没有查询 word_count
const [subChapters] = await db.query(
  `SELECT novel_id, editor_admin_id, chief_editor_admin_id
   FROM chapter
   WHERE novel_id IN (?) AND is_released = 1`,
  [subscriptionNovelIds]
);

// 第 165-181 行：统计的是章节数量，不是字数
const totalChapterCount = novelChapters.filter(ch => 
  ch.editor_admin_id !== null || ch.chief_editor_admin_id !== null
).length;

// 统计各编辑的章节数（不是字数）
const editorCounts = new Map();
const chiefCounts = new Map();

for (const ch of novelChapters) {
  if (ch.editor_admin_id !== null) {
    editorCounts.set(ch.editor_admin_id, (editorCounts.get(ch.editor_admin_id) || 0) + 1);
  }
  if (ch.chief_editor_admin_id !== null) {
    chiefCounts.set(ch.chief_editor_admin_id, (chiefCounts.get(ch.chief_editor_admin_id) || 0) + 1);
  }
}
```

**结论**：
- ❌ **当前使用章节数量**：`editorCounts` 和 `chiefCounts` 存储的是每个编辑/主编负责的**章节数量**
- ❌ **没有使用 word_count**：查询章节时没有查询 `word_count` 字段，也没有按字数汇总

### 1.2 订阅分配计算逻辑

**代码位置**：`backend/services/editorBaseIncomeService.js` 第 281-385 行（订阅逻辑）

**关键代码片段**：

```javascript
// 第 282 行：按每条 reader_spending 逐条处理
for (const spending of subscriptionSpendings) {
  // ...
  const amount = new Decimal(spending.amount_usd);
  
  // 第 314 行：计算编辑池总额
  const editorPool = amount.mul(totalEditorPercent);
  
  // 第 319-322 行：使用章节数量比例
  const editorChapterCount = chapterStats.editorCounts.get(editorId) || 0;
  if (editorChapterCount > 0) {
    const editorRatio = new Decimal(editorChapterCount).div(chapterStats.total);
    // 第 324 行：按章节数比例分配
    const editorIncome = editorPool.mul(new Decimal(ec.share_percent).div(totalEditorPercent)).mul(editorRatio);
  }
}
```

**分配公式**（当前实现）：
```
编辑收入 = 订阅金额 × 编辑合同比例 × (该编辑章节数 / 总章节数)
```

**结论**：
- ✅ **按每条 reader_spending 逐条处理**：第 282 行的 `for (const spending of subscriptionSpendings)` 循环逐条处理每条订阅记录
- ❌ **使用章节数量比例**：第 322 行使用 `editorChapterCount / chapterStats.total` 作为比例，这是章节数量比例，不是字数比例

### 1.3 多条 subscription 记录的聚合方式

**代码位置**：`backend/services/editorBaseIncomeService.js` 第 326-337 行、第 458-498 行

**关键代码片段**：

```javascript
// 第 326-337 行：调用 addToAggregation，聚合到 (editorId, novelId, sourceType, role)
this.addToAggregation(
  agg,
  editorId,
  novelId,
  'subscription',
  'editor',
  amount, // grossAmountUsd 使用总金额
  editorIncome,
  chapterStats.total,
  editorChapterCount,
  new Decimal(ec.share_percent)
);

// 第 458-498 行：addToAggregation 方法
addToAggregation(agg, editorId, novelId, sourceType, role, grossAmountUsd, editorIncomeUsd, chapterCountTotal, chapterCountEditor, contractSharePercent) {
  // ... 建立嵌套 Map 结构 ...
  // key: editor_admin_id -> novel_id -> source_type -> role
  
  const data = roleMap.get(role);
  data.grossAmountUsd = data.grossAmountUsd.plus(grossAmountUsd);  // 累加
  data.editorIncomeUsd = data.editorIncomeUsd.plus(editorIncomeUsd);  // 累加
  // ...
}
```

**聚合维度**：
- 内存聚合 key：`(editor_admin_id, novel_id, source_type, role)`
- **没有 reader_spending.id 维度**

**结论**：
- ⚠️ **按小说维度聚合**：虽然按每条 reader_spending 逐条处理，但在 `addToAggregation` 时会把多条 spending 聚合到同一个 `(editorId, novelId, sourceType, role)` 组合
- ⚠️ **丢失 reader_spending 维度**：最终写入 `editor_income_monthly` 时，无法区分不同 `reader_spending.id` 的记录
- ⚠️ **示例**：同一编辑在同一小说同一月份有两条订阅（10.15~11.15 和 11.15~12.14），会被合并成一条 `editor_income_monthly` 记录

### 1.4 当前实现与新需求的差距

**新需求**：
- 按字数分配：`(words_editor_2 / total_words) * 10 * 5%`
- 一条 reader_spending 一条基础记录：同一 editor+novel+month 允许多条记录

**当前实现**：
- ❌ 按章节数量分配：`(editorChapterCount / totalChapterCount) * amount * sharePercent`
- ❌ 多条 reader_spending 被合并：聚合到 `(editorId, novelId, sourceType, role)` 后写入，丢失 reader_spending.id 维度

**差距总结**：
1. **权重计算方式**：需要从章节数量改为字数汇总
2. **聚合维度**：需要保留 reader_spending.id 维度，不能合并
3. **数据库唯一约束**：当前 `UNIQUE(editor_admin_id, novel_id, month)` 会强制合并，需要修改

---

## 二、chapter_unlock 分配逻辑现状：是否按 reader_spending 逐条分配？是否使用 word_count？

### 2.1 当前实现：按每条 reader_spending 逐条处理

**代码位置**：`backend/services/editorBaseIncomeService.js` 第 197-279 行（章节解锁逻辑）

**关键代码片段**：

```javascript
// 第 198 行：按每条 reader_spending 逐条处理
for (const spending of chapterUnlockSpendings) {
  // 第 200-212 行：通过 source_id 关联 chapter_unlocks → chapter
  const unlockId = spending.source_id;
  const chapterId = chapterUnlockMap.get(unlockId);
  const chapter = chapterMap.get(chapterId);
  
  // 第 224 行：获取消费金额
  const amount = new Decimal(spending.amount_usd);
  
  // 第 232-234 行：直接按合同比例计算，没有使用 word_count
  if (editorContract && editorContract.share_percent) {
    const sharePercent = new Decimal(editorContract.share_percent);
    const editorIncome = amount.mul(sharePercent);  // 直接相乘，没有考虑字数
  }
}
```

**结论**：
- ✅ **按每条 reader_spending 逐条处理**：第 198 行的循环逐条处理每条章节解锁记录
- ✅ **按章节维度分配**：每条记录对应一个章节，根据 `chapter.editor_admin_id` 和 `chapter.chief_editor_admin_id` 分配

### 2.2 word_count 字段的查询与使用情况

**代码位置**：`backend/services/editorBaseIncomeService.js` 第 104-145 行（章节信息缓存）

**关键代码片段**：

```javascript
// 第 122-127 行：查询章节时查询了 word_count
const [chapters] = await db.query(
  `SELECT id, novel_id, editor_admin_id, chief_editor_admin_id, word_count
   FROM chapter
   WHERE id IN (?)`,
  [chapterIds]
);

// 第 134-141 行：保存到 chapterMap，但后续没有使用
for (const ch of chapters) {
  chapterMap.set(ch.id, {
    editor_admin_id: ch.editor_admin_id,
    chief_editor_admin_id: ch.chief_editor_admin_id,
    word_count: ch.word_count || 0,  // 虽然保存了，但没有使用
    novel_id: ch.novel_id
  });
}
```

**结论**：
- ⚠️ **查询了 word_count**：第 123 行的 SQL 查询包含了 `word_count` 字段
- ❌ **没有使用 word_count**：虽然保存到 `chapterMap`，但在分配计算时（第 234 行）直接使用 `amount.mul(sharePercent)`，没有考虑字数
- ✅ **符合新需求**：章节解锁按单条记录分配，每条记录对应一个章节，不需要按字数权重

### 2.3 chapter_unlock 的聚合方式

**代码位置**：`backend/services/editorBaseIncomeService.js` 第 236-247 行、第 458-498 行

**关键代码片段**：

```javascript
// 第 236-247 行：调用 addToAggregation
this.addToAggregation(
  agg,
  chapter.editor_admin_id,
  spending.novel_id,
  'chapter_unlock',
  'editor',
  amount,
  editorIncome,
  0, // chapterCountTotal
  0, // chapterCountEditor
  sharePercent
);

// addToAggregation 会把多条 spending 聚合到同一个 (editorId, novelId, sourceType, role)
```

**聚合维度**：
- 内存聚合 key：`(editor_admin_id, novel_id, source_type, role)`
- **没有 reader_spending.id 维度**

**结论**：
- ⚠️ **按小说维度聚合**：虽然按每条 reader_spending 逐条处理，但在 `addToAggregation` 时会把多条 spending 聚合到同一个 `(editorId, novelId, sourceType, role)` 组合
- ⚠️ **丢失 reader_spending 维度**：最终写入 `editor_income_monthly` 时，无法区分不同 `reader_spending.id` 的记录
- ⚠️ **示例**：同一编辑在同一小说同一月份有 10 笔章节解锁，会被合并成一条 `editor_income_monthly` 记录

### 2.4 当前实现与新需求的差距

**新需求**：
- 一条 reader_spending 一条基础记录：同一 editor+novel+month 允许多条记录

**当前实现**：
- ✅ 按每条 reader_spending 逐条处理
- ✅ 按章节维度分配（符合需求）
- ❌ 多条 reader_spending 被合并：聚合到 `(editorId, novelId, sourceType, role)` 后写入，丢失 reader_spending.id 维度

**差距总结**：
1. **聚合维度**：需要保留 reader_spending.id 维度，不能合并
2. **数据库唯一约束**：当前 `UNIQUE(editor_admin_id, novel_id, month)` 会强制合并，需要修改

---

## 三、editor_income_monthly 是否已经有"来源维度"和"字数维度"的字段及其实际使用情况

### 3.1 当前表结构（基于数据库实际查询）

**所有字段列表**：
```
- id (int) - 主键
- editor_admin_id (int) - 编辑ID
- role (enum) - 角色
- novel_id (int) - 小说ID
- month (date) - 结算月份
- source_type (enum) - 来源类型（chapter_unlock/subscription/mixed）
- chapter_count_total (int) - 总章节数
- chapter_count_editor (int) - 编辑章节数
- gross_book_income_usd (decimal) - 作品总收入
- editor_share_percent (decimal) - 实际分成比例
- contract_share_percent (decimal) - 合同分成比例
- editor_income_usd (decimal) - 编辑收入
- created_at (datetime)
- updated_at (datetime)
```

### 3.2 来源维度字段检查

**检查结果**：
- ❌ **没有 `source_spend_id` 字段**：当前表中没有任何字段用来保存 `reader_spending.id`
- ❌ **没有批次ID字段**：没有"批次 ID / 生成任务 ID / 其他可以区分多次生成的 key"
- ✅ **有 `source_type` 字段**：可以区分章节解锁和订阅，但无法区分同一类型的不同 `reader_spending` 记录

**代码检查**：
- `backend/services/editorBaseIncomeService.js` 第 65 行：查询 `reader_spending` 时查询了 `id` 字段
- `backend/services/editorBaseIncomeService.js` 第 404-407 行：INSERT 语句中**没有包含 `source_spend_id` 字段**
- 所有写入逻辑中，都没有保存 `reader_spending.id`

**结论**：
- ❌ **当前无法追溯到 reader_spending 记录**：`editor_income_monthly` 表中没有任何字段保存来源的 `reader_spending.id`
- ⚠️ **只能按月份+小说+编辑聚合查看**：无法区分同一编辑在同一小说同一月份的不同 `reader_spending` 记录

### 3.3 字数维度字段检查

**检查结果**：
- ❌ **没有字数统计字段**：当前表中没有 `total_word_count`、`editor_word_count`、`chief_word_count` 等字段
- ✅ **有章节数量字段**：`chapter_count_total` 和 `chapter_count_editor` 存储的是章节数量，不是字数

**代码检查**：
- `backend/services/editorBaseIncomeService.js` 第 123 行：查询章节时查询了 `word_count` 字段
- `backend/services/editorBaseIncomeService.js` 第 138 行：保存到 `chapterMap`，但**没有使用**
- `backend/services/editorBaseIncomeService.js` 第 154-159 行：订阅章节统计时**没有查询 `word_count`**
- `backend/services/editorBaseIncomeService.js` 第 404-407 行：INSERT 语句中**没有包含字数字段**

**结论**：
- ❌ **当前没有字数统计字段**：`editor_income_monthly` 表中只有章节数量字段，没有字数统计字段
- ❌ **代码中没有使用字数**：虽然章节解锁查询了 `word_count`，但没有使用；订阅分配完全没有查询 `word_count`

### 3.4 字段实际使用情况总结

| 字段名 | 是否存在 | 实际使用情况 | 是否符合新需求 |
|--------|---------|------------|---------------|
| `source_spend_id` | ❌ 不存在 | - | ❌ 需要新增 |
| `total_word_count` | ❌ 不存在 | - | ❌ 需要新增（subscription 用） |
| `editor_word_count` | ❌ 不存在 | - | ❌ 需要新增（subscription 用） |
| `source_type` | ✅ 存在 | 已使用，区分章节解锁/订阅 | ✅ 符合需求 |
| `role` | ✅ 存在 | 已使用，区分编辑/主编 | ✅ 符合需求 |
| `chapter_count_total` | ✅ 存在 | 已使用，存储章节数量 | ⚠️ 订阅需要改为字数 |
| `chapter_count_editor` | ✅ 存在 | 已使用，存储章节数量 | ⚠️ 订阅需要改为字数 |
| `contract_share_percent` | ✅ 存在 | 已使用，存储合同比例 | ✅ 符合需求 |

---

## 四、唯一约束 (editor_admin_id, novel_id, month) 对当前逻辑的实际影响，再确认

### 4.1 当前唯一约束确认

**数据库查询结果**（基于之前的分析报告）：
```sql
UNIQUE KEY `uniq_editor_month_novel` (`editor_admin_id`,`novel_id`,`month`)
```

**确认**：
- ✅ **唯一约束仍然是 `(editor_admin_id, novel_id, month)`**：数据库中没有其他 UNIQUE KEY
- ✅ **所有 INSERT ... ON DUPLICATE KEY UPDATE 都依赖这个唯一键**：不会通过其他字段触发冲突

### 4.2 唯一约束对当前逻辑的实际影响

**代码位置**：`backend/services/editorBaseIncomeService.js` 第 403-426 行（写入逻辑）

**关键代码片段**：

```javascript
await db.execute(
  `INSERT INTO editor_income_monthly
   (editor_admin_id, novel_id, month, source_type, role,
    chapter_count_total, chapter_count_editor,
    gross_book_income_usd, editor_share_percent, contract_share_percent, editor_income_usd)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
   ON DUPLICATE KEY UPDATE
     gross_book_income_usd = gross_book_income_usd + VALUES(gross_book_income_usd),
     editor_income_usd = editor_income_usd + VALUES(editor_income_usd),
     updated_at = NOW()`,
  [...]
);
```

**唯一约束的影响**：
- ⚠️ **强制合并**：如果同一 `(editor_admin_id, novel_id, month)` 组合有多条记录，会触发 `ON DUPLICATE KEY UPDATE`
- ⚠️ **丢失 source_type 和 role 信息**：虽然 INSERT 时传入了 `source_type` 和 `role`，但在 UPDATE 时**不会更新这些字段**，会保留第一次插入的值
- ⚠️ **金额累加**：`gross_book_income_usd` 和 `editor_income_usd` 会累加，但无法区分来源

**具体合并场景**：

**场景 1：同一编辑同一小说同一月份有两条 subscription 记录**
```
reader_spending.id=100: (editor_id=1, novel_id=7, month='2025-11-01', source_type='subscription', amount=10)
reader_spending.id=101: (editor_id=1, novel_id=7, month='2025-11-01', source_type='subscription', amount=20)
```

**当前行为**：
1. 第一次 INSERT：`(editor_id=1, novel_id=7, month='2025-11-01', source_type='subscription', role='editor', amount=10)`
2. 第二次 INSERT：触发 `ON DUPLICATE KEY UPDATE`，金额累加为 30，但 `source_type` 和 `role` 保持不变
3. **结果**：两条 reader_spending 记录被合并成一条 `editor_income_monthly` 记录

**场景 2：同一编辑同一小说同一月份有 chapter_unlock 和 subscription 两种来源**
```
reader_spending.id=100: (editor_id=1, novel_id=7, month='2025-11-01', source_type='chapter_unlock', amount=5)
reader_spending.id=101: (editor_id=1, novel_id=7, month='2025-11-01', source_type='subscription', amount=10)
```

**当前行为**：
1. 第一次 INSERT：`(editor_id=1, novel_id=7, month='2025-11-01', source_type='chapter_unlock', role='editor', amount=5)`
2. 第二次 INSERT：触发 `ON DUPLICATE KEY UPDATE`，金额累加为 15，但 `source_type` 和 `role` 保持不变（仍然是 `chapter_unlock`）
3. **结果**：两条不同来源的记录被合并，`source_type` 信息丢失

**结论**：
- ❌ **强制合并**：同一 `(editor_admin_id, novel_id, month)` 的多条记录会被强制合并成一条
- ❌ **信息丢失**：`source_type` 和 `role` 字段在 UPDATE 时不会被更新，会保留第一次插入的值
- ❌ **无法追溯来源**：无法区分不同 `reader_spending.id` 的记录

### 4.3 合并发生的具体位置

**合并发生的两个位置**：

1. **内存聚合**（第 458-498 行）：
   - `addToAggregation` 方法会把多条 `reader_spending` 聚合到同一个 `(editorId, novelId, sourceType, role)` 组合
   - 这是**应用层聚合**，在写入数据库之前就已经合并

2. **数据库唯一约束**（第 403-426 行）：
   - `ON DUPLICATE KEY UPDATE` 依赖唯一约束 `(editor_admin_id, novel_id, month)` 来检测冲突
   - 即使内存中区分了 `source_type` 和 `role`，但由于唯一约束不包含这些字段，仍然会被合并

**结论**：
- ⚠️ **双重合并**：既有应用层聚合，也有数据库层唯一约束
- ⚠️ **需要同时修改**：既要修改内存聚合逻辑（保留 reader_spending.id 维度），也要修改数据库唯一约束

---

## 五、结合上面 4 点，当前实现与新需求的差距小结

### 5.1 新需求总结

1. **chapter_unlock**：
   - ✅ 按单条 reader_spending 记录分配（当前已实现）
   - ✅ 根据 chapter.editor_admin_id 和 chapter.chief_editor_admin_id 查合同分成（当前已实现）
   - ❌ 一条 reader_spending 一条基础记录（当前被合并）

2. **subscription**：
   - ❌ 按字数权重分配（当前按章节数量）
   - ❌ 一条 reader_spending 一条基础记录（当前被合并）

3. **同一 editor + novel + month 允许多条记录**：
   - ❌ 当前唯一约束强制合并

4. **可追溯性**：
   - ❌ 需要保存 reader_spending.id（当前没有字段）
   - ❌ 需要保存字数统计（当前没有字段）

### 5.2 当前实现与新需求的差距矩阵

| 需求点 | 当前实现 | 差距 | 需要修改的地方 |
|--------|---------|------|---------------|
| **chapter_unlock 按单条分配** | ✅ 已实现 | - | - |
| **chapter_unlock 查合同分成** | ✅ 已实现 | - | - |
| **chapter_unlock 一条 reader_spending 一条记录** | ❌ 被合并 | ⚠️ 需要修改聚合逻辑和唯一约束 | `addToAggregation`、唯一约束 |
| **subscription 按字数权重** | ❌ 按章节数量 | ⚠️ 需要改为字数汇总 | 查询章节时查询 `word_count`，按字数汇总 |
| **subscription 一条 reader_spending 一条记录** | ❌ 被合并 | ⚠️ 需要修改聚合逻辑和唯一约束 | `addToAggregation`、唯一约束 |
| **同一 editor+novel+month 允许多条** | ❌ 唯一约束强制合并 | ⚠️ 需要修改唯一约束 | 数据库唯一约束 |
| **保存 reader_spending.id** | ❌ 没有字段 | ⚠️ 需要新增字段 | 表结构、INSERT 语句 |
| **保存字数统计** | ❌ 没有字段 | ⚠️ 需要新增字段（subscription 用） | 表结构、INSERT 语句 |

### 5.3 需要修改的具体位置

#### 5.3.1 数据库层面

1. **修改唯一约束**：
   - 当前：`UNIQUE KEY (editor_admin_id, novel_id, month)`
   - 建议：`UNIQUE KEY (editor_admin_id, novel_id, month, source_type, role, source_spend_id)` 或取消唯一约束

2. **新增字段**：
   - `source_spend_id BIGINT`：保存 `reader_spending.id`
   - `total_word_count INT`：订阅分配时的总字数（subscription 用）
   - `editor_word_count INT`：该编辑负责的字数（subscription 用）

#### 5.3.2 代码层面

1. **subscription 分配逻辑**（第 147-191 行）：
   - 查询章节时查询 `word_count` 字段
   - 按字数汇总，而不是章节数量

2. **subscription 分配计算**（第 281-385 行）：
   - 使用字数比例：`(editorWordCount / totalWordCount)` 而不是 `(editorChapterCount / totalChapterCount)`

3. **聚合结构**（第 193-195 行、第 458-498 行）：
   - 添加 `reader_spending.id` 维度：`(editor_admin_id, novel_id, source_type, role, source_spend_id)`
   - 或者不聚合，直接按每条 `reader_spending` 写入

4. **写入逻辑**（第 403-426 行）：
   - INSERT 语句中添加 `source_spend_id`、`total_word_count`、`editor_word_count` 字段
   - 修改或删除 `ON DUPLICATE KEY UPDATE`（取决于新的唯一约束）

### 5.4 实施优先级建议

**高优先级**（核心功能）：
1. 修改唯一约束，允许同一 editor+novel+month 多条记录
2. 新增 `source_spend_id` 字段，保存 reader_spending.id
3. 修改聚合逻辑，保留 reader_spending.id 维度

**中优先级**（功能完善）：
4. subscription 改为按字数权重分配
5. 新增字数统计字段（`total_word_count`、`editor_word_count`）

**低优先级**（优化）：
6. 优化查询性能（如果数据量大）

---

## 六、总结

### 6.1 关键发现

1. **subscription 分配**：
   - ❌ 当前按章节数量分配，需要改为按字数分配
   - ✅ 按每条 reader_spending 逐条处理，但会被聚合合并

2. **chapter_unlock 分配**：
   - ✅ 按每条 reader_spending 逐条处理，符合需求
   - ❌ 会被聚合合并，不符合"一条 reader_spending 一条基础记录"的需求

3. **来源维度**：
   - ❌ 没有 `source_spend_id` 字段，无法追溯到 reader_spending 记录

4. **字数维度**：
   - ❌ 没有字数统计字段，只有章节数量字段
   - ❌ 代码中查询了 `word_count` 但没有使用（chapter_unlock）
   - ❌ 代码中完全没有查询 `word_count`（subscription）

5. **唯一约束影响**：
   - ❌ 强制合并同一 `(editor_admin_id, novel_id, month)` 的多条记录
   - ❌ 导致无法区分不同 `reader_spending.id` 的记录

### 6.2 与新需求的差距

**核心差距**：
1. **聚合维度缺失**：当前聚合到 `(editor_admin_id, novel_id, source_type, role)`，缺少 `reader_spending.id` 维度
2. **唯一约束限制**：`UNIQUE(editor_admin_id, novel_id, month)` 强制合并，需要扩展或取消
3. **权重计算方式**：subscription 需要从章节数量改为字数
4. **字段缺失**：需要新增 `source_spend_id` 和字数统计字段

**实施建议**：
- 优先修改唯一约束和聚合逻辑，实现"一条 reader_spending 一条基础记录"
- 然后修改 subscription 分配逻辑，改为按字数权重
- 最后新增字段，完善可追溯性

---

**报告完成时间**：2025-11-29  
**下一步**：根据此报告，可以开始设计具体的修改方案和实施步骤

