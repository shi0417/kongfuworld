# chapter_unlock 编辑基础收入分配逻辑现状分析报告（由 Cursor 自动生成）

**生成时间**：2025-11-29  
**分析目标**：分析 `source_type='chapter_unlock'` 时，编辑基础收入从 `reader_spending` 分配到 `editor_income_monthly` 的完整逻辑，并与业务要求进行对比

---

## 一、相关文件和函数定位

### 1.1 服务文件

**文件路径**：`backend/services/editorBaseIncomeService.js`

**文件说明**：编辑基础收入服务（编辑基础收入-4）- 修正版

### 1.2 主入口函数

**函数名**：`generateEditorBaseIncomeForMonth`  
**行号范围**：第 46-143 行  
**功能**：生成指定月份的编辑基础收入的主入口函数

**关键调用流程**：
```javascript
// 第 85 行：筛选章节解锁记录
const chapterUnlockSpendings = spendings.filter(s => s.source_type === 'chapter_unlock');

// 第 91 行：加载章节解锁上下文
const chapterUnlockContext = await this.loadChapterUnlockContext(db, chapterUnlockSpendings);

// 第 97 行：加载合同（按 novel_id + role）
const novelContracts = await this.loadNovelRoleContracts(db, spendings);

// 第 101-107 行：生成章节解锁明细
await this.generateFromChapterUnlock(
  rows,
  chapterUnlockSpendings,
  chapterUnlockContext,
  novelContracts,
  settlementMonth
);
```

### 1.3 章节解锁相关函数

#### 1.3.1 loadChapterUnlockContext（加载章节解锁上下文）

**函数名**：`loadChapterUnlockContext`  
**行号范围**：第 151-213 行  
**功能**：预加载章节解锁相关的章节信息，建立 `chapter_unlocks.id` → `chapter.id` → `chapter` 信息的映射

#### 1.3.2 loadNovelRoleContracts（加载合同）

**函数名**：`loadNovelRoleContracts`  
**行号范围**：第 302-360 行  
**功能**：按 `novel_id + role` 查找 active 合同，不看 `spend_time`

#### 1.3.3 generateFromChapterUnlock（生成章节解锁明细）

**函数名**：`generateFromChapterUnlock`  
**行号范围**：第 370-454 行  
**功能**：从章节解锁的 `reader_spending` 记录生成 `editor_income_monthly` 明细

---

## 二、详细分析 chapter_unlock 的当前实现

### 2.1 spending → chapter 的关联逻辑

#### 2.1.1 关联路径

**代码位置**：`loadChapterUnlockContext` 方法（第 151-213 行）

**关联步骤**：

**步骤 1**：从 `reader_spending` 提取 `source_id`（第 156 行）
```javascript
const unlockIds = [...new Set(chapterUnlockSpendings.map(s => s.source_id))];
```
- `reader_spending.source_id` 对应 `chapter_unlocks.id`

**步骤 2**：查询 `chapter_unlocks` 表，获取 `chapter_id`（第 159-164 行）
```sql
SELECT id, chapter_id
FROM chapter_unlocks
WHERE id IN (?)
```
- 建立映射：`chapter_unlocks.id` → `chapter.id`

**步骤 3**：查询 `chapter` 表，获取章节信息（第 173-190 行）
```sql
SELECT
  id,
  novel_id,
  editor_admin_id,
  chief_editor_admin_id,
  review_status,
  word_count,
  CASE
    WHEN (word_count IS NULL OR word_count = 0) THEN
      CHAR_LENGTH(content)
    ELSE
      word_count
  END AS effective_word_count
FROM chapter
WHERE id IN (?)
```

**结论**：
- ✅ `reader_spending.source_id` 对应 `chapter_unlocks.id`
- ✅ 通过 `chapter_unlocks` 查到 `chapter_id`
- ✅ 查询 `chapter` 表，获取 `editor_admin_id`、`chief_editor_admin_id`、`novel_id`、`word_count`、`content`
- ✅ 计算有效字数：`word_count` 为空或 0 时使用 `CHAR_LENGTH(content)`

### 2.2 章节上的编辑/主编是如何参与分成的

#### 2.2.1 分成决定逻辑

**代码位置**：`generateFromChapterUnlock` 方法（第 370-454 行）

