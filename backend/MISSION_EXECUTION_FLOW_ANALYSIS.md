# 任务执行（Mission Rewards）详细流程分析

## 🎯 任务执行系统概述

任务执行系统是一个完整的奖励机制，涉及多个数据库表的协调操作，确保用户完成任务后能够获得相应的奖励。

## 📊 涉及的数据库表

### 1. **mission_config** 表（任务配置表）
```sql
CREATE TABLE mission_config (
  id int PRIMARY KEY AUTO_INCREMENT,
  mission_type enum('daily', 'weekly', 'monthly') DEFAULT 'daily',
  mission_key varchar(50) NOT NULL,           -- 如: 'read_2_chapters'
  title varchar(100) NOT NULL,                -- 如: 'Read 2 new chapters'
  description text,                           -- 任务描述
  target_value int NOT NULL,                  -- 目标值，如: 2
  reward_keys int DEFAULT 0,                  -- 奖励钥匙数量
  reward_karma int DEFAULT 0,                -- 奖励Karma数量
  is_active tinyint(1) DEFAULT 1,           -- 是否启用
  reset_type enum('daily', 'weekly', 'monthly') DEFAULT 'daily',
  created_at datetime DEFAULT CURRENT_TIMESTAMP
);
```

### 2. **user_mission_progress** 表（用户任务进度表）
```sql
CREATE TABLE user_mission_progress (
  id int PRIMARY KEY AUTO_INCREMENT,
  user_id int NOT NULL,                      -- 用户ID
  mission_id int NOT NULL,                   -- 任务ID
  current_progress int DEFAULT 0,            -- 当前进度
  is_completed tinyint(1) DEFAULT 0,        -- 是否已完成
  is_claimed tinyint(1) DEFAULT 0,           -- 是否已领取奖励
  progress_date date NOT NULL,              -- 进度日期
  created_at datetime DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 3. **mission_completion_log** 表（任务完成日志表）
```sql
CREATE TABLE mission_completion_log (
  id int PRIMARY KEY AUTO_INCREMENT,
  user_id int NOT NULL,                      -- 用户ID
  mission_id int NOT NULL,                   -- 任务ID
  completed_at datetime DEFAULT CURRENT_TIMESTAMP,  -- 完成时间
  reward_keys int DEFAULT 0,                 -- 获得的钥匙
  reward_karma int DEFAULT 0,               -- 获得的Karma
  claimed_at datetime DEFAULT NULL,          -- 领取时间
  PRIMARY KEY (id),
  KEY user_id (user_id),
  KEY mission_id (mission_id)
);
```

### 4. **user** 表（用户表）
```sql
-- 用户表包含用户的钥匙和Karma余额
user_id | points | karma | golden_karma
1       | 10     | 50    | 5
```

## 🔄 任务执行的具体步骤

### 步骤1：用户触发任务动作
```javascript
// 用户阅读章节时触发
// 前端调用：POST /api/user/:userId/read-chapter
{
  "userId": 1,
  "chapterId": 100
}
```

### 步骤2：检查是否为新章节
```javascript
// 后端检查逻辑
const isNewChapter = await checkIsNewChapterImproved(db, userId, chapterId);

// 判断标准：
// 1. 今天阅读
// 2. 今天解锁（关键！）
// 3. 以前阅读过但未解锁的情况也算新章节
```

### 步骤3：记录阅读日志
```sql
-- 操作表：reading_log
INSERT INTO reading_log (user_id, chapter_id, read_at) 
VALUES (1, 100, NOW())
ON DUPLICATE KEY UPDATE read_at = NOW();
```

### 步骤4：更新任务进度
```javascript
// 只有新章节才更新任务进度
if (isNewChapter.isNewChapter) {
  const missionKeys = ['read_2_chapters', 'read_5_chapters', 'read_10_chapters'];
  
  for (const missionKey of missionKeys) {
    // 调用任务进度更新API
    await fetch('http://localhost:5000/api/mission/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 1,
        missionKey: missionKey,
        progressValue: 1
      })
    });
  }
}
```

## 🎮 任务进度更新的详细流程

### 步骤1：获取任务配置
```sql
-- 查询 mission_config 表
SELECT * FROM mission_config 
WHERE mission_key = 'read_2_chapters' AND is_active = 1;

-- 结果示例：
id | mission_key      | title              | target_value | reward_keys | reward_karma
1  | read_2_chapters  | Read 2 new chapters | 2           | 2          | 0
```

### 步骤2：检查现有进度
```sql
-- 查询 user_mission_progress 表
SELECT * FROM user_mission_progress 
WHERE user_id = 1 AND mission_id = 1 AND progress_date = '2025-10-18';

-- 结果示例：
id | user_id | mission_id | current_progress | is_completed | is_claimed | progress_date
1  | 1       | 1          | 0                | 0           | 0          | 2025-10-18
```

### 步骤3：更新或创建进度记录
```sql
-- 情况A：已有进度记录，更新
UPDATE user_mission_progress 
SET current_progress = 1, is_completed = 0, updated_at = NOW()
WHERE user_id = 1 AND mission_id = 1 AND progress_date = '2025-10-18';

-- 情况B：没有进度记录，创建新记录
INSERT INTO user_mission_progress 
(user_id, mission_id, current_progress, is_completed, is_claimed, progress_date)
VALUES (1, 1, 1, 0, 0, '2025-10-18');
```

### 步骤4：检查任务是否完成
```sql
-- 检查进度是否达到目标值
SELECT current_progress, target_value, is_completed
FROM user_mission_progress ump
JOIN mission_config mc ON ump.mission_id = mc.id
WHERE ump.user_id = 1 AND ump.mission_id = 1;

