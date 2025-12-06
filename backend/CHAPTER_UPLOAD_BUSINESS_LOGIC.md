# 上传章节页面业务逻辑说明

## 概述
本文档说明上传章节页面中"发布章节"和"存为草稿"两个按钮的完整业务逻辑。

## 1. review_status 设置逻辑

### 发布章节按钮
- **前端参数**: `is_visible='1'`, `is_draft='0'`
- **后端处理**: `review_status = 'submitted'`
- **说明**: 章节进入审核流程，出现在"章节管理"选项卡中（`review_status != 'draft'`）

### 存为草稿按钮
- **前端参数**: `is_visible='0'`, `is_draft='1'`
- **后端处理**: `review_status = 'draft'`
- **说明**: 章节保存为草稿，出现在"草稿箱"选项卡中（`review_status = 'draft'`）

## 2. 章节设置逻辑（两个按钮相同）

### 2.1 免费章节判断

免费章节的判断基于 `unlockprice.default_free_chapters` 字段，每本书可以有不同的免费章节数。

**判断逻辑**：
```javascript
if (chapter_number <= unlockprice.default_free_chapters) {
  // 免费章节
  is_advance = 0
  key_cost = 0
  unlock_price = 0
} else {
  // 收费章节
  // 继续处理 key_cost、is_advance 和 unlock_price
}
```

**说明**：
- 免费章节范围由 `unlockprice.default_free_chapters` 决定，不再硬编码
- 免费章节不应该是预读章节（`is_advance = 0`）
- 免费章节不需要钥匙解锁（`key_cost = 0`）
- 免费章节解锁价格为 0（`unlock_price = 0`）

### 2.2 收费章节设置逻辑（chapter_number > default_free_chapters）

#### 2.2.1 key_cost 设置
```javascript
key_cost = 1
```
- **说明**: 默认需要1把钥匙解锁

#### 2.2.2 is_advance 设置逻辑

**步骤1**: 检查小说的 champion_status
```sql
SELECT champion_status FROM novel WHERE id = ?
```

**步骤2**: 如果 `champion_status != 'approved'`
```javascript
is_advance = 0
```

**步骤3**: 如果 `champion_status = 'approved'`
1. 查询最大 `tier_level` 的 `advance_chapters` 值（设为A）
   ```sql
   SELECT advance_chapters
   FROM novel_champion_tiers
   WHERE novel_id = ? AND is_active = 1
     AND tier_level = (
       SELECT MAX(tier_level)
       FROM novel_champion_tiers
       WHERE novel_id = ? AND is_active = 1
     )
   LIMIT 1
   ```

2. 查询该小说 `chapter` 表中 `is_advance=1` 的数据条数（设为B）
   ```sql
   SELECT COUNT(*) as count
   FROM chapter
   WHERE novel_id = ? AND is_advance = 1
   ```

3. 比较 A 和 B：
   - **如果 A > B**: 新增数据时直接设定 `is_advance=1`
   - **如果 A = B**: 
     - 新增数据时 `is_advance=1`
     - 同时设定倒数第 `A+1` 条 `is_advance=1` 的数据的 `is_advance=0`
     ```sql
     -- 查找倒数第 A+1 条 is_advance=1 的数据
     SELECT id
     FROM chapter
     WHERE novel_id = ? AND is_advance = 1
     ORDER BY chapter_number DESC
     LIMIT 1 OFFSET ?
     -- OFFSET 值为 maxAdvanceChapters（即 A）
     ```
   - **如果 A < B**: `is_advance=0`（理论上不应该发生）

#### 2.2.3 unlock_price 设置逻辑（按字数计价）

**步骤1**: 获取小说的 user_id
```sql
SELECT user_id FROM novel WHERE id = ?
```

**步骤2**: 查询 unlockprice 表
```sql
SELECT karma_per_1000, min_karma, max_karma, default_free_chapters
FROM unlockprice
WHERE novel_id = ? AND user_id = ?
LIMIT 1
```

**步骤3**: 根据查询结果设置 unlock_price

- **如果没有数据**:
  1. 创建一条默认记录：`karma_per_1000=6`, `min_karma=5`, `max_karma=30`, `default_free_chapters=50`, `pricing_style='per_word'`
  2. 使用默认配置计算价格

- **如果有数据**:
  - **按字数计价**（`pricing_style = 'per_word'`）:
    ```javascript
    // 1. 如果 chapter_number <= default_free_chapters，返回 0
    // 2. 如果 word_count <= 0，返回 min_karma
    // 3. 否则：
    base_price = Math.ceil((word_count / 1000) * karma_per_1000)
    unlock_price = clamp(base_price, min_karma, max_karma)
    ```

## 3. 数据流程

### 发布章节流程
```
前端 → is_visible='1', is_draft='0' 
  → 后端处理章节设置（is_advance, key_cost, unlock_price）
  → review_status='submitted'
  → 保存到 chapter 表
  → 出现在"章节管理"选项卡
```

### 存为草稿流程
```
前端 → is_visible='0', is_draft='1'
  → 后端处理章节设置（is_advance, key_cost, unlock_price）
  → review_status='draft'
  → 保存到 chapter 表
  → 出现在"草稿箱"选项卡
```

## 4. 关键代码位置

### 后端
- **文件**: `backend/routes/novelCreation.js`
- **创建章节**: `POST /api/chapter/create` (第848行)
- **更新章节**: `POST /api/chapter/update` (第1131行)

### 前端
- **文件**: `frontend/src/pages/ChapterWriter.tsx`
- **存为草稿**: `saveDraft()` 函数 (第823行)
- **发布章节**: `handlePublish()` 函数 (第1483行)

## 5. 注意事项

1. **免费章节判断**: 基于 `unlockprice.default_free_chapters` 字段，不再硬编码固定值
2. **is_advance 逻辑**: 确保预读章节数量不超过最大 tier_level 的 advance_chapters 值，且只有收费章节才考虑预读
3. **unlock_price 逻辑**: 使用按字数计价模式（`pricing_style = 'per_word'`），计算公式为 `base_price = ceil(word_count / 1000) * karma_per_1000`，然后限制在 `[min_karma, max_karma]` 区间内
4. **review_status**: 发布章节进入审核流程（`submitted`），不是直接通过（`approved`）
5. **章节设置**: 两个按钮的章节设置逻辑完全相同，只有 `review_status` 不同