**关键代码片段**（第 395-419 行、第 421-445 行）：

```javascript
// 如果 chapter.editor_admin_id 不为空，并且有 editorContract
if (chapter.editor_admin_id && chapter.editor_admin_id !== null && editorContract) {
  const sharePercent = new Decimal(editorContract.share_percent);
  const income = amount.mul(sharePercent);
  
  rows.push({
    editor_admin_id: chapter.editor_admin_id,  // 使用章节上的编辑ID
    role: 'editor',
    // ...
  });
}

// 如果 chapter.chief_editor_admin_id 不为空，并且有 chiefContract
if (chapter.chief_editor_admin_id && chapter.chief_editor_admin_id !== null && chiefContract) {
  const sharePercent = new Decimal(chiefContract.share_percent);
  const income = amount.mul(sharePercent);
  
  rows.push({
    editor_admin_id: chapter.chief_editor_admin_id,  // 使用章节上的主编ID
    role: 'chief_editor',
    // ...
  });
}
```

**结论**：
- ✅ **只使用 `chapter.editor_admin_id` 和 `chapter.chief_editor_admin_id`** 来决定"谁分成"
- ✅ **没有使用 `novel.current_editor_admin_id` 或其它字段**
- ✅ 分成对象完全由章节上的编辑/主编ID决定

### 2.3 合同（novel_editor_contract）的查询逻辑

#### 2.3.1 合同查询 SQL

**代码位置**：`loadNovelRoleContracts` 方法（第 314-331 行）

**SQL 查询**：
```sql
SELECT
  id,
  novel_id,
  editor_admin_id,
  role,
  share_type,
  share_percent,
  status,
  start_date,
  end_date
FROM novel_editor_contract
WHERE novel_id IN (?)
  AND share_type = 'percent_of_book'
  AND status = 'active'
ORDER BY novel_id, role, start_date DESC, id DESC
```

#### 2.3.2 查询条件分析

**WHERE 条件**：
- ✅ **按 `novel_id IN (?)` 过滤**：查询涉及的所有小说
- ✅ **按 `share_type = 'percent_of_book'` 过滤**：只查询按作品总收入分成的合同
- ✅ **按 `status = 'active'` 过滤**：只查询生效中的合同
- ❌ **没有按 `role = 'editor' / role = 'chief_editor'` 在 WHERE 中过滤**：在 SQL 中查询所有角色，然后在 JS 中按 role 分组
- ❌ **没有使用 `spend_time` / `unlocked_at` 来限制合同时间范围**：**完全符合业务要求**

**结论**：
- ✅ **不按时间过滤**：查询时没有使用 `start_date <= spend_time AND (end_date IS NULL OR end_date > spend_time)` 这样的条件
- ✅ **只按 `share_type='percent_of_book' AND status='active'` 查询**：完全符合业务要求

#### 2.3.3 合同选择逻辑

**代码位置**：`loadNovelRoleContracts` 方法（第 333-352 行）

**关键代码片段**：
```javascript
// 按 novel_id + role 分组，每个组合取第一条（最新的）
const contractMap = new Map(); // novelId -> { editorContract, chiefContract }

for (const novelId of novelIds) {
  contractMap.set(novelId, {
    editorContract: null,
    chiefContract: null
  });
}

for (const contract of contracts) {
  const nc = contractMap.get(contract.novel_id);
  if (!nc) continue;
  
  if (contract.role === 'editor' && !nc.editorContract) {
    nc.editorContract = contract;  // 取第一条 editor 角色的合同
  } else if (contract.role === 'chief_editor' && !nc.chiefContract) {
    nc.chiefContract = contract;  // 取第一条 chief_editor 角色的合同
  }
}
```

**选择逻辑**：
- ✅ **按 `novel_id + role` 选择**：每个 `(novel_id, role)` 组合取一条合同
- ✅ **取最新的合同**：由于 SQL 中 `ORDER BY start_date DESC, id DESC`，循环中取到的第一条就是最新的
- ❌ **不按 `editor_admin_id` 匹配**：不要求 `novel_editor_contract.editor_admin_id` 等于 `chapter.editor_admin_id`

