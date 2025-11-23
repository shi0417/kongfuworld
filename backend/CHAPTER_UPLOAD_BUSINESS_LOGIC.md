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

### 2.1 前50章节（chapter_number <= 50）
```javascript
is_advance = 0
key_cost = 0
unlock_price = 0
```
- **说明**: 免费章节，无需解锁

### 2.2 第50章节之后（chapter_number > 50）

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

#### 2.2.3 unlock_price 设置逻辑

**步骤1**: 获取小说的 user_id
```sql
SELECT user_id FROM novel WHERE id = ?
```

**步骤2**: 查询 unlockprice 表
```sql
SELECT fixed_style, fixed_cost, random_cost_min, random_cost_max
FROM unlockprice
WHERE novel_id = ? AND user_id = ?
LIMIT 1
```

**步骤3**: 根据查询结果设置 unlock_price

- **如果没有数据**:
  1. 创建一条记录：`fixed_style=1`, `fixed_cost=20`
  2. `unlock_price = 20`（即 `fixed_cost` 值）

- **如果有数据**:
  - **如果 `fixed_style = 1`**（固定模式）:
    ```javascript
    unlock_price = fixed_cost
    ```
  - **如果 `fixed_style != 1`**（随机模式）:
    ```javascript
    // unlock_price 为 random_cost_min 到 random_cost_max 之间的随机值
    // 使用章节号作为种子，确保同一章节号总是得到相同的价格
    const range = random_cost_max - random_cost_min + 1;
    const seed = chapter_number * 7919; // 使用质数作为乘数
    unlock_price = (seed % range) + random_cost_min;
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

1. **is_advance 逻辑**: 确保预读章节数量不超过最大 tier_level 的 advance_chapters 值
2. **unlock_price 逻辑**: 随机模式下使用章节号作为种子，确保同一章节号总是得到相同的价格
3. **review_status**: 发布章节进入审核流程（`submitted`），不是直接通过（`approved`）
4. **章节设置**: 两个按钮的章节设置逻辑完全相同，只有 `review_status` 不同

