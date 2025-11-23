# 🎯 任务管理系统API指南

## 📋 概述

新的任务管理系统基于`user.mission`字段实现，提供自动任务初始化、进度跟踪和完成检查功能。

## 🔧 核心特性

### 1. **user.mission字段管理**
- 格式：`YYYY-MM-DD completed/uncompleted`
- 用于判断任务是否开启和完成状态
- 存储在本地缓存中，系统启动时核对

### 2. **自动任务初始化**
- 系统检查用户任务状态
- 如果今天没有任务记录，自动创建任务
- 更新user.mission为"uncompleted"

### 3. **任务进度更新**
- 阅读章节任务：`read_2_chapters`, `read_5_chapters`, `read_10_chapters`
- 签到任务：`daily_checkin`
- 实时更新任务进度和完成状态

## 🚀 API接口

### 1. **获取用户任务列表（自动初始化）**

```http
GET /api/mission-v2/user/:userId
```

**参数：**
- `userId`: 用户ID
- `date` (可选): 指定日期，默认为今天

**响应：**
```json
{
  "success": true,
  "data": {
    "missions": [
      {
        "id": 1,
        "missionKey": "read_2_chapters",
        "title": "Read 2 new chapters",
        "description": "Read 2 new chapters to earn rewards",
        "targetValue": 2,
        "rewardKeys": 2,
        "rewardKarma": 0,
        "currentProgress": 0,
        "isCompleted": false,
        "isClaimed": false,
        "progressPercentage": 0
      }
    ],
    "date": "2025-10-20",
    "userMissionStatus": "uncompleted",
    "allTasksCompleted": false,
    "completionMessage": "任务进行中: 0/4 已完成"
  }
}
```

### 2. **更新任务进度**

```http
POST /api/mission-v2/progress
```

**请求体：**
```json
{
  "userId": 1,
  "missionKey": "read_2_chapters",
  "progressValue": 1
}
```

**响应：**
```json
{
  "success": true,
  "message": "任务进度更新成功",
  "data": {
    "missionKey": "read_2_chapters",
    "currentProgress": 1,
    "targetValue": 2,
    "isCompleted": false,
    "progressPercentage": 50,
    "allTasksCompleted": false
  }
}
```

### 3. **检查任务完成状态**

```http
GET /api/mission-v2/completion/:userId
```

**响应：**
```json
{
  "success": true,
  "isCompleted": false,
  "message": "任务进行中: 1/4 已完成",
  "tasks": [
    {
      "mission_id": 1,
      "current_progress": 1,
      "is_completed": 0,
      "target_value": 2,
      "title": "Read 2 new chapters"
    }
  ],
  "completedCount": 1,
  "totalCount": 4
}
```

## 🔄 集成到现有API

### 1. **阅读章节API集成**

现有的阅读章节API已经集成了任务系统：

```javascript
// 在 /api/user/:userId/read-chapter 中
if (newChapterCheck.isNewChapter) {
  const { updateMissionProgress } = require('./mission_manager');
  const missionKeys = ['read_2_chapters', 'read_5_chapters', 'read_10_chapters'];
  
  for (const missionKey of missionKeys) {
    const result = await updateMissionProgress(userId, missionKey, 1);
    // 处理结果...
  }
}
```

### 2. **签到API集成**

现有的签到API已经集成了任务系统：

```javascript
// 在 /api/checkin/:userId 中
const result = await dailyCheckinWithMission.performCheckin(userId, timezone);
// 自动更新签到任务进度
```

## 📊 数据库表结构

### 1. **user表新增字段**
```sql
ALTER TABLE `user` 
ADD COLUMN `mission` varchar(50) DEFAULT NULL COMMENT '任务状态: YYYY-MM-DD completed/uncompleted';
```

### 2. **任务配置表 (mission_config)**
```sql
CREATE TABLE mission_config (
  id int PRIMARY KEY AUTO_INCREMENT,
  mission_type enum('daily', 'weekly', 'monthly') DEFAULT 'daily',
  mission_key varchar(50) NOT NULL,
  title varchar(100) NOT NULL,
  description text,
  target_value int NOT NULL,
  reward_keys int DEFAULT 0,
  reward_karma int DEFAULT 0,
  is_active tinyint(1) DEFAULT 1,
  reset_type enum('daily', 'weekly', 'monthly') DEFAULT 'daily'
);
```

### 3. **用户任务进度表 (user_mission_progress)**
```sql
CREATE TABLE user_mission_progress (
  id int PRIMARY KEY AUTO_INCREMENT,
  user_id int NOT NULL,
  mission_id int NOT NULL,
  current_progress int DEFAULT 0,
  is_completed tinyint(1) DEFAULT 0,
  is_claimed tinyint(1) DEFAULT 0,
  progress_date date NOT NULL,
  created_at datetime DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## 🎮 使用示例

### 1. **前端获取任务列表**
```javascript
// 获取用户任务列表
const response = await fetch(`/api/mission-v2/user/${userId}`);
const data = await response.json();

if (data.success) {
  console.log('任务列表:', data.data.missions);
  console.log('完成状态:', data.data.allTasksCompleted);
}
```

### 2. **前端更新任务进度**
```javascript
// 用户阅读章节后更新任务进度
const response = await fetch('/api/mission-v2/progress', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: userId,
    missionKey: 'read_2_chapters',
    progressValue: 1
  })
});

const result = await response.json();
if (result.success) {
  console.log('任务进度更新成功:', result.data);
}
```

## 🔍 调试和监控

### 1. **检查用户任务状态**
```sql
SELECT id, username, mission FROM user WHERE id = 1;
```

### 2. **检查任务进度记录**
```sql
SELECT ump.*, mc.title 
FROM user_mission_progress ump
JOIN mission_config mc ON ump.mission_id = mc.id
WHERE ump.user_id = 1 AND ump.progress_date = '2025-10-20';
```

### 3. **检查任务完成日志**
```sql
SELECT * FROM mission_completion_log 
WHERE user_id = 1 AND DATE(completed_at) = '2025-10-20';
```

## 🎯 总结

新的任务管理系统提供了：

1. **自动任务初始化** - 每天自动创建任务记录
2. **实时进度跟踪** - 用户动作自动更新任务进度
3. **完成状态检查** - 实时检查所有任务完成状态
4. **本地缓存机制** - user.mission字段作为任务状态指示器

这个系统完美解决了之前任务没有启动的问题，确保用户每天都能正常进行任务！
