# 🔑 Key系统API完整指南

## 📊 数据库表结构

### 1. `key_transaction` 表 - Key变动记录表
```sql
CREATE TABLE key_transaction (
  id int PRIMARY KEY AUTO_INCREMENT,
  user_id int NOT NULL,                      -- 用户ID
  transaction_type enum('checkin', 'mission', 'unlock', 'purchase', 'refund', 'admin') NOT NULL,
  amount int NOT NULL,                       -- 变动数量（正数为增加，负数为减少）
  balance_before int NOT NULL,              -- 变动前余额
  balance_after int NOT NULL,               -- 变动后余额
  reference_id int NULL,                     -- 关联ID（如任务ID、章节ID等）
  reference_type varchar(50) NULL,          -- 关联类型（mission, chapter, checkin等）
  description varchar(255) NULL,            -- 交易描述
  created_at datetime DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_transaction_type (transaction_type),
  INDEX idx_created_at (created_at),
  INDEX idx_reference (reference_id, reference_type)
);
```

### 2. `user` 表 - 用户Key余额
```sql
-- 用户表存储用户的Key余额
user_id | points | golden_karma
1       | 62     | 138784
```

### 3. `mission_completion_log` 表 - 任务完成记录
```sql
-- 记录任务完成时的Key奖励
user_id | mission_id | reward_keys | reward_karma | chapter_id
1       | 1         | 2           | 0            | 100
```

### 4. `chapter_unlocks` 表 - 章节解锁记录
```sql
-- 记录Key解锁章节的消费
user_id | chapter_id | unlock_method | cost | status | unlocked_at
1       | 100        | key           | 1    | unlocked | 2025-10-18 11:03:44
```

### 5. `daily_checkin` 表 - 签到奖励记录
```sql
-- 记录签到获得的Key
user_id | checkin_date | keys_earned | total_keys
1       | 2025-10-18   | 5           | 62
```

## 🔄 Key获取和消耗流程

### 📈 Key获取方式

#### 1. 每日签到奖励
```javascript
// API: POST /api/checkin/:userId
// 自动记录Key变动
const result = await recordKeyTransaction(
  db, 
  userId, 
  'checkin', 
  keysEarned, 
  null, 
  'daily_checkin', 
  `每日签到奖励: +${keysEarned} keys (连续${streakDays}天)`
);
```

#### 2. 完成任务奖励
```javascript
// API: POST /api/mission/claim/:userId/:missionId
// 自动记录Key变动
const result = await recordKeyTransaction(
  db, 
  userId, 
  'mission', 
  missionProgress.reward_keys, 
  missionId, 
  'mission', 
  `完成任务奖励: ${missionProgress.reward_keys} keys`
);
```

#### 3. 购买获得
```javascript
// 通过其他系统购买Key
const result = await recordKeyTransaction(
  db, 
  userId, 
  'purchase', 
  purchaseAmount, 
  purchaseId, 
  'purchase', 
  `购买获得: +${purchaseAmount} keys`
);
```

### 📉 Key消耗方式

#### 1. 解锁付费章节
```javascript
// API: POST /api/chapter-unlock/unlock-with-key/:userId/:chapterId
// 自动记录Key消耗
const result = await recordKeyTransaction(
  db,
  userId,
  'unlock',
  -chapter.key_cost, // 负数表示消耗
  chapterId,
  'chapter',
  `解锁章节: ${chapter.novel_title} 第${chapter.chapter_number}章`
);
```

#### 2. 其他消费
```javascript
// 购买其他物品
const result = await recordKeyTransaction(
  db,
  userId,
  'unlock',
  -itemCost,
  itemId,
  'item',
  `购买物品: -${itemCost} keys`
);
```

## 🛠️ API接口

### 1. 章节解锁API

#### 使用Key解锁章节
```http
POST /api/chapter-unlock/unlock-with-key/:userId/:chapterId
```

**响应示例:**
```json
{
  "success": true,
  "message": "章节解锁成功",
  "data": {
    "chapterId": 100,
    "novelTitle": "一号大秘",
    "chapterNumber": 15,
    "keyCost": 1,
    "balanceBefore": 63,
    "balanceAfter": 62,
    "transactionId": 123
  }
}
```

#### 获取章节解锁状态
```http
GET /api/chapter-unlock/status/:userId/:chapterId
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "chapterId": 100,
    "novelTitle": "一号大秘",
    "chapterNumber": 15,
    "isPremium": true,
    "keyCost": 1,
    "isUnlocked": false,
    "unlockMethod": "none",
    "userKeyBalance": 62,
    "canUnlockWithKey": true,
    "hasChampionSubscription": false
  }
}
```

