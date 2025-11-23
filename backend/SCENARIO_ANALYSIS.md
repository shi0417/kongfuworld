# 场景分析文档 - 新章节判断逻辑

## 🎯 场景2：付费章节今天解锁（修正版）

### 📊 用户情况
- 用户对该小说**没有**Champion会员资格
- 或者Champion会员资格**已经过期**
- 用户只能通过以下方式解锁：
  - 时间等待解锁（23小时后）
  - Key解锁
  - Karma解锁

### 🔄 具体流程

#### **第1步：用户昨天阅读但未解锁**
```sql
-- 2025-10-17 15:00:00
-- 用户阅读章节101，但未解锁
-- reading_log 表记录：
user_id | chapter_id | read_at
1       | 101        | 2025-10-17 15:00:00

-- chapter_unlocks 表状态：
-- 无记录（用户未解锁）
```

#### **第2步：用户今天解锁章节**
```sql
-- 2025-10-18 08:30:00
-- 用户通过Karma解锁章节101
-- chapter_unlocks 表新增记录：
user_id | chapter_id | unlock_method | status | unlocked_at
1       | 101        | karma       | unlocked | 2025-10-18 08:30:00
```

#### **第3步：用户今天重新阅读**
```sql
-- 2025-10-18 09:00:00
-- 用户重新阅读章节101
-- reading_log 表更新记录：
user_id | chapter_id | read_at
1       | 101        | 2025-10-18 09:00:00  ← 更新为今天的时间
```

### 🎯 判断逻辑

#### **A. 查询阅读记录**
```sql
SELECT id, read_at, DATE(read_at) as read_date
FROM reading_log 
WHERE user_id = 1 AND chapter_id = 101
ORDER BY read_at ASC

-- 结果：
id | read_at              | read_date
1  | 2025-10-18 09:00:00  | 2025-10-18
```

#### **B. 查询解锁记录**
```sql
SELECT id, unlock_method, status, unlocked_at, created_at
FROM chapter_unlocks 
WHERE user_id = 1 AND chapter_id = 101
ORDER BY created_at ASC

-- 结果：
id | unlock_method | status   | unlocked_at        | created_at
1  | karma         | unlocked | 2025-10-18 08:30:00 | 2025-10-18 08:30:00
```

#### **C. 判断逻辑**
```javascript
// 1. 今天阅读记录：1条
const todayReadingRecords = 1;

// 2. 历史阅读记录：0条（因为只有一条记录，且是今天的）
const historyReadingRecords = 0;

// 3. 今天解锁记录：1条
const todayUnlockRecords = 1;

// 4. 判断结果：
if (todayReadingRecords === 1 && historyReadingRecords === 0) {
  return {
    isNewChapter: true,
    reason: '今天首次阅读该章节'
  };
}
```

### 🎮 关键理解

#### **A. 为什么算作新章节？**
1. **今天解锁**：用户今天才真正获得访问权限
2. **今天阅读**：用户今天才真正能够阅读内容
3. **以前未解锁**：虽然以前阅读过，但没有解锁权限

#### **B. 解锁时机的重要性**
```javascript
// 解锁时机是关键判断标准
// 用户今天解锁 = 用户今天获得访问权限
// 这是用户真正能够"阅读新章节"的时机
```

### 📊 其他相关场景

#### **场景2A：用户今天解锁但昨天没有阅读过**
```sql
-- reading_log 表：无记录
-- chapter_unlocks 表：今天解锁
-- 结果：算作新章节 ✅
```

#### **场景2B：用户今天解锁，昨天阅读过，今天重新阅读**
```sql
-- reading_log 表：今天1条记录
-- chapter_unlocks 表：今天解锁
-- 结果：算作新章节 ✅
```

#### **场景2C：用户今天解锁，昨天阅读过，今天多次阅读**
```sql
-- reading_log 表：今天多条记录
-- chapter_unlocks 表：今天解锁
-- 结果：不算新章节 ❌ (今天多次阅读)
```

### 🎯 总结

**场景2的正确判断：**
- ✅ **算作新章节** → 更新任务进度
- **原因**：用户今天解锁，这是真正获得访问权限的时机
- **关键**：解锁时机比历史阅读记录更重要

**判断标准：**
1. 今天阅读 ✅
2. 今天解锁 ✅ (关键！)
3. 以前阅读过但未解锁 ✅ (这是允许的)

这个逻辑确保了用户通过解锁获得真正访问权限时，能够获得任务进度的奖励！
