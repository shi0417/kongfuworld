# 🎯 新章节判断逻辑完整分析

## 📋 触发时机

**新章节判断的触发时机**：用户调用 `/api/user/:userId/read-chapter` API 时

## 🔄 完整执行流程

### 1. **API入口** (`/api/user/:userId/read-chapter`)

```javascript
app.post('/api/user/:userId/read-chapter', async (req, res) => {
  const { userId } = req.params;
  const { chapterId } = req.body;
  
  // 1. 检查章节是否存在
  // 2. 获取用户信息
  // 3. 检查并处理时间解锁状态
  // 4. 获取章节解锁信息
  // 5. 检查Champion会员解锁状态
  // 6. 综合判断解锁状态
  // 7. 检查是否有历史阅读记录
  // 8. 记录阅读日志
  // 9. 执行新章节判断逻辑 ← 关键步骤
  // 10. 更新任务进度（如果是新章节）
});
```

### 2. **解锁状态检查阶段**

#### **2.1 检查chapter_unlocks表**
```javascript
const [unlockInfo] = await db.execute(`
  SELECT 
    CASE 
      WHEN COUNT(*) > 0 THEN 1 
      ELSE 0 
    END as is_unlocked,
    MAX(unlocked_at) as unlock_time
  FROM chapter_unlocks 
  WHERE user_id = ? AND chapter_id = ? AND status = 'unlocked'
`, [userId, chapterId]);
```

#### **2.2 检查Champion会员状态**
```javascript
const [championSubs] = await db.execute(`
  SELECT * FROM user_champion_subscription 
  WHERE user_id = ? AND novel_id = ? AND is_active = 1 AND end_date > NOW()
`, [userId, chapter.novel_id]);
```

#### **2.3 综合判断解锁状态**
```javascript
const isUnlocked = unlockInfo[0].is_unlocked || hasValidChampion;
const unlockTime = unlockInfo[0].unlock_time || (hasValidChampion ? new Date() : null);
```

### 3. **阅读记录记录阶段**

#### **3.1 检查历史阅读记录**
```javascript
const [existingRecords] = await db.execute(`
  SELECT COUNT(*) as count FROM reading_log 
  WHERE user_id = ? AND chapter_id = ?
`, [userId, chapterId]);
```

#### **3.2 记录阅读日志**
```javascript
if (hasHistoryRecords) {
  // 有历史记录，更新今天的记录
  UPDATE reading_log SET read_at = NOW(), is_unlocked = ?, unlock_time = ?
  WHERE user_id = ? AND chapter_id = ? AND DATE(read_at) = CURDATE()
} else {
  // 没有历史记录，首次阅读，插入新记录
  INSERT INTO reading_log (user_id, chapter_id, read_at, is_unlocked, unlock_time) 
  VALUES (?, ?, NOW(), ?, ?)
}
```

### 4. **新章节判断阶段** (`checkIsNewChapterImproved`)

#### **4.1 数据收集**
```javascript
// 1. 查询章节基本信息
// 2. 查询用户Champion会员状态
// 3. 查询该章节的所有阅读记录
// 4. 查询该章节的解锁记录
// 5. 分析阅读记录（今天 vs 历史）
// 6. 检查今天是否有解锁记录
// 7. 检查Champion会员解锁状态
```

#### **4.2 判断逻辑**

## 🎯 不同解锁情况的新章节判断逻辑

### **情况1：免费章节**
```javascript
// 判断条件：只有今天首次阅读才算新章节
if (todayReadingRecords.length === 1 && historyReadingRecords.length === 0) {
  isNewChapter = true;
  reason = '免费章节，今天首次阅读该章节';
}
```

**触发时机**：用户阅读免费章节时
**判断标准**：今天首次阅读 = 新章节

### **情况2：Champion会员付费章节**
```javascript
// 判断条件：只有今天首次阅读才算新章节
if (hasValidChampion) {
  if (todayReadingRecords.length === 1 && historyReadingRecords.length === 0) {
    isNewChapter = true;
    reason = '有有效Champion会员，今天首次阅读该章节';
  }
}
```

**触发时机**：用户阅读付费章节时，且用户有有效Champion会员
**判断标准**：今天首次阅读 = 新章节

### **情况3：无Champion会员付费章节（Key/Karma购买）**
```javascript
// 判断条件：今天解锁就算新章节（不管是否今天首次阅读）
if (!hasValidChampion) {
  if (todayUnlockRecords.length > 0) {
    isNewChapter = true;
    reason = '无Champion会员，今天解锁该章节';
  }
}
```

**触发时机**：用户阅读付费章节时，且用户无Champion会员
**判断标准**：今天解锁 = 新章节

### **情况4：特殊处理 - Champion会员解锁**
```javascript
// 特殊处理：Champion会员解锁的章节（覆盖之前的判断）
if (isChampionUnlocked) {
  isNewChapter = true;
  reason = 'Champion会员解锁，今天首次阅读该章节';
}
```

**触发时机**：Champion会员今天首次阅读付费章节
**判断标准**：Champion会员 + 今天首次阅读 = 新章节

## 📊 解锁方式对比表

| 解锁方式 | 触发时机 | 判断标准 | 解锁记录位置 | 新章节条件 |
|---------|---------|---------|-------------|-----------|
| **免费章节** | 用户阅读时 | 今天首次阅读 | reading_log表 | 今天首次阅读 |
| **Champion会员** | 用户阅读时 | 今天首次阅读 | reading_log表 | 今天首次阅读 |
| **Key购买** | 用户购买时 | 今天解锁 | chapter_unlocks表 | 今天解锁 |
| **Karma购买** | 用户购买时 | 今天解锁 | chapter_unlocks表 | 今天解锁 |
| **时间解锁** | 时间到期时 | 今天解锁 | chapter_unlocks表 | 今天解锁 |

## 🔄 代码执行顺序

### **步骤1：API调用**
```
POST /api/user/:userId/read-chapter
```

### **步骤2：解锁状态检查**
```
1. 检查chapter_unlocks表
2. 检查Champion会员状态
3. 综合判断解锁状态
```

### **步骤3：阅读记录记录**
```
1. 检查历史阅读记录
2. 记录或更新reading_log表
```

### **步骤4：新章节判断**
```
1. 调用checkIsNewChapterImproved函数
2. 根据章节类型和用户状态判断
3. 返回判断结果
```

### **步骤5：任务进度更新**
```
1. 如果是新章节，更新任务进度
2. 记录任务完成日志
3. 返回API响应
```

## 🎯 关键判断条件

### **免费章节**
- ✅ 今天首次阅读 = 新章节
- ❌ 以前阅读过 = 不是新章节

### **Champion会员付费章节**
- ✅ 今天首次阅读 = 新章节
- ❌ 以前阅读过 = 不是新章节

### **Key/Karma购买付费章节**
- ✅ 今天解锁 = 新章节
- ❌ 今天未解锁 = 不是新章节

### **时间解锁付费章节**
- ✅ 今天解锁 = 新章节
- ❌ 今天未解锁 = 不是新章节

## 📝 总结

新章节判断逻辑的核心是：
1. **免费章节和Champion会员章节**：基于阅读记录判断（今天首次阅读）
2. **Key/Karma购买章节**：基于解锁记录判断（今天解锁）
3. **时间解锁章节**：基于解锁记录判断（今天解锁）

所有判断都在用户阅读章节时触发，通过`/api/user/:userId/read-chapter` API执行。