**结论**：
- ✅ **按"小说 + 角色"选一条**：每个 `(novel_id, role)` 组合取一条 active 合同
- ✅ **不按 `editor_admin_id` 匹配**：合同是"小说+角色级别"的抽象规则，不绑定具体 admin

### 2.4 "合同和章节上的人"的匹配方式

#### 2.4.1 匹配逻辑

**代码位置**：`generateFromChapterUnlock` 方法（第 390-445 行）

**关键代码片段**：
```javascript
// 从 novelContracts 里取出合同
const nc = novelContracts.get(spending.novel_id);
const editorContract = nc?.editorContract || null;  // 该小说的"编辑角色"合同
const chiefContract = nc?.chiefContract || null;    // 该小说的"主编角色"合同

// 如果 chapter.editor_admin_id 不为空，并且有 editorContract
if (chapter.editor_admin_id && chapter.editor_admin_id !== null && editorContract) {
  // 使用 chapter.editor_admin_id 作为 editor_admin_id
  // 使用 editorContract.share_percent 作为分成比例
  rows.push({
    editor_admin_id: chapter.editor_admin_id,  // 章节上的编辑ID
    role: 'editor',
    contract_share_percent: editorContract.share_percent,  // 该小说"编辑角色"的合同比例
    // ...
  });
}
```

**匹配方式**：
- ✅ **不要求 `novel_editor_contract.editor_admin_id` 等于 `chapter.editor_admin_id`**
- ✅ **只按 `role='editor'` / `role='chief_editor'` 找合同**
- ✅ **把章节上的 `editor_admin_id` / `chief_editor_admin_id` 视为"领这 5% / 2% 的人"**

**结论**：
- ✅ **合同是"小说+角色"的抽象规则**：例如"这本小说的编辑分成 5%"
- ✅ **章节上的人决定"谁拿钱"**：`chapter.editor_admin_id` 决定谁拿这 5%
- ✅ **完全符合业务要求**

#### 2.4.2 没有找到匹配合同时的处理

**代码位置**：`generateFromChapterUnlock` 方法（第 417-419 行、第 443-445 行）

**关键代码片段**：
```javascript
if (chapter.editor_admin_id && chapter.editor_admin_id !== null && editorContract) {
  // 生成记录
} else if (chapter.editor_admin_id && chapter.editor_admin_id !== null && !editorContract) {
  console.warn(`[editor-base-income] 章节解锁记录 ${spending.id} 的小说 ${spending.novel_id} 没有编辑角色合同`);
  // 跳过这条分成，不生成记录
}
```

**处理方式**：
- ✅ **跳过这条分成**：如果章节有编辑/主编，但没有对应角色的合同，记录 warning 日志，不生成 `editor_income_monthly` 记录
- ✅ **不报错**：不会中断整个生成流程，继续处理下一条记录

**结论**：
- ✅ **防御性处理**：找不到合同时跳过，记录日志，不报错

### 2.5 每条 reader_spending 对应插入几条 editor_income_monthly 记录

#### 2.5.1 生成逻辑

**代码位置**：`generateFromChapterUnlock` 方法（第 373-451 行）

**关键代码片段**：
```javascript
for (const spending of chapterUnlockSpendings) {
  // ... 找到 chapter ...
  
  // 如果章节有编辑，生成一条编辑记录
  if (chapter.editor_admin_id && chapter.editor_admin_id !== null && editorContract) {
    rows.push({
      source_spend_id: spending.id,  // 保存 reader_spending.id
      // ...
    });
  }
  
  // 如果章节有主编，生成一条主编记录
  if (chapter.chief_editor_admin_id && chapter.chief_editor_admin_id !== null && chiefContract) {
    rows.push({
      source_spend_id: spending.id,  // 保存 reader_spending.id
      // ...
    });
  }
}
```

**生成行为**：
- ✅ **以每条 reader_spending 为单位**：第 373 行的 `for` 循环逐条处理每条 `spending`
- ✅ **每条 spending 决定插 0/1/2 条记录**：
  - 如果章节有编辑 + 主编，并且两个角色都有合同：插 2 条记录
  - 如果只有编辑或只有主编：插 1 条记录
  - 如果都没有：插 0 条记录（跳过）

#### 2.5.2 金额计算

**代码位置**：第 397-398 行、第 423-424 行

