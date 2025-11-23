# Reading Log 时间追踪功能实施指南

## 📋 概述

本指南详细说明如何在现有的 `reading_log` 系统基础上添加3个时间追踪字段：
- `page_enter_time`: 进入页面的时间
- `page_exit_time`: 离开页面的时间  
- `stay_duration`: 停留时间（秒）

## 🗄️ 数据库更新

### 步骤1: 运行数据库更新脚本
```bash
cd backend
node add_reading_timing_fields.js
```

### 步骤2: 验证表结构
```sql
DESCRIBE reading_log;
```

预期结果应包含新字段：
- `page_enter_time` DATETIME NULL
- `page_exit_time` DATETIME NULL  
- `stay_duration` INT NULL

## 🔧 后端实施

### 步骤1: 注册新的API路由
在 `backend/server.js` 中添加：

```javascript
// 在文件顶部添加路由导入
const readingTimingRoutes = require('./routes/reading_timing');

// 在路由注册部分添加
app.use('/api/reading-timing', readingTimingRoutes);
```

### 步骤2: 更新现有阅读记录API
修改 `backend/server.js` 中的 `POST /api/user/:userId/read-chapter` 端点：

```javascript
// 在记录阅读日志的部分，添加时间字段
await db.execute(`
  INSERT INTO reading_log (user_id, chapter_id, read_at, is_unlocked, unlock_time, page_enter_time) 
  VALUES (?, ?, NOW(), ?, ?, NOW())
`, [userId, chapterId, isUnlocked, unlockTime]);
```

## 🎨 前端实施

### 步骤1: 安装新的Hook和服务
确保以下文件已创建：
- `frontend/src/hooks/useReadingTiming.ts`
- `frontend/src/services/readingTimingService.ts`

### 步骤2: 更新 ChapterReader.tsx
在 `frontend/src/pages/ChapterReader.tsx` 中集成时间追踪：

```typescript
// 添加导入
import { useReadingTiming } from '../hooks/useReadingTiming';
import readingTimingService from '../services/readingTimingService';

// 在组件中使用
const {
  enterTime,
  exitTime,
  duration,
  isTracking
} = useReadingTiming({
  userId: user?.id || 0,
  chapterId: parseInt(chapterId || '0'),
  onTimingUpdate: async (timingData) => {
    if (user && chapterId) {
      try {
        await readingTimingService.updateReadingTiming(
          user.id,
          parseInt(chapterId),
          timingData
        );
      } catch (error) {
        console.error('记录阅读时间失败:', error);
      }
    }
  }
});
```

### 步骤3: 添加阅读状态显示
在章节阅读页面添加时间追踪状态显示：

```typescript
const renderReadingStatus = () => {
  if (!isTracking) return null;
  
  return (
    <div className="reading-status">
      <div className="status-indicator">
        <span className="status-dot"></span>
        <span>正在阅读中...</span>
      </div>
      {enterTime && (
        <div className="timing-info">
          <small>
            进入时间: {enterTime.toLocaleTimeString()}
            {duration && ` | 已阅读: ${readingTimingService.formatDuration(duration)}`}
          </small>
        </div>
      )}
    </div>
  );
};
```

## 🧪 测试验证

### 步骤1: 数据库测试
```sql
-- 查看最新的阅读记录
SELECT 
  user_id, 
  chapter_id, 
  read_at, 
  page_enter_time, 
  page_exit_time, 
  stay_duration 
FROM reading_log 
ORDER BY read_at DESC 
LIMIT 10;
```

### 步骤2: API测试
```bash
# 测试时间更新API
curl -X POST http://localhost:5000/api/reading-timing/update-timing \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "chapterId": 100,
    "enterTime": "2024-01-01T10:00:00Z",
    "exitTime": "2024-01-01T10:05:00Z",
    "duration": 300
  }'
```

### 步骤3: 前端测试
1. 打开章节阅读页面
2. 检查浏览器控制台是否有时间追踪日志
3. 离开页面后检查数据库记录是否更新

## 📊 数据分析

### 查询用户阅读习惯
```sql
-- 用户每日阅读时长统计
SELECT 
  DATE(read_at) as read_date,
  COUNT(*) as chapters_read,
  AVG(stay_duration) as avg_duration,
  SUM(stay_duration) as total_duration
FROM reading_log 
WHERE user_id = 1 
  AND stay_duration IS NOT NULL
GROUP BY DATE(read_at)
ORDER BY read_date DESC;
```

### 章节阅读热度分析
```sql
-- 章节平均阅读时长
SELECT 
  chapter_id,
  COUNT(*) as read_count,
  AVG(stay_duration) as avg_duration,
  SUM(stay_duration) as total_duration
FROM reading_log 
WHERE stay_duration IS NOT NULL
GROUP BY chapter_id
ORDER BY avg_duration DESC;
```

## 🚀 部署注意事项

### 1. 数据库迁移
- 在生产环境运行前，先在测试环境验证
- 备份现有数据
- 考虑大表添加字段的性能影响

### 2. 前端兼容性
- 确保在所有目标浏览器中测试
- 处理网络异常情况
- 添加降级方案

### 3. 性能优化
- 考虑批量更新机制
- 添加数据清理策略
- 监控API性能

## 🔍 故障排除

### 常见问题

1. **时间字段为空**
   - 检查前端时间追踪是否正常启动
   - 验证API调用是否成功
   - 查看浏览器控制台错误

2. **数据不准确**
   - 检查时区设置
   - 验证时间计算逻辑
   - 确认页面离开事件触发

3. **性能问题**
   - 检查数据库索引
   - 优化API响应时间
   - 考虑数据分页

### 调试工具

```javascript
// 在浏览器控制台中调试
console.log('当前阅读状态:', {
  enterTime: window.readingTiming?.enterTime,
  duration: window.readingTiming?.duration,
  isTracking: window.readingTiming?.isTracking
});
```

## 📈 后续扩展

### 1. 实时监控
- 添加WebSocket支持实时阅读状态
- 实现阅读进度实时同步

### 2. 高级分析
- 阅读行为模式分析
- 用户留存率计算
- 内容推荐算法优化

### 3. 用户体验
- 阅读进度可视化
- 阅读时间统计展示
- 个性化阅读建议

## ✅ 验收标准

- [ ] 数据库字段成功添加
- [ ] 前端时间追踪正常工作
- [ ] API端点响应正确
- [ ] 数据记录准确
- [ ] 页面离开事件正常触发
- [ ] 网络异常处理完善
- [ ] 性能表现良好
- [ ] 用户体验流畅

完成以上所有步骤后，您的 `reading_log` 系统将具备完整的时间追踪功能！
