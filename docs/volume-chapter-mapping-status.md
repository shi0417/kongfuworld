# Volume-Chapter 映射现状分析报告

**生成时间**：待运行脚本后填写  
**分析目标**：摸清当前数据库中 `volume` 和 `chapter` 之间的映射关系，区分"旧设计"和"新设计"的使用情况

---

## 一、表结构说明

### 1.1 volume 表结构

根据 `backend/database_schema.sql`：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | int | 主键，自增 |
| `novel_id` | int | 小说ID（外键关联 `novel.id`） |
| `volume_id` | int | 卷ID（用于关联章节，旧设计使用此字段） |
| `title` | varchar(255) | 卷标题 |
| `start_chapter` | int | 起始章节号 |
| `end_chapter` | int | 结束章节号 |
| `chapter_count` | int | 章节数量 |

### 1.2 chapter 表结构

根据 `backend/database_schema.sql`：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | int | 主键，自增 |
| `novel_id` | int | 小说ID（外键关联 `novel.id`） |
| `volume_id` | int | **卷关联字段**（关键字段） |
| `chapter_number` | int | 章节号 |
| `title` | varchar(255) | 章节标题 |
| `content` | text | 章节内容 |
| `created_at` | datetime | 创建时间 |
| ... | ... | 其他字段（审核状态、解锁价格等） |

### 1.3 映射设计说明

**旧设计**：
- `chapter.volume_id` = `volume.volume_id`
- 前提：`chapter.novel_id` = `volume.novel_id`

**新设计**：
- `chapter.volume_id` = `volume.id`
- 前提：`chapter.novel_id` = `volume.novel_id`

**问题**：
- 如果 `chapter.volume_id` 既不是任何 `volume.id`，也不是任何 `volume.volume_id`（在同小说下），则该章节为"孤立章节"，映射关系断裂。

---

## 二、总体统计

> **注意**：以下数据需要运行检查脚本后填充

### 2.1 基础统计

- **总小说数量**：待填充
- **总卷数量**：待填充
- **总章节数量**：待填充

### 2.2 映射情况统计

- **使用新设计的章节数量**：待填充（按小说分组统计）
- **使用旧设计的章节数量**：待填充（按小说分组统计）
- **孤立章节数量**：待填充（既不是新设计也不是旧设计）

---

## 三、按小说维度的映射情况

> **注意**：以下数据需要运行检查脚本后，从 `perNovelCounts`、`newMappingStats`、`oldMappingStats` 中提取并整理

| 小说ID | 小说标题 | 卷数量 | 章节数量 | 新设计章节数 | 旧设计章节数 | 孤立章节数 | 状态 |
|--------|---------|--------|---------|-------------|-------------|-----------|------|
| 待填充 | 待填充 | 待填充 | 待填充 | 待填充 | 待填充 | 待填充 | 待填充 |

**状态说明**：
- ✅ **已迁移**：新设计章节数 = 章节总数，旧设计章节数 = 0
- 🔄 **部分迁移**：新设计章节数 > 0 且 旧设计章节数 > 0
- ❌ **未迁移**：新设计章节数 = 0，旧设计章节数 > 0
- ⚠️ **有孤立**：孤立章节数 > 0

---

## 四、典型小说详细分析

> **注意**：以下数据需要运行检查脚本后，从 `sampleNovels` 中提取并分析

### 4.1 novel_id = 7（示例：已迁移的小说）

**卷列表**：
```
待填充（从 sampleNovels[7].volumes 提取）
```

**章节映射情况**：
```
待填充（从 sampleNovels[7].chapters 提取）
- 分析：哪些章节使用新设计（matched_volume_id_by_id 不为 NULL）
- 分析：哪些章节使用旧设计（matched_volume_id_by_old 不为 NULL）
- 分析：是否有孤立章节（两个匹配字段都为 NULL）
```

**结论**：
- 待填充

---

### 4.2 其他典型小说

> 根据脚本输出的 `sampleNovels` 对象，为每个小说ID创建类似的分析小节

---

## 五、问题总结

### 5.1 发现的问题

1. **待填充**：根据脚本输出的 `orphanChaptersSample` 分析孤立章节情况

2. **待填充**：根据 `newMappingStats` 和 `oldMappingStats` 分析哪些小说需要迁移

3. **待填充**：是否存在同一小说下新旧设计混用的情况

### 5.2 迁移建议（仅列出问题，不提供具体 SQL）

1. **优先迁移的小说**：
   - 待填充（列出旧设计章节数较多的小说）

2. **需要处理的孤立章节**：
   - 待填充（列出孤立章节数量较多的小说）

3. **迁移策略建议**：
   - 待填充（根据实际情况提出）

---

## 六、运行检查脚本

### 6.1 运行方式

```bash
cd backend
node scripts/inspect-volume-chapter-mapping.js > scripts/inspect-volume-chapter-mapping-output.json
```

### 6.2 查看结果

脚本会输出 JSON 格式的结构化数据，包含：
- `overview`：总体统计
- `perNovelCounts`：每本小说的卷/章数量
- `newMappingStats`：新设计匹配的章节统计
- `oldMappingStats`：旧设计匹配的章节统计
- `orphanChaptersSample`：孤立章节样本（最多200条）
- `sampleNovels`：代表性小说的详细数据

### 6.3 填充报告

运行脚本后，将输出 JSON 中的数据填充到本报告的相应位置。

---

## 七、注意事项

⚠️ **本次分析为只读操作，不修改任何数据**

- 脚本只执行 `SELECT` 查询
- 不执行任何 `UPDATE` / `DELETE` / `INSERT` 操作
- 后续迁移操作需要单独的实现指令

---

**报告状态**：待运行脚本后填充数据