**关键代码片段**：
```javascript
// 编辑收入
const sharePercent = new Decimal(editorContract.share_percent);
const income = amount.mul(sharePercent);  // amount = spending.amount_usd

// 主编收入
const sharePercent = new Decimal(chiefContract.share_percent);
const income = amount.mul(sharePercent);  // amount = spending.amount_usd
```

**金额计算**：
- ✅ **编辑收入 = `reader_spending.amount_usd × editor合同的share_percent`**
- ✅ **主编收入 = `reader_spending.amount_usd × chief_editor合同的share_percent`**
- ✅ **完全符合业务要求**

#### 2.5.3 写入逻辑

**代码位置**：`batchInsertEditorIncome` 方法（第 565-607 行）

**关键代码片段**：
```javascript
await db.execute(
  `INSERT INTO editor_income_monthly
   (editor_admin_id, role, novel_id, month, source_spend_id, source_type, chapter_id,
    chapter_count_total, chapter_count_editor, total_word_count, editor_word_count,
    gross_book_income_usd, editor_share_percent, contract_share_percent, editor_income_usd)
   VALUES ${placeholders}`,
  values.flat()
);
```

**写入行为**：
- ✅ **每条记录都保存 `source_spend_id`**：可以追溯到具体的 `reader_spending.id`
- ✅ **每条记录都保存 `chapter_id`**：可以追溯到具体的章节
- ✅ **没有聚合**：直接批量插入，不使用 `ON DUPLICATE KEY UPDATE`
- ✅ **同一 `source_spend_id` 可以对应多条记录**：如果章节有编辑+主编，会生成 2 条记录，都指向同一个 `source_spend_id`

**结论**：
- ✅ **每条 reader_spending 严格对应最多 2 条 editor_income_monthly 记录**（编辑 + 主编）
- ✅ **没有合并**：不同 `reader_spending` 的记录不会合并
- ✅ **可以追溯**：通过 `source_spend_id` 可以追溯到具体的 `reader_spending` 记录

---

## 三、用伪代码 + 示例总结当前逻辑

### 3.1 伪代码总结

```javascript
// 主流程
async function generateEditorBaseIncomeForMonth(month) {
  // 1. 查询当月所有 reader_spending（chapter_unlock + subscription）
  const spendings = await db.execute(
    'SELECT id, novel_id, amount_usd, source_type, source_id FROM reader_spending WHERE settlement_month = ?',
    [settlementMonth]
  );
  
  const chapterUnlockSpendings = spendings.filter(s => s.source_type === 'chapter_unlock');
  
  // 2. 预加载章节解锁上下文
  const chapterUnlockContext = await loadChapterUnlockContext(chapterUnlockSpendings);
  // 建立映射：
  //   unlockMap: chapter_unlocks.id -> chapter.id
  //   chapterMap: chapter.id -> { editor_admin_id, chief_editor_admin_id, effective_word_count, ... }
  
  // 3. 预加载合同（按 novel_id + role，不看 spend_time）
  const novelContracts = await loadNovelRoleContracts(spendings);
  // 结构：novelId -> { editorContract, chiefContract }
  
  // 4. 逐条处理 chapter_unlock spending
  const rows = [];
  for (const spending of chapterUnlockSpendings) {
    // 4.1 找到对应的章节
    const chapterId = unlockMap.get(spending.source_id);
    const chapter = chapterMap.get(chapterId);
    
    // 4.2 获取该小说的合同
    const nc = novelContracts.get(spending.novel_id);
    const editorContract = nc?.editorContract;  // 该小说"编辑角色"的合同
    const chiefContract = nc?.chiefContract;    // 该小说"主编角色"的合同
    
    // 4.3 如果章节有编辑，生成编辑收入记录
    if (chapter.editor_admin_id && editorContract) {
      const income = spending.amount_usd * editorContract.share_percent;
      rows.push({
        editor_admin_id: chapter.editor_admin_id,
        role: 'editor',
        source_spend_id: spending.id,
        chapter_id: chapterId,
        editor_income_usd: income,
        contract_share_percent: editorContract.share_percent,
        // ...
      });
    }
    
    // 4.4 如果章节有主编，生成主编收入记录
    if (chapter.chief_editor_admin_id && chiefContract) {
      const income = spending.amount_usd * chiefContract.share_percent;
      rows.push({
        editor_admin_id: chapter.chief_editor_admin_id,
        role: 'chief_editor',
        source_spend_id: spending.id,
        chapter_id: chapterId,
        editor_income_usd: income,
        contract_share_percent: chiefContract.share_percent,
        // ...
      });
    }
  }
  
  // 5. 批量插入 editor_income_monthly
  await batchInsertEditorIncome(rows);
}
```