#### 获取用户解锁记录
```http
GET /api/chapter-unlock/unlock-history/:userId?limit=20&offset=0
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "unlocks": [
      {
        "id": 1,
        "user_id": 1,
        "chapter_id": 100,
        "unlock_method": "key",
        "cost": 1,
        "status": "unlocked",
        "unlocked_at": "2025-10-18T11:03:44.000Z",
        "chapter_number": 15,
        "novel_title": "一号大秘",
        "chapter_title": "第15章"
      }
    ],
    "total": 1,
    "limit": 20,
    "offset": 0
  }
}
```

### 2. Key变动记录API

#### 获取用户Key变动记录
```javascript
// 使用辅助函数
const transactions = await getUserKeyTransactions(db, userId, limit, offset);
```

#### 获取用户Key统计信息
```javascript
// 使用辅助函数
const stats = await getUserKeyStats(db, userId);
```

**统计信息示例:**
```json
{
  "currentBalance": 62,
  "totalEarned": 7,
  "totalSpent": 1,
  "totalTransactions": 3,
  "lastTransactionTime": "2025-10-18T11:03:44.000Z"
}
```

## 🔧 辅助函数

### 1. 记录Key变动
```javascript
const { recordKeyTransaction } = require('./key_transaction_helper');

// 记录Key变动
const result = await recordKeyTransaction(
  db,           // 数据库连接
  userId,       // 用户ID
  'checkin',    // 交易类型
  5,            // 变动数量
  null,         // 关联ID
  'daily_checkin', // 关联类型
  '每日签到奖励'   // 描述
);
```

### 2. 获取用户Key变动记录
```javascript
const { getUserKeyTransactions } = require('./key_transaction_helper');

// 获取变动记录
const transactions = await getUserKeyTransactions(db, userId, 20, 0);
```

### 3. 获取用户Key统计信息
```javascript
const { getUserKeyStats } = require('./key_transaction_helper');

// 获取统计信息
const stats = await getUserKeyStats(db, userId);
```

## 📊 数据统计

### Key收支统计
```sql
-- 总收入统计
SELECT SUM(reward_keys) as total_earned
FROM mission_completion_log 
WHERE user_id = ? AND claimed_at IS NOT NULL;

-- 总支出统计
SELECT SUM(cost) as total_spent
FROM chapter_unlocks 
WHERE user_id = ? AND unlock_method = 'key' AND status = 'unlocked';

-- 签到收入统计
SELECT SUM(keys_earned) as checkin_earned
FROM daily_checkin 
WHERE user_id = ?;
```

### Key变动记录查询
```sql
-- 获取用户所有Key变动记录
SELECT 
  kt.*,
  u.username,
  CASE 
    WHEN kt.transaction_type = 'checkin' THEN CONCAT('签到奖励: +', kt.amount, ' keys')
    WHEN kt.transaction_type = 'mission' THEN CONCAT('任务奖励: +', kt.amount, ' keys')
    WHEN kt.transaction_type = 'unlock' THEN CONCAT('解锁章节: -', ABS(kt.amount), ' keys')
    WHEN kt.transaction_type = 'purchase' THEN CONCAT('购买获得: +', kt.amount, ' keys')
    WHEN kt.transaction_type = 'refund' THEN CONCAT('退款: +', kt.amount, ' keys')
    ELSE CONCAT('其他: ', IF(kt.amount > 0, '+', ''), kt.amount, ' keys')
  END as transaction_description
FROM key_transaction kt
JOIN user u ON kt.user_id = u.id
WHERE kt.user_id = ?
ORDER BY kt.created_at DESC;
```

## 🎯 使用示例

### 完整的Key系统使用流程

1. **用户签到获得Key**
   ```javascript
   // 前端调用签到API
   POST /api/checkin/1
   // 后端自动记录Key变动
   ```

2. **用户完成任务获得Key**
   ```javascript
   // 前端调用任务领取API
   POST /api/mission/claim/1/1
   // 后端自动记录Key变动
   ```

3. **用户使用Key解锁章节**
   ```javascript
   // 前端调用解锁API
   POST /api/chapter-unlock/unlock-with-key/1/100
   // 后端自动记录Key消耗
   ```

4. **查询用户Key余额和变动记录**
   ```javascript
   // 获取用户信息
   GET /api/user/1
   // 获取Key变动记录
   GET /api/chapter-unlock/unlock-history/1
   ```

## 🔒 安全考虑

1. **事务安全**: 所有Key变动都通过数据库事务确保一致性
2. **余额检查**: 消费前检查用户余额是否足够
3. **重复检查**: 防止重复解锁同一章节
4. **权限验证**: 验证用户身份和章节权限
5. **记录完整**: 所有Key变动都有完整的记录和追踪

## 📈 扩展功能

1. **Key赠送**: 管理员可以给用户赠送Key
2. **Key退款**: 支持Key消费的退款
3. **Key转移**: 用户之间可以转移Key
4. **Key过期**: 设置Key的有效期
5. **Key统计**: 更详细的Key使用统计和分析

这个Key系统设计完整，涵盖了获取、消耗、存储的完整生命周期，确保了数据的准确性和可追溯性。
