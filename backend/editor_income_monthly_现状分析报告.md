# editor_income_monthly 表结构与代码使用现状分析报告

**生成时间**：2025-11-29  
**分析目标**：全面梳理 `editor_income_monthly` 表的数据库结构和代码使用方式，为将来允许同一编辑+小说+月份存在多条记录做准备

---

## 一、editor_income_monthly 表结构与索引现状

### 1.1 当前最新版本的表结构（基于数据库实际查询）

```sql
CREATE TABLE `editor_income_monthly` (
  `id` int NOT NULL AUTO_INCREMENT,
  `editor_admin_id` int NOT NULL,
  `role` enum('chief_editor','editor','proofreader') DEFAULT NULL COMMENT '本条记录中该管理员的角色',
  `novel_id` int NOT NULL,
  `month` date NOT NULL,
  `source_type` enum('chapter_unlock','subscription','mixed') NOT NULL DEFAULT 'mixed' COMMENT '收入来源类型：章节解锁/订阅/混合',
  `chapter_count_total` int NOT NULL DEFAULT '0' COMMENT '该小说当期用于分配的总章节数（订阅分配时用）',
  `chapter_count_editor` int NOT NULL DEFAULT '0' COMMENT '该编辑审核的章节数（订阅分配时用）',
  `gross_book_income_usd` decimal(18,6) DEFAULT '0.000000',
  `editor_share_percent` decimal(8,4) DEFAULT '0.0000',
  `contract_share_percent` decimal(8,4) DEFAULT NULL COMMENT '从 novel_editor_contract 取到的基础分成比例',
  `editor_income_usd` decimal(18,6) DEFAULT '0.000000',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_editor_month_novel` (`editor_admin_id`,`novel_id`,`month`),
  KEY `idx_editor_admin_id` (`editor_admin_id`),
  KEY `idx_novel_id` (`novel_id`),
  KEY `idx_month` (`month`),
  CONSTRAINT `fk_editor_income_admin` FOREIGN KEY (`editor_admin_id`) REFERENCES `admin` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_editor_income_novel` FOREIGN KEY (`novel_id`) REFERENCES `novel` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

### 1.2 字段详细说明

| 字段名 | 类型 | 默认值 | 注释 | 说明 |
|--------|------|--------|------|------|
| `id` | `int` | AUTO_INCREMENT | 主键 | 自增主键 |
| `editor_admin_id` | `int` | NOT NULL | 编辑管理员ID | 关联 `admin.id` |
| `role` | `enum('chief_editor','editor','proofreader')` | NULL | 本条记录中该管理员的角色 | 新增字段，用于区分主编/编辑/校对 |
| `novel_id` | `int` | NOT NULL | 小说ID | 关联 `novel.id` |
| `month` | `date` | NOT NULL | 结算月份 | 格式：`2025-11-01` |
| `source_type` | `enum('chapter_unlock','subscription','mixed')` | `'mixed'` | 收入来源类型 | 新增字段，章节解锁/订阅/混合 |
| `chapter_count_total` | `int` | `0` | 该小说当期用于分配的总章节数 | 新增字段，订阅分配时用 |
| `chapter_count_editor` | `int` | `0` | 该编辑审核的章节数 | 新增字段，订阅分配时用 |
| `gross_book_income_usd` | `decimal(18,6)` | `'0.000000'` | 作品总收入（美元） | 高精度金额字段 |
| `editor_share_percent` | `decimal(8,4)` | `'0.0000'` | 编辑分成比例 | 实际有效比例 |
| `contract_share_percent` | `decimal(8,4)` | NULL | 从合同取到的基础分成比例 | 新增字段，合同原始比例 |
| `editor_income_usd` | `decimal(18,6)` | `'0.000000'` | 编辑收入（美元） | 高精度金额字段 |
| `created_at` | `datetime` | CURRENT_TIMESTAMP | 创建时间 | 自动设置 |
| `updated_at` | `datetime` | CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | 更新时间 | 自动更新 |

### 1.3 索引与约束

#### 主键
- **PRIMARY KEY (`id`)**：自增主键

#### 唯一约束
- **UNIQUE KEY `uniq_editor_month_novel` (`editor_admin_id`,`novel_id`,`month`)**：
  - **当前含义**：同一编辑、同一小说、同一结算月份只能存在一条记录
  - **实际效果**：如果尝试插入相同的 `(editor_admin_id, novel_id, month)` 组合，会触发 `ON DUPLICATE KEY UPDATE` 或报错

#### 普通索引
- **KEY `idx_editor_admin_id` (`editor_admin_id`)**：用于按编辑查询
- **KEY `idx_novel_id` (`novel_id`)**：用于按小说查询
- **KEY `idx_month` (`month`)**：用于按月份查询

#### 外键约束
- **CONSTRAINT `fk_editor_income_admin`**：`editor_admin_id` → `admin.id` ON DELETE CASCADE
- **CONSTRAINT `fk_editor_income_novel`**：`novel_id` → `novel.id` ON DELETE CASCADE

### 1.4 唯一约束的实际含义与行为

**当前唯一约束 `(editor_admin_id, novel_id, month)` 的实际含义**：
- 数据库层面强制：同一编辑、同一小说、同一结算月份只能存在一条记录
- 如果尝试插入重复的 `(editor_admin_id, novel_id, month)` 组合：
  - 如果使用 `INSERT ... ON DUPLICATE KEY UPDATE`，会触发 UPDATE 分支，累加金额字段
  - 如果使用普通 `INSERT`，会报错：`Duplicate entry '...' for key 'uniq_editor_month_novel'`

**在现有代码下的聚合行为**：
- 当使用 `ON DUPLICATE KEY UPDATE` 时，不同 `source_type`、`role` 的记录会被强制合并到一行
- 例如：同一编辑在同一小说同一月份既有章节解锁收入又有订阅收入，会被合并成一条记录
- 金额字段会累加：`gross_book_income_usd = gross_book_income_usd + VALUES(gross_book_income_usd)`
- 但 `source_type`、`role` 等非金额字段会累加：`gross_book_income_usd = gross_book_income_usd + VALUES(gross_book_income_usd)`
- 但 `source_type`、`role` 等字段在 UPDATE 时不会被更新（当前代码中 `ON DUPLICATE KEY UPDATE` 只更新金额字段）

---

## 二、所有写入 editor_income_monthly 的代码位置与 SQL 语句

### 2.1 新逻辑：editorBaseIncomeService.js（编辑基础收入-4）

**文件路径**：`backend/services/editorBaseIncomeService.js`  
**函数名**：`generateEditorBaseIncomeForMonth`  
**行号范围**：第 45-453 行

#### 2.1.1 DELETE 操作

**位置**：第 57-60 行

```javascript
const [deleteResult] = await db.execute(
  `DELETE FROM editor_income_monthly WHERE month = ?`,
  [settlementMonth]
);
```

**业务维度**：编辑基础收入-4 生成前，先删除当月所有旧数据

#### 2.1.2 INSERT ... ON DUPLICATE KEY UPDATE 操作

**位置**：第 403-426 行

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
  [
    editorId,
    novelId,
    settlementMonth,
    sourceType,
    role,
    data.chapterCountTotal,
    data.chapterCountEditor,
    data.grossAmountUsd.toNumber(),
    editorSharePercent ? editorSharePercent.toNumber() : null,
    data.contractSharePercent ? data.contractSharePercent.toNumber() : null,
    data.editorIncomeUsd.toNumber()
  ]
);
```