### 3.2 具体示例分析

**示例数据**：

**reader_spending 记录**：
- `id = 100`
- `amount_usd = 10`
- `source_type = 'chapter_unlock'`
- `source_id = 50`（对应 `chapter_unlocks.id = 50`）

**章节信息**（通过 `chapter_unlocks.id=50` → `chapter.id=200`）：
- `chapter.id = 200`
- `chapter.editor_admin_id = 2`
- `chapter.chief_editor_admin_id = 1`
- `chapter.novel_id = 7`

**合同信息**（该小说 `novel_id=7`）：
- `role='editor'`, `share_percent = 0.05`（5%）
- `role='chief_editor'`, `share_percent = 0.02`（2%）

**当前代码实际产出**：

**记录 1（编辑）**：
```javascript
{
  editor_admin_id: 2,                    // 章节上的编辑ID
  role: 'editor',
  novel_id: 7,
  source_spend_id: 100,                  // reader_spending.id
  chapter_id: 200,                      // chapter.id
  gross_book_income_usd: 10,             // spending.amount_usd
  contract_share_percent: 0.05,          // editor合同的share_percent
  editor_share_percent: 0.05,            // 对章节解锁来说就是合同比例
  editor_income_usd: 0.5                 // 10 * 0.05 = 0.5
}
```

**记录 2（主编）**：
```javascript
{
  editor_admin_id: 1,                    // 章节上的主编ID
  role: 'chief_editor',
  novel_id: 7,
  source_spend_id: 100,                  // reader_spending.id（同一条）
  chapter_id: 200,                       // chapter.id（同一个章节）
  gross_book_income_usd: 10,             // spending.amount_usd
  contract_share_percent: 0.02,           // chief_editor合同的share_percent
  editor_share_percent: 0.02,            // 对章节解锁来说就是合同比例
  editor_income_usd: 0.2                 // 10 * 0.02 = 0.2
}
```

**结论**：
- ✅ **生成 2 条记录**：一条编辑（0.5），一条主编（0.2）
- ✅ **金额完全符合期望**：编辑 0.5 元，主编 0.2 元
- ✅ **两条记录都指向同一个 `source_spend_id=100`**：可以追溯到同一条 `reader_spending` 记录

---

## 四、当前实现与业务要求的对比

### 4.1 对比表

| 业务要求 | 当前实现 | 是否一致 |
|---------|---------|---------|
| **合同查找不使用 spend_time** | ✅ 查询时没有使用 `spend_time` 过滤 | ✅ **一致** |
| **合同按「小说+角色」选一条** | ✅ 按 `novel_id + role` 选择，每个组合取一条最新的 active 合同 | ✅ **一致** |
| **合同不按 editor_admin_id 匹配** | ✅ 不要求 `novel_editor_contract.editor_admin_id` 等于 `chapter.editor_admin_id` | ✅ **一致** |
| **章节上的人决定谁分成** | ✅ 使用 `chapter.editor_admin_id` 和 `chapter.chief_editor_admin_id` | ✅ **一致** |
| **每条 reader_spending 对应最多 2 条记录** | ✅ 每条 spending 单独处理，最多生成 2 条（编辑+主编） | ✅ **一致** |
| **金额 = spending.amount_usd × 合同比例** | ✅ 编辑收入 = `amount_usd × editorContract.share_percent`<br>主编收入 = `amount_usd × chiefContract.share_percent` | ✅ **一致** |
| **保存 source_spend_id** | ✅ 每条记录都保存 `source_spend_id`（对应 `reader_spending.id`） | ✅ **一致** |
| **保存 chapter_id** | ✅ 每条记录都保存 `chapter_id` | ✅ **一致** |
| **保存有效字数** | ✅ 保存 `total_word_count` 和 `editor_word_count`（章节的有效字数） | ✅ **一致** |

