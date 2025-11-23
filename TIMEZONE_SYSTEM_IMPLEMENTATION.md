# 时区系统实现文档

## 🌍 问题背景

在WuxiaWorld等国际化应用中，用户分布在全球各地，时区不同。如何公平地界定"每日签到"是一个重要问题。

### 核心挑战
- 用户A在北京时间10月7日23:59签到
- 用户B在纽约时间10月7日23:59签到  
- 两者实际相差12小时，但都算"10月7日"签到

## 🛠️ 解决方案

### 1. 时区处理策略

#### **WuxiaWorld的做法**
- 提供"Show awarded time in UTC"开关
- 用户可以选择显示本地时间或UTC时间
- 签到基于用户的本地时区计算

#### **我们的实现**
- 支持15个主要时区
- 签到基于用户时区的"今天"
- 提供时区切换功能

### 2. 技术实现

#### **后端时区处理**
```javascript
// 获取用户时区的"今天"
const today = timezoneHandler.getUserToday(userTimezone);

// 获取用户时区的当前时间
const userNow = timezoneHandler.getUserNow(userTimezone);

// 计算距离下次重置的时间
const timeUntilReset = timezoneHandler.getTimeUntilReset(userTimezone);
```

#### **API支持时区参数**
```javascript
// 签到API
POST /api/checkin/:userId
{
  "timezone": "Asia/Shanghai"
}

// 获取签到状态
GET /api/checkin/status/:userId?timezone=Asia/Shanghai
```

### 3. 支持的时区列表

| 时区 | 地区 | UTC偏移 | 用户数量 |
|------|------|---------|----------|
| Asia/Shanghai | 中国 | +08:00 | 最多 |
| America/New_York | 美国东部 | -04:00 | 多 |
| America/Los_Angeles | 美国西部 | -07:00 | 多 |
| Europe/London | 英国 | +01:00 | 多 |
| Europe/Paris | 法国 | +02:00 | 多 |
| Asia/Tokyo | 日本 | +09:00 | 多 |
| Asia/Seoul | 韩国 | +09:00 | 多 |
| Asia/Singapore | 新加坡 | +08:00 | 多 |
| Australia/Sydney | 澳大利亚 | +11:00 | 多 |
| America/Toronto | 加拿大 | -04:00 | 多 |
| America/Sao_Paulo | 巴西 | -03:00 | 多 |
| Asia/Kolkata | 印度 | +05:30 | 多 |
| Europe/Moscow | 俄罗斯 | +03:00 | 多 |
| Africa/Cairo | 埃及 | +03:00 | 多 |
| UTC | 世界标准时间 | +00:00 | 默认 |

### 4. 签到逻辑

#### **时区处理流程**
1. **获取用户时区**：从请求参数或用户设置获取
2. **计算用户"今天"**：基于用户时区的日期
3. **检查签到状态**：查询该时区的"今天"是否已签到
4. **执行签到**：记录用户时区的签到时间
5. **更新任务**：基于用户时区更新任务进度

#### **数据库设计**
```sql
-- 签到记录表（支持时区）
CREATE TABLE daily_checkin (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  checkin_date DATE NOT NULL,  -- 用户时区的日期
  keys_earned INT NOT NULL,
  streak_days INT NOT NULL,
  total_keys INT NOT NULL,
  timezone VARCHAR(50) DEFAULT 'UTC',  -- 用户时区
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 5. 前端实现

#### **时区选择器**
```jsx
// 时区切换开关
<div className={styles.timezoneToggle}>
  <label className={styles.toggleLabel}>
    <input 
      type="checkbox" 
      checked={showUTC}
      onChange={(e) => setShowUTC(e.target.checked)}
    />
    <span className={styles.toggleSlider}></span>
    Show awarded time in UTC
  </label>
</div>
```

#### **时间显示**
```jsx
// 根据用户选择显示本地时间或UTC时间
const displayTime = showUTC ? utcTime : localTime;
```

### 6. 使用示例

#### **不同时区用户的签到**
```javascript
// 北京用户 (UTC+8)
const beijingUser = {
  timezone: 'Asia/Shanghai',
  today: '2025-10-07',  // 北京时间10月7日
  resetTime: '2025-10-08 00:00:00'  // 北京时间10月8日0点
};

// 纽约用户 (UTC-4)
const nyUser = {
  timezone: 'America/New_York', 
  today: '2025-10-07',  // 纽约时间10月7日
  resetTime: '2025-10-08 00:00:00'  // 纽约时间10月8日0点
};
```

#### **API调用示例**
```javascript
// 北京用户签到
fetch('/api/checkin/1', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ timezone: 'Asia/Shanghai' })
});

// 纽约用户签到  
fetch('/api/checkin/2', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ timezone: 'America/New_York' })
});
```

### 7. 测试验证

#### **时区测试脚本**
```bash
# 运行时区测试
node test_timezone_system.js
```

#### **测试结果**
```
🌍 时区系统测试

1. 测试不同时区的"今天":
   UTC: 2025-10-07
   Asia/Shanghai: 2025-10-07 (+08:00)
   America/New_York: 2025-10-07 (-04:00)
   Europe/London: 2025-10-07 (+01:00)

2. 测试重置时间:
   UTC: 下次重置 15:31 小时后
   Asia/Shanghai: 下次重置 7:31 小时后
   America/New_York: 下次重置 19:31 小时后
```

### 8. 优势特点

#### **公平性**
- 每个用户基于自己的时区计算"今天"
- 避免时区差异导致的不公平

#### **灵活性**
- 支持15个主要时区
- 用户可以选择显示本地时间或UTC时间

#### **准确性**
- 精确处理夏令时变化
- 自动计算时区偏移

#### **用户体验**
- 直观的时间显示
- 清晰的时区切换选项

## 🎯 总结

通过实现完整的时区处理系统，我们解决了国际化应用中的时区问题：

1. **公平的签到机制**：每个用户基于自己的时区计算签到
2. **灵活的时间显示**：支持本地时间和UTC时间切换
3. **准确的时间计算**：处理夏令时和时区偏移
4. **良好的用户体验**：直观的界面和清晰的操作

这个系统完全匹配WuxiaWorld的时区处理方式，为全球用户提供了公平、准确的签到体验。