**插入字段**：
- `editor_admin_id`、`novel_id`、`month`（唯一约束字段）
- `source_type`、`role`（新增字段）
- `chapter_count_total`、`chapter_count_editor`（新增字段）
- `gross_book_income_usd`、`editor_share_percent`、`contract_share_percent`、`editor_income_usd`（金额字段）

**冲突更新策略**：
- **累加**：`gross_book_income_usd` 和 `editor_income_usd` 使用累加
- **不更新**：`source_type`、`role`、`chapter_count_total`、`chapter_count_editor`、`contract_share_percent`、`editor_share_percent` 在冲突时不会被更新

**业务维度**：编辑基础收入-4，从 `reader_spending` 表按月计算编辑收入

**聚合维度**：
- 在内存中按 `(editor_admin_id, novel_id, source_type, role)` 聚合
- 但写入时由于唯一约束 `(editor_admin_id, novel_id, month)`，不同 `source_type` 和 `role` 的记录会被合并

### 2.2 旧逻辑：editorIncomeService.js（基于 novel_income_monthly）

**文件路径**：`backend/services/editorIncomeService.js`  
**函数名**：`calculateChampionIncomeForNovel`  
**行号范围**：第 25-221 行

#### 2.2.1 INSERT ... ON DUPLICATE KEY UPDATE 操作