### 4.2 详细对比说明

#### 4.2.1 合同查找规则

**业务要求**：
- 不按 `spend_time` 过滤
- 按 `novel_id + role` 找 active 合同
- 不按 `editor_admin_id` 匹配

**当前实现**：
- ✅ **完全符合**：`loadNovelRoleContracts` 方法（第 314-331 行）查询时只使用：
  - `novel_id IN (?)`
  - `share_type = 'percent_of_book'`
  - `status = 'active'`
- ✅ **没有时间过滤**：SQL 中没有 `start_date <= ? AND (end_date IS NULL OR end_date > ?)` 这样的条件
- ✅ **按角色分组**：在 JS 中按 `role='editor'` 和 `role='chief_editor'` 分组，每个组合取一条

#### 4.2.2 分成对象决定

**业务要求**：
- 章节上真正审核的编辑/主编是谁，就只给谁分成
- 合同是"小说+角色"的抽象规则，不绑定具体 admin

**当前实现**：
- ✅ **完全符合**：`generateFromChapterUnlock` 方法（第 395-445 行）：
  - 使用 `chapter.editor_admin_id` 作为 `editor_admin_id`
  - 使用 `chapter.chief_editor_admin_id` 作为主编的 `editor_admin_id`
  - 使用 `novelContracts.get(novel_id).editorContract` 作为编辑角色的合同
  - 使用 `novelContracts.get(novel_id).chiefContract` 作为主编角色的合同
- ✅ **不要求合同中的 `editor_admin_id` 匹配章节上的 `editor_admin_id`**

#### 4.2.3 记录生成粒度

**业务要求**：
- 每条 `reader_spending` 单独生成一组明细
- 最多 2 条记录（编辑 + 主编）

**当前实现**：
- ✅ **完全符合**：`generateFromChapterUnlock` 方法（第 373-451 行）：
  - 使用 `for (const spending of chapterUnlockSpendings)` 逐条处理
  - 每条 spending 最多生成 2 条记录（第 400-416 行、第 426-442 行）
  - 每条记录都保存 `source_spend_id = spending.id`

#### 4.2.4 金额计算

**业务要求**：
- 编辑收入 = `reader_spending.amount_usd × editor合同的share_percent`
- 主编收入 = `reader_spending.amount_usd × chief_editor合同的share_percent`

**当前实现**：
- ✅ **完全符合**：`generateFromChapterUnlock` 方法（第 397-398 行、第 423-424 行）：
  - 编辑收入：`amount.mul(sharePercent)`，其中 `amount = spending.amount_usd`，`sharePercent = editorContract.share_percent`
  - 主编收入：`amount.mul(sharePercent)`，其中 `amount = spending.amount_usd`，`sharePercent = chiefContract.share_percent`

---

## 五、总结

### 5.1 当前实现完全符合业务要求

**核心结论**：当前 `chapter_unlock` 的编辑基础收入分配逻辑**完全符合**业务要求。

**关键点**：
1. ✅ **合同查找**：不按 `spend_time` 过滤，只按 `novel_id + role + share_type + status` 查找
2. ✅ **合同选择**：按"小说+角色"选一条 active 合同，不按 `editor_admin_id` 匹配
3. ✅ **分成对象**：由章节上的 `editor_admin_id` / `chief_editor_admin_id` 决定
4. ✅ **记录粒度**：每条 `reader_spending` 单独生成明细，最多 2 条记录
5. ✅ **金额计算**：严格等于 `spending.amount_usd × 合同比例`
6. ✅ **可追溯性**：保存 `source_spend_id` 和 `chapter_id`，可以追溯到具体的 `reader_spending` 和章节

### 5.2 代码质量

**优点**：
- ✅ 逻辑清晰，代码结构良好
- ✅ 使用高精度 Decimal 计算，避免浮点误差
- ✅ 有完善的错误处理和日志记录
- ✅ 批量插入优化性能

**建议**：
- ✅ 当前实现已经符合业务要求，无需修改

---

**报告完成时间**：2025-11-29  
**结论**：当前 `chapter_unlock` 的编辑基础收入分配逻辑完全符合业务要求，无需修改

