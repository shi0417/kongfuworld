# Reading Log 系统分析报告

## 📊 当前 Reading Log 系统概述

### 数据库表结构
```sql
CREATE TABLE `reading_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `chapter_id` int NOT NULL,
  `read_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `is_unlocked` tinyint(1) DEFAULT 0 COMMENT '用户阅读时章节是否已解锁（是否永久拥有）',
  `unlock_time` datetime NULL COMMENT '该章节的解锁时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 当前写入逻辑位置

#### 1. **后端 API 端点**
- **主要端点**: `POST /api/user/:userId/read-chapter`
- **文件位置**: `backend/server.js` (第1754行开始)
- **触发时机**: 用户访问章节阅读页面时

#### 2. **前端触发逻辑**
- **文件位置**: `frontend/src/pages/ChapterReader.tsx`
- **触发代码**: 
```typescript
// 记录阅读日志
useEffect(() => {
  const recordReading = async () => {
    if (user && chapterId) {
      try {
        await readingService.recordReading(user.id, parseInt(chapterId));
      } catch (error) {
        console.error('记录阅读日志失败:', error);
      }
    }
  };
  recordReading();
}, [user, chapterId]);
```

#### 3. **服务层**
- **文件位置**: `frontend/src/services/readingService.ts`
- **方法**: `recordReading(userId, chapterId)`

## 🎯 需要添加的3个字段

### 字段设计
```sql
ALTER TABLE reading_log 
ADD COLUMN page_enter_time DATETIME NULL COMMENT '进入页面的时间',
ADD COLUMN page_exit_time DATETIME NULL COMMENT '离开页面的时间',
ADD COLUMN stay_duration INT NULL COMMENT '停留时间（秒）';
```

## 🔧 实现方案

### 方案1: 前端时间追踪 + 后端更新

#### 前端实现 (ChapterReader.tsx)

```typescript
// 添加状态管理
const [pageEnterTime, setPageEnterTime] = useState<Date | null>(null);
const [pageExitTime, setPageExitTime] = useState<Date | null>(null);

// 页面进入时记录时间
useEffect(() => {
  const enterTime = new Date();
  setPageEnterTime(enterTime);
  console.log('📖 页面进入时间:', enterTime);
  
  // 页面离开时记录时间
  const handleBeforeUnload = () => {
    const exitTime = new Date();
    setPageExitTime(exitTime);
    const duration = Math.floor((exitTime.getTime() - enterTime.getTime()) / 1000);
    console.log('📖 页面离开时间:', exitTime, '停留时长:', duration, '秒');
    
    // 发送停留时间到后端
    if (user && chapterId) {
      updateReadingLogWithTiming(user.id, parseInt(chapterId), enterTime, exitTime, duration);
    }
  };
  
  // 监听页面离开事件
  window.addEventListener('beforeunload', handleBeforeUnload);
  
  // 监听页面可见性变化
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      handleBeforeUnload();
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [user, chapterId]);
```

#### 后端API扩展

```javascript
// 在 backend/server.js 中添加新的API端点
app.post('/api/user/:userId/update-reading-timing', async (req, res) => {
  const { userId } = req.params;
  const { chapterId, enterTime, exitTime, duration } = req.body;
  
  let db;
  try {
    db = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '123456',
      database: process.env.DB_NAME || 'kongfuworld',
      charset: 'utf8mb4'
    });
    
    // 更新reading_log表的时间字段
    await db.execute(`
      UPDATE reading_log 
      SET page_enter_time = ?, page_exit_time = ?, stay_duration = ?
      WHERE user_id = ? AND chapter_id = ? AND DATE(read_at) = CURDATE()
    `, [enterTime, exitTime, duration, userId, chapterId]);
    
    res.json({ success: true, message: '阅读时间更新成功' });
  } catch (error) {
    console.error('更新阅读时间失败:', error);
    res.status(500).json({ success: false, message: '更新阅读时间失败' });
  } finally {
    if (db) await db.end();
  }
});
```

### 方案2: 实时心跳检测

#### 前端心跳实现

```typescript
// 在 ChapterReader.tsx 中添加心跳检测
useEffect(() => {
  if (!user || !chapterId) return;
  
  const enterTime = new Date();
  setPageEnterTime(enterTime);
  
  // 每30秒发送一次心跳
  const heartbeatInterval = setInterval(async () => {
    try {
      await ApiService.request(`/api/user/${user.id}/reading-heartbeat`, {
        method: 'POST',
        body: JSON.stringify({
          chapterId: parseInt(chapterId),
          enterTime: enterTime.toISOString(),
          currentTime: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('心跳检测失败:', error);
    }
  }, 30000); // 30秒间隔
  
  // 页面离开时计算总停留时间
  const handlePageExit = () => {
    const exitTime = new Date();
    const duration = Math.floor((exitTime.getTime() - enterTime.getTime()) / 1000);
    
    // 发送最终停留时间
    ApiService.request(`/api/user/${user.id}/update-reading-timing`, {
      method: 'POST',
      body: JSON.stringify({
        chapterId: parseInt(chapterId),
        enterTime: enterTime.toISOString(),
        exitTime: exitTime.toISOString(),
        duration: duration
      })
    }).catch(error => console.error('更新停留时间失败:', error));
  };
  
  window.addEventListener('beforeunload', handlePageExit);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      handlePageExit();
    }
  });
  
  return () => {
    clearInterval(heartbeatInterval);
    window.removeEventListener('beforeunload', handlePageExit);
    document.removeEventListener('visibilitychange', handlePageExit);
  };
}, [user, chapterId]);
```

## 📝 具体实现步骤

### 步骤1: 数据库结构更新
```sql
-- 添加新字段
ALTER TABLE reading_log 
ADD COLUMN page_enter_time DATETIME NULL COMMENT '进入页面的时间',
ADD COLUMN page_exit_time DATETIME NULL COMMENT '离开页面的时间',
ADD COLUMN stay_duration INT NULL COMMENT '停留时间（秒）';

-- 添加索引优化查询
CREATE INDEX idx_reading_log_timing ON reading_log(user_id, page_enter_time);
```

### 步骤2: 后端API扩展
1. 修改现有的 `POST /api/user/:userId/read-chapter` 端点，在插入/更新记录时包含时间字段
2. 添加新的 `POST /api/user/:userId/update-reading-timing` 端点用于更新停留时间
3. 可选：添加 `POST /api/user/:userId/reading-heartbeat` 端点用于心跳检测

### 步骤3: 前端实现
1. 在 `ChapterReader.tsx` 中添加页面进入/离开时间追踪
2. 在 `readingService.ts` 中添加新的API调用方法
3. 实现页面可见性检测和离开事件处理

### 步骤4: 数据验证
1. 确保时间字段的准确性
2. 处理网络异常情况
3. 添加数据完整性检查

## 🎯 推荐实现方案

**推荐使用方案1（前端时间追踪 + 后端更新）**，因为：

1. **简单可靠**: 不依赖复杂的心跳机制
2. **性能友好**: 只在页面离开时发送一次请求
3. **数据准确**: 基于浏览器原生事件，时间计算准确
4. **易于维护**: 逻辑清晰，便于调试和修改

## 📊 预期效果

实现后，`reading_log` 表将包含完整的用户阅读行为数据：
- 何时进入页面
- 何时离开页面  
- 实际停留时长
- 阅读时的解锁状态
- 章节解锁时间

这些数据可以用于：
- 用户行为分析
- 阅读习惯统计
- 内容推荐优化
- 用户留存率分析