**位置**：第 178-189 行

```javascript
const upsertEditorIncome = async (editorId, amount) => {
  await db.execute(
    `INSERT INTO editor_income_monthly 
     (editor_admin_id, novel_id, month, gross_book_income_usd, editor_income_usd, updated_at)
     VALUES (?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
     gross_book_income_usd = gross_book_income_usd + VALUES(gross_book_income_usd),
     editor_income_usd = editor_income_usd + VALUES(editor_income_usd),
     updated_at = NOW()`,
    [editorId, novelId, monthDate, championIncome, amount]
  );
};
```

**插入字段**：
- `editor_admin_id`、`novel_id`、`month`（唯一约束字段）
- `gross_book_income_usd`、`editor_income_usd`（金额字段）
- **不包含**：`source_type`、`role`、`chapter_count_total`、`chapter_count_editor`、`contract_share_percent`（旧逻辑未使用这些字段）

**冲突更新策略**：
- **累加**：`gross_book_income_usd` 和 `editor_income_usd` 使用累加

**业务维度**：旧的 Champion 收入分配逻辑，基于 `novel_income_monthly` 表（该表可能不存在）

**调用位置**：
- 第 193-194 行：写入编辑收入
- 第 198-199 行：写入主编收入

---

## 三、editorBaseIncomeService 的聚合维度与写入逻辑解析

### 3.1 内存聚合结构

**位置**：第 193-195 行

```javascript
// ========== 聚合结构 ==========
// key: editor_admin_id -> novel_id -> source_type -> role -> { grossAmountUsd, editorIncomeUsd, chapterCountTotal, chapterCountEditor, contractSharePercent }
const agg = new Map();
```

**聚合维度**：
- **第一层**：`editor_admin_id`（编辑ID）
- **第二层**：`novel_id`（小说ID）
- **第三层**：`source_type`（来源类型：`'chapter_unlock'` / `'subscription'`）
- **第四层**：`role`（角色：`'editor'` / `'chief_editor'`）
- **数据值**：`{ grossAmountUsd, editorIncomeUsd, chapterCountTotal, chapterCountEditor, contractSharePercent }`

**说明**：
- 内存聚合结构已经区分了 `source_type` 和 `role`
- 理论上可以为同一编辑+小说+月份生成多条记录（不同 `source_type` 和 `role`）

### 3.2 聚合逻辑（addToAggregation 方法）

**位置**：第 458-498 行

```javascript
addToAggregation(agg, editorId, novelId, sourceType, role, grossAmountUsd, editorIncomeUsd, chapterCountTotal, chapterCountEditor, contractSharePercent) {
  // ... 建立嵌套 Map 结构 ...
  
  const data = roleMap.get(role);
  data.grossAmountUsd = data.grossAmountUsd.plus(grossAmountUsd);
  data.editorIncomeUsd = data.editorIncomeUsd.plus(editorIncomeUsd);
  // 对于订阅，chapterCountTotal 和 chapterCountEditor 取最大值（因为同一小说多次订阅时这些值相同）
  if (chapterCountTotal > data.chapterCountTotal) {
    data.chapterCountTotal = chapterCountTotal;
  }
  if (chapterCountEditor > data.chapterCountEditor) {
    data.chapterCountEditor = chapterCountEditor;
  }
  // contractSharePercent 取最后一次（或可以取平均值，这里简化处理）
  if (contractSharePercent) {
    data.contractSharePercent = contractSharePercent;
  }
}
```

**聚合策略**：
- `grossAmountUsd` 和 `editorIncomeUsd`：**累加**
- `chapterCountTotal` 和 `chapterCountEditor`：**取最大值**（因为同一小说多次订阅时这些值相同）
- `contractSharePercent`：**取最后一次**（简化处理）

**说明**：
- 在内存中，同一 `(editor_admin_id, novel_id, source_type, role)` 组合的多次消费会被聚合
- 例如：同一编辑在同一小说同一月份有 3 笔章节解锁消费，会被聚合成一条记录

### 3.3 写入逻辑

**位置**：第 391-433 行

```javascript
for (const [editorId, novelMap] of agg.entries()) {
  for (const [novelId, sourceMap] of novelMap.entries()) {
    for (const [sourceType, roleMap] of sourceMap.entries()) {
      for (const [role, data] of roleMap.entries()) {
        // ... 计算 editorSharePercent ...
        
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
      }
    }
  }
}
```

**写入字段**：
- ✅ `editor_admin_id`、`novel_id`、`month`（唯一约束字段）
- ✅ `source_type`、`role`（新增字段）
- ✅ `chapter_count_total`、`chapter_count_editor`（新增字段）
- ✅ `gross_book_income_usd`、`editor_share_percent`、`contract_share_percent`、`editor_income_usd`（金额字段）

**问题**：
- 虽然内存聚合结构区分了 `source_type` 和 `role`，但由于唯一约束 `(editor_admin_id, novel_id, month)`，不同 `source_type` 和 `role` 的记录会被合并
- 例如：
  - 第一次插入：`(editor_id=1, novel_id=7, month='2025-11-01', source_type='chapter_unlock', role='editor')`
  - 第二次插入：`(editor_id=1, novel_id=7, month='2025-11-01', source_type='subscription', role='editor')`
  - 结果：两条记录会被合并成一条，`source_type` 和 `role` 字段会保留第一次插入的值，金额会累加

**当前行为总结**：
- 内存聚合：按 `(editor_admin_id, novel_id, source_type, role)` 聚合
- 数据库写入：由于唯一约束，实际只能按 `(editor_admin_id, novel_id, month)` 存储
- 不同 `source_type` 和 `role` 的记录会被强制合并，导致信息丢失

---

## 四、admin.js 相关路由对 editor_income_monthly 的使用方式

### 4.1 POST /api/admin/editor-base-income/generate（生成编辑基础收入）

**文件路径**：`backend/routes/admin.js`  
**行号范围**：第 9444-9478 行

**功能**：调用 `generateEditorBaseIncomeForMonth` 生成编辑基础收入

**对唯一约束的假设**：
- ✅ 无直接假设，依赖服务层的实现

### 4.2 GET /api/admin/editor-base-income（查询编辑基础收入列表）

**文件路径**：`backend/routes/admin.js`  
**行号范围**：第 9481-9555 行

**SQL 查询**：第 9499-9518 行

```sql
SELECT
  eim.*,
  a.name AS editor_name,
  a.real_name AS editor_real_name,
  n.title AS novel_title
FROM editor_income_monthly eim
LEFT JOIN admin a ON eim.editor_admin_id = a.id
LEFT JOIN novel n ON eim.novel_id = n.id
WHERE eim.month = ?
  AND (? IS NULL OR a.name LIKE CONCAT('%', ?, '%') OR a.real_name LIKE CONCAT('%', ?, '%'))
  AND (? IS NULL OR n.title LIKE CONCAT('%', ?, '%'))
ORDER BY eim.editor_admin_id, eim.novel_id, eim.source_type, eim.role
LIMIT ? OFFSET ?
```

**排序**：`ORDER BY eim.editor_admin_id, eim.novel_id, eim.source_type, eim.role`

**对唯一约束的假设**：
- ⚠️ **部分假设**：排序字段包含 `source_type` 和 `role`，说明代码期望能区分不同来源和角色
- ⚠️ **但实际**：由于唯一约束，同一 `(editor_admin_id, novel_id, month)` 只能有一条记录，排序字段可能无效

**汇总统计**：第 9522-9531 行

```sql
SELECT
  COUNT(*) AS total_records,
  COALESCE(SUM(eim.editor_income_usd), 0) AS total_editor_income_usd,
  COUNT(DISTINCT eim.editor_admin_id) AS editor_count,
  COUNT(DISTINCT eim.novel_id) AS novel_count
FROM editor_income_monthly eim
WHERE eim.month = ?
```

**对唯一约束的假设**：
- ✅ **兼容多条记录**：使用 `SUM` 和 `COUNT(DISTINCT)`，天然支持多条记录

### 4.3 DELETE /api/admin/editor-base-income（删除当月编辑基础收入）

**文件路径**：`backend/routes/admin.js`  
**行号范围**：第 9558-9595 行

**SQL 删除**：第 9580-9583 行

```sql
DELETE FROM editor_income_monthly WHERE month = ?
```

**对唯一约束的假设**：
- ✅ **无假设**：按月份删除，不依赖唯一约束

### 4.4 旧路由：POST /api/admin/editor-income/calculate-champion（旧逻辑）

**文件路径**：`backend/routes/admin.js`  
**行号范围**：第 9600-9630 行（推测，基于 editorIncomeService 的调用）

**功能**：调用 `editorIncomeService.calculateChampionIncomeForNovel`（旧逻辑）

**对唯一约束的假设**：
- ✅ 无直接假设，依赖服务层的实现

---

## 五、如果取消/修改唯一约束可能影响的地方（静态风险评估）

### 5.1 直接依赖 editor_income_monthly 的地方

#### 5.1.1 查询接口（GET /api/admin/editor-base-income）

**当前实现**：
- 使用 `SELECT eim.*` 查询所有字段
- 排序：`ORDER BY eim.editor_admin_id, eim.novel_id, eim.source_type, eim.role`
- 汇总统计：使用 `SUM` 和 `COUNT(DISTINCT)`

**对唯一约束的隐含假设**：
- ⚠️ **部分假设**：排序字段包含 `source_type` 和 `role`，说明代码期望能区分不同来源和角色
- ✅ **兼容多条记录**：汇总统计使用聚合函数，天然支持多条记录

**如果取消唯一约束的影响**：
- ✅ **无负面影响**：查询接口天然支持多条记录
- ✅ **正面影响**：排序字段 `source_type` 和 `role` 会生效，可以正确区分不同来源和角色

#### 5.1.2 生成接口（POST /api/admin/editor-base-income/generate）

**当前实现**：
- 调用 `generateEditorBaseIncomeForMonth`
- 服务层在内存中按 `(editor_admin_id, novel_id, source_type, role)` 聚合
- 写入时使用 `INSERT ... ON DUPLICATE KEY UPDATE`

**对唯一约束的隐含假设**：
- ⚠️ **强依赖**：`ON DUPLICATE KEY UPDATE` 依赖唯一约束来检测冲突
- ⚠️ **问题**：不同 `source_type` 和 `role` 的记录会被强制合并

**如果取消唯一约束的影响**：
- ⚠️ **需要修改**：`ON DUPLICATE KEY UPDATE` 需要改为普通 `INSERT`，或使用新的唯一约束
- ✅ **正面影响**：可以正确区分不同 `source_type` 和 `role` 的记录

#### 5.1.3 删除接口（DELETE /api/admin/editor-base-income）

**当前实现**：
- 按月份删除：`DELETE FROM editor_income_monthly WHERE month = ?`

**对唯一约束的隐含假设**：
- ✅ **无假设**：不依赖唯一约束

**如果取消唯一约束的影响**：
- ✅ **无影响**：删除逻辑不依赖唯一约束

#### 5.1.4 旧逻辑（editorIncomeService.js）

**当前实现**：
- 基于 `novel_income_monthly` 表（可能不存在）
- 使用 `INSERT ... ON DUPLICATE KEY UPDATE` 写入

**对唯一约束的隐含假设**：
- ⚠️ **强依赖**：`ON DUPLICATE KEY UPDATE` 依赖唯一约束

**如果取消唯一约束的影响**：
- ⚠️ **需要修改**：旧逻辑也需要调整，但该逻辑可能已经废弃

### 5.2 如果修改唯一约束的方案

#### 方案 A：扩展唯一约束，包含 source_type 和 role

**新唯一约束**：
```sql
UNIQUE KEY `uniq_editor_month_novel_source_role` (`editor_admin_id`, `novel_id`, `month`, `source_type`, `role`)
```

**影响**：
- ✅ **editorBaseIncomeService.js**：`ON DUPLICATE KEY UPDATE` 可以继续使用，但需要确保插入时包含 `source_type` 和 `role`
- ✅ **查询接口**：排序字段 `source_type` 和 `role` 会生效
- ⚠️ **旧逻辑（editorIncomeService.js）**：需要修改，因为旧逻辑不插入 `source_type` 和 `role`，可能导致唯一约束冲突

**优点**：
- 可以区分不同 `source_type` 和 `role` 的记录
- 仍然可以防止完全重复的记录

**缺点**：
- 如果同一编辑在同一小说同一月份有多个不同周期的订阅（都需要 `source_type='subscription'` 和 `role='editor'`），仍然会被合并

#### 方案 B：取消唯一约束，仅保留主键

**新约束**：
```sql
-- 删除 UNIQUE KEY `uniq_editor_month_novel`
-- 仅保留 PRIMARY KEY (`id`)
```

**影响**：
- ⚠️ **editorBaseIncomeService.js**：需要修改 `ON DUPLICATE KEY UPDATE` 为普通 `INSERT`，或使用 `INSERT IGNORE` + 手动去重逻辑
- ✅ **查询接口**：天然支持多条记录
- ⚠️ **旧逻辑（editorIncomeService.js）**：需要修改

**优点**：
- 完全灵活，可以存储任意多条记录
- 可以区分不同周期的订阅（如果需要）

**缺点**：
- 无法防止完全重复的记录（需要在应用层处理）
- 如果同一编辑在同一小说同一月份有多次相同的消费，可能会产生重复记录

#### 方案 C：添加新的唯一字段（例如 reader_spending.id 或批次ID）

**新唯一约束**：
```sql
-- 添加 source_spend_id 字段
ALTER TABLE editor_income_monthly ADD COLUMN source_spend_id BIGINT NULL COMMENT '对应的 reader_spending.id';

-- 新的唯一约束
UNIQUE KEY `uniq_editor_month_novel_source` (`editor_admin_id`, `novel_id`, `month`, `source_type`, `role`, `source_spend_id`)
```

**影响**：
- ✅ **editorBaseIncomeService.js**：需要修改，在插入时包含 `source_spend_id`
- ✅ **查询接口**：可以按 `source_spend_id` 区分不同消费记录

**优点**：
- 可以精确追踪每条 `reader_spending` 记录对应的编辑收入
- 可以区分同一编辑在同一小说同一月份的不同订阅周期

**缺点**：
- 需要修改表结构，添加新字段
- 需要修改所有写入逻辑

### 5.3 现阶段真正使用 editor_income_monthly 的地方

**统计**：
1. ✅ **新逻辑（editorBaseIncomeService.js）**：编辑基础收入-4，从 `reader_spending` 生成
2. ⚠️ **旧逻辑（editorIncomeService.js）**：基于 `novel_income_monthly` 的旧逻辑，该表可能不存在
3. ✅ **查询接口（GET /api/admin/editor-base-income）**：前端页面展示
4. ✅ **删除接口（DELETE /api/admin/editor-base-income）**：删除当月数据

**结论**：
- **主要使用场景**：只有「编辑基础收入-4」这一个新逻辑在使用
- **旧逻辑**：可能已经废弃或未使用（依赖可能不存在的 `novel_income_monthly` 表）
- **调整风险**：相对较小，主要影响新逻辑和查询接口

### 5.4 风险评估总结

| 影响点 | 当前对唯一约束的依赖 | 如果取消/修改唯一约束的影响 | 风险等级 |
|--------|---------------------|---------------------------|---------|
| **GET /api/admin/editor-base-income** | 部分假设（排序字段） | ✅ 无负面影响，天然支持多条记录 | 🟢 低 |
| **POST /api/admin/editor-base-income/generate** | 强依赖（ON DUPLICATE KEY UPDATE） | ⚠️ 需要修改写入逻辑 | 🟡 中 |
| **DELETE /api/admin/editor-base-income** | 无依赖 | ✅ 无影响 | 🟢 低 |
| **editorIncomeService.js（旧逻辑）** | 强依赖（ON DUPLICATE KEY UPDATE） | ⚠️ 需要修改，但可能已废弃 | 🟡 中 |
| **前端页面** | 无直接依赖 | ✅ 无影响，查询接口已支持多条记录 | 🟢 低 |

---

## 六、总结与建议

### 6.1 当前现状总结

1. **数据库结构**：
   - 唯一约束：`(editor_admin_id, novel_id, month)` 强制同一编辑+小说+月份只能有一条记录
   - 新增字段：`source_type`、`role`、`chapter_count_total`、`chapter_count_editor`、`contract_share_percent` 已添加，但由于唯一约束无法充分利用

2. **代码实现**：
   - **内存聚合**：`editorBaseIncomeService.js` 在内存中按 `(editor_admin_id, novel_id, source_type, role)` 聚合
   - **数据库写入**：由于唯一约束，不同 `source_type` 和 `role` 的记录会被强制合并
   - **问题**：`ON DUPLICATE KEY UPDATE` 只更新金额字段，`source_type` 和 `role` 字段会保留第一次插入的值

3. **使用场景**：
   - **主要使用**：编辑基础收入-4（新逻辑）
   - **可能废弃**：基于 `novel_income_monthly` 的旧逻辑

### 6.2 修改建议

**推荐方案**：**方案 A（扩展唯一约束）**

**理由**：
1. 可以区分不同 `source_type` 和 `role` 的记录
2. 仍然可以防止完全重复的记录
3. 修改范围相对较小（主要是 `editorBaseIncomeService.js` 和 `editorIncomeService.js`）

**实施步骤**：
1. 修改唯一约束：`UNIQUE KEY (editor_admin_id, novel_id, month, source_type, role)`
2. 修改 `editorBaseIncomeService.js`：确保 `ON DUPLICATE KEY UPDATE` 包含 `source_type` 和 `role`
3. 修改 `editorIncomeService.js`：在插入时包含 `source_type` 和 `role`（或标记为废弃）
4. 测试验证：确保不同 `source_type` 和 `role` 的记录可以正确区分

**如果未来需要区分同一编辑在同一小说同一月份的不同订阅周期**：
- 可以考虑方案 C（添加 `source_spend_id` 字段）
- 或方案 B（取消唯一约束，仅保留主键）

---

**报告完成时间**：2025-11-29  
**下一步**：根据此报告，可以开始设计具体的修改方案和实施步骤