-- 如果 current_progress >= target_value，则 is_completed = 1
```

### 步骤5：记录任务完成日志
```sql
-- 如果任务完成且未领取奖励，记录完成日志
INSERT INTO mission_completion_log 
(user_id, mission_id, reward_keys, reward_karma)
VALUES (1, 1, 2, 0);
```

## 🎯 任务奖励领取流程

### 步骤1：用户点击领取奖励
```javascript
// 前端调用：POST /api/mission/claim/:userId/:missionId
fetch('http://localhost:5000/api/mission/claim/1/1', {
  method: 'POST'
});
```

### 步骤2：验证任务状态
```sql
-- 检查任务是否完成且未领取
SELECT ump.*, mc.reward_keys, mc.reward_karma
FROM user_mission_progress ump
JOIN mission_config mc ON ump.mission_id = mc.id
WHERE ump.user_id = 1 AND ump.mission_id = 1 
  AND ump.is_completed = 1 AND ump.is_claimed = 0;
```

### 步骤3：更新任务状态
```sql
-- 标记任务为已领取
UPDATE user_mission_progress 
SET is_claimed = 1, updated_at = NOW()
WHERE user_id = 1 AND mission_id = 1;
```

### 步骤4：更新用户余额
```sql
-- 更新用户钥匙余额
UPDATE user SET points = points + 2 WHERE id = 1;

-- 更新用户Karma余额（如果有）
UPDATE user SET karma = karma + 0 WHERE id = 1;
```

### 步骤5：更新完成日志
```sql
-- 更新完成日志的领取时间
UPDATE mission_completion_log 
SET claimed_at = NOW()
WHERE user_id = 1 AND mission_id = 1 AND claimed_at IS NULL;
```

## 📊 数据库表操作顺序

### 1. **任务进度更新时的操作顺序**
```
1. mission_config (查询任务配置)
   ↓
2. user_mission_progress (查询/创建/更新进度)
   ↓
3. mission_completion_log (记录完成日志，如果任务完成)
```

### 2. **任务奖励领取时的操作顺序**
```
1. user_mission_progress (验证任务状态)
   ↓
2. user_mission_progress (更新为已领取)
   ↓
3. user (更新用户余额)
   ↓
4. mission_completion_log (更新领取时间)
```

### 3. **完整的任务执行流程**
```
用户触发动作
   ↓
reading_log (记录阅读日志)
   ↓
mission_config (查询任务配置)
   ↓
user_mission_progress (更新任务进度)
   ↓
mission_completion_log (记录完成日志，如果完成)
   ↓
user (更新用户余额，如果领取奖励)
```

## 🎮 具体场景示例

### 场景：用户阅读第1个新章节

#### **初始状态**
```sql
-- mission_config 表
id | mission_key      | target_value | reward_keys
1  | read_2_chapters  | 2           | 2

-- user_mission_progress 表
-- 无记录（用户今天还没有开始任务）

-- user 表
user_id | points | karma
1       | 5      | 20
```

#### **用户阅读第1章后**
```sql
-- reading_log 表新增记录
user_id | chapter_id | read_at
1       | 100        | 2025-10-18 09:00:00

-- user_mission_progress 表新增记录
user_id | mission_id | current_progress | is_completed | is_claimed | progress_date
1       | 1          | 1                | 0           | 0           | 2025-10-18

-- mission_completion_log 表
-- 无记录（任务未完成）
```

#### **用户阅读第2章后**
```sql
-- reading_log 表新增记录
user_id | chapter_id | read_at
1       | 101        | 2025-10-18 10:00:00

-- user_mission_progress 表更新记录
user_id | mission_id | current_progress | is_completed | is_claimed | progress_date
1       | 1          | 2                | 1           | 0           | 2025-10-18

-- mission_completion_log 表新增记录
user_id | mission_id | completed_at        | reward_keys | claimed_at
1       | 1          | 2025-10-18 10:00:00 | 2           | NULL
```

#### **用户领取奖励后**
```sql
-- user_mission_progress 表更新记录
user_id | mission_id | current_progress | is_completed | is_claimed | progress_date
1       | 1          | 2                | 1           | 1          | 2025-10-18

-- user 表更新记录
user_id | points | karma
1       | 7      | 20  ← 增加了2个钥匙

-- mission_completion_log 表更新记录
user_id | mission_id | completed_at        | reward_keys | claimed_at
1       | 1          | 2025-10-18 10:00:00 | 2           | 2025-10-18 10:30:00
```

## 🎯 关键设计特点

### 1. **事务处理**
- 所有数据库操作都在事务中进行
- 确保数据一致性
- 失败时自动回滚

### 2. **防重复计算**
- 同一天重复阅读同一章节不重复计算任务进度
- 任务完成后不能重复领取奖励

### 3. **进度跟踪**
- 实时跟踪用户任务进度
- 支持多个任务同时进行
- 自动检测任务完成状态

### 4. **奖励机制**
- 任务完成后自动记录完成日志
- 用户主动领取奖励
- 支持钥匙和Karma两种奖励类型

这个任务执行系统确保了用户能够通过完成各种任务获得相应的奖励，同时防止了重复计算和作弊行为。
