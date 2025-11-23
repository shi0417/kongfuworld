# 任务执行（Mission Rewards）系统总结

## 🎯 任务执行系统概述

任务执行系统是一个完整的奖励机制，涉及4个核心数据库表的协调操作，确保用户完成任务后能够获得相应的奖励。

## 📊 涉及的数据库表及操作顺序

### 1. **mission_config** 表（任务配置表）
- **作用**：存储所有可用的任务配置
- **操作**：查询任务信息
- **时机**：任务进度更新时

### 2. **user_mission_progress** 表（用户任务进度表）
- **作用**：记录用户每天的任务进度
- **操作**：查询/创建/更新进度记录
- **时机**：用户执行任务动作时

### 3. **mission_completion_log** 表（任务完成日志表）
- **作用**：记录任务完成和奖励领取的日志
- **操作**：插入完成记录，更新领取时间
- **时机**：任务完成时和领取奖励时

### 4. **user** 表（用户表）
- **作用**：存储用户的钥匙和Karma余额
- **操作**：更新用户余额
- **时机**：用户领取奖励时

## 🔄 完整的任务执行流程

### 阶段1：任务触发
```
用户执行动作（如阅读章节）
    ↓
检查是否为新章节
    ↓
记录阅读日志到 reading_log 表
    ↓
判断是否更新任务进度
```

### 阶段2：任务进度更新
```
查询任务配置（mission_config 表）
    ↓
检查现有进度（user_mission_progress 表）
    ↓
更新或创建进度记录（user_mission_progress 表）
    ↓
检查任务是否完成
    ↓
记录完成日志（mission_completion_log 表，如果完成）
```

### 阶段3：任务奖励领取
```
用户点击领取奖励
    ↓
验证任务状态（user_mission_progress 表）
    ↓
更新任务状态为已领取（user_mission_progress 表）
    ↓
更新用户余额（user 表）
    ↓
更新完成日志的领取时间（mission_completion_log 表）
```

## 🎮 具体操作示例

### 示例：用户阅读第1个新章节

#### **步骤1：记录阅读日志**
```sql
INSERT INTO reading_log (user_id, chapter_id, read_at) 
VALUES (1, 100, NOW());
```

#### **步骤2：查询任务配置**
```sql
SELECT * FROM mission_config 
WHERE mission_key = 'read_2_chapters' AND is_active = 1;
```

#### **步骤3：创建任务进度记录**
```sql
INSERT INTO user_mission_progress 
(user_id, mission_id, current_progress, is_completed, is_claimed, progress_date)
VALUES (1, 1, 1, 0, 0, '2025-10-18');
```

#### **步骤4：用户阅读第2个新章节**

#### **步骤5：更新任务进度**
```sql
UPDATE user_mission_progress 
SET current_progress = 2, is_completed = 1, updated_at = NOW()
WHERE user_id = 1 AND mission_id = 1 AND progress_date = '2025-10-18';
```

#### **步骤6：记录任务完成日志**
```sql
INSERT INTO mission_completion_log 
(user_id, mission_id, reward_keys, reward_karma)
VALUES (1, 1, 2, 0);
```

#### **步骤7：用户领取奖励**

#### **步骤8：更新任务状态**
```sql
UPDATE user_mission_progress 
SET is_claimed = 1, updated_at = NOW()
WHERE user_id = 1 AND mission_id = 1;
```

#### **步骤9：更新用户余额**
```sql
UPDATE user SET points = points + 2 WHERE id = 1;
```

#### **步骤10：更新完成日志**
```sql
UPDATE mission_completion_log 
SET claimed_at = NOW()
WHERE user_id = 1 AND mission_id = 1 AND claimed_at IS NULL;
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

## 📊 数据库表关系图

```
mission_config (任务配置)
    ↓
user_mission_progress (用户任务进度)
    ↓
mission_completion_log (任务完成日志)
    ↓
user (用户余额)
```

## 🎮 任务执行的关键时机

### 1. **任务进度更新时机**
- 用户阅读新章节时
- 用户写评论时
- 用户每日签到时
- 用户完成其他任务动作时

### 2. **任务奖励领取时机**
- 用户主动点击领取按钮时
- 系统验证任务完成状态后
- 更新用户余额前

### 3. **任务重置时机**
- 每日任务：每天00:00重置
- 每周任务：每周一00:00重置
- 每月任务：每月1日00:00重置

## 🎯 总结

任务执行系统通过4个核心数据库表的协调操作，实现了完整的任务奖励机制：

1. **mission_config** - 定义任务规则
2. **user_mission_progress** - 跟踪用户进度
3. **mission_completion_log** - 记录完成和领取日志
4. **user** - 存储用户奖励余额

这个系统确保了用户能够通过完成各种任务获得相应的奖励，同时防止了重复计算和作弊行为，为WuxiaWorld克隆项目提供了完整的任务奖励机制。
