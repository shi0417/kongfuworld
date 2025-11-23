# 🔄 新章节判断逻辑流程图

## 📋 完整执行流程

```
用户阅读章节
    ↓
POST /api/user/:userId/read-chapter
    ↓
1. 检查章节是否存在
    ↓
2. 获取用户信息
    ↓
3. 检查并处理时间解锁状态
    ↓
4. 获取章节解锁信息 (chapter_unlocks表)
    ↓
5. 检查Champion会员解锁状态
    ↓
6. 综合判断解锁状态
    ↓
7. 检查是否有历史阅读记录
    ↓
8. 记录阅读日志 (reading_log表)
    ↓
9. 执行新章节判断逻辑 ← 关键步骤
    ↓
10. 更新任务进度（如果是新章节）
    ↓
返回API响应
```

## 🎯 新章节判断逻辑详细流程

```
checkIsNewChapterImproved函数
    ↓
1. 查询章节基本信息 (is_premium)
    ↓
2. 查询用户Champion会员状态
    ↓
3. 查询该章节的所有阅读记录
    ↓
4. 查询该章节的解锁记录
    ↓
5. 分析阅读记录（今天 vs 历史）
    ↓
6. 检查今天是否有解锁记录
    ↓
7. 检查Champion会员解锁状态
    ↓
8. 根据章节类型和用户状态判断
    ↓
返回判断结果
```

## 📊 不同解锁情况的判断逻辑

### **免费章节**
```
免费章节判断
    ↓
今天首次阅读？ → 是 → 新章节
    ↓
否 → 不是新章节
```

### **Champion会员付费章节**
```
Champion会员付费章节判断
    ↓
今天首次阅读？ → 是 → 新章节
    ↓
否 → 不是新章节
```

### **Key/Karma购买付费章节**
```
Key/Karma购买付费章节判断
    ↓
今天解锁？ → 是 → 新章节
    ↓
否 → 不是新章节
```

### **时间解锁付费章节**
```
时间解锁付费章节判断
    ↓
今天解锁？ → 是 → 新章节
    ↓
否 → 不是新章节
```

## 🔍 关键判断条件

### **阅读记录分析**
```javascript
// 今天阅读记录
const todayReadingRecords = allReadingRecords.filter(record => {
  const recordDate = new Date(record.read_at).toISOString().slice(0, 10);
  return recordDate === today;
});

// 历史阅读记录
const historyReadingRecords = allReadingRecords.filter(record => {
  const recordDate = new Date(record.read_at).toISOString().slice(0, 10);
  return recordDate !== today;
});
```

### **解锁记录分析**
```javascript
// 今天解锁记录
const todayUnlockRecords = unlockRecords.filter(record => {
  const unlockDate = new Date(record.unlocked_at || record.created_at).toISOString().slice(0, 10);
  return unlockDate === today && record.status === 'unlocked';
});
```

### **Champion会员解锁分析**
```javascript
// Champion会员解锁状态
const isChampionUnlocked = hasValidChampion && 
  todayReadingRecords.length === 1 && 
  historyReadingRecords.length === 0;
```

## 🎯 判断结果

### **新章节 = true 的情况**
1. **免费章节**：今天首次阅读
2. **Champion会员付费章节**：今天首次阅读
3. **Key/Karma购买付费章节**：今天解锁
4. **时间解锁付费章节**：今天解锁
5. **Champion会员解锁**：今天首次阅读且有效Champion会员

### **新章节 = false 的情况**
1. **免费章节**：以前阅读过或今天多次阅读
2. **Champion会员付费章节**：以前阅读过或今天多次阅读
3. **Key/Karma购买付费章节**：今天未解锁
4. **时间解锁付费章节**：今天未解锁
5. **Champion会员解锁**：今天未阅读或以前阅读过

## 📝 总结

新章节判断逻辑的核心是：
- **基于阅读记录**：免费章节和Champion会员章节
- **基于解锁记录**：Key/Karma购买章节和时间解锁章节
- **特殊处理**：Champion会员解锁的章节

所有判断都在用户阅读章节时触发，通过`/api/user/:userId/read-chapter` API执行。
