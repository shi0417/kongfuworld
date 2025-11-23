# 章节解锁系统实现文档

## 🎯 **系统概述**

基于WuxiaWorld的章节解锁机制，实现了4种解锁方式：
1. **倒计时免费解锁** - 章节在特定时间后自动免费
2. **钥匙解锁** - 使用Cultivation Keys立即解锁
3. **业力购买** - 使用Karma永久购买章节
4. **Champions订阅** - 订阅后解锁所有章节

## 🗄️ **数据库设计**

### **修改现有表**

#### **chapter表新增字段**
```sql
ALTER TABLE chapter 
ADD COLUMN is_premium BOOLEAN DEFAULT 1 COMMENT '是否为付费章节',
ADD COLUMN free_unlock_time DATETIME NULL COMMENT '免费解锁时间',
ADD COLUMN key_cost INT DEFAULT 1 COMMENT '钥匙解锁成本',
ADD COLUMN karma_cost INT DEFAULT 32 COMMENT '业力购买成本',
ADD COLUMN unlock_priority ENUM('free', 'key', 'karma', 'subscription') DEFAULT 'free' COMMENT '解锁优先级';
```

#### **user表新增字段**
```sql
ALTER TABLE user 
ADD COLUMN karma_count INT DEFAULT 0 COMMENT '业力数量',
ADD COLUMN subscription_status ENUM('none', 'champion', 'premium') DEFAULT 'none' COMMENT '订阅状态',
ADD COLUMN subscription_end_date DATETIME NULL COMMENT '订阅结束日期';
```

### **新增表**

#### **chapter_unlocks表** - 解锁记录
```sql
CREATE TABLE chapter_unlocks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  chapter_id INT NOT NULL,
  unlock_method ENUM('free', 'key', 'karma', 'subscription', 'auto_unlock') NOT NULL,
  cost INT DEFAULT 0 COMMENT '实际花费的钥匙或业力数量',
  unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
  FOREIGN KEY (chapter_id) REFERENCES chapter(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_chapter (user_id, chapter_id)
);
```

#### **user_settings表** - 用户设置
```sql
CREATE TABLE user_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  setting_key VARCHAR(100) NOT NULL,
  setting_value VARCHAR(255) NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_setting (user_id, setting_key)
);
```

#### **chapter_access_log表** - 访问日志
```sql
CREATE TABLE chapter_access_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  chapter_id INT NOT NULL,
  access_method ENUM('free', 'unlocked', 'subscription', 'purchased') NOT NULL,
  access_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT,
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
  FOREIGN KEY (chapter_id) REFERENCES chapter(id) ON DELETE CASCADE
);
```

## 🔧 **后端API实现**

### **API端点**

#### **1. 获取章节解锁状态**
```
GET /api/chapter-unlock/status/:chapterId/:userId
```
**响应示例：**
```json
{
  "success": true,
  "data": {
    "chapter": {
      "id": 1,
      "title": "Chapter 1",
      "is_premium": true,
      "key_cost": 1,
      "karma_cost": 32,
      "free_unlock_time": "2025-10-08T00:00:00Z"
    },
    "user": {
      "points": 21,
      "karma_count": 0,
      "subscription_status": "none",
      "is_subscribed": false
    },
    "unlock_status": {
      "is_unlocked": false,
      "can_unlock_with_key": true,
      "can_buy_with_karma": false,
      "is_free": false,
      "time_until_free": "22h:58m:35s"
    }
  }
}
```

#### **2. 钥匙解锁章节**
```
POST /api/chapter-unlock/unlock-with-key/:chapterId/:userId
```
**响应示例：**
```json
{
  "success": true,
  "message": "章节解锁成功",
  "data": {
    "keys_used": 1,
    "remaining_keys": 20
  }
}
```

#### **3. 业力购买章节**
```
POST /api/chapter-unlock/buy-with-karma/:chapterId/:userId
```
**响应示例：**
```json
{
  "success": true,
  "message": "章节购买成功",
  "data": {
    "karma_used": 32,
    "remaining_karma": 0
  }
}
```

#### **4. 获取解锁历史**
```
GET /api/chapter-unlock/history/:userId?limit=20&offset=0
```

#### **5. 用户设置管理**
```
GET /api/chapter-unlock/settings/:userId
POST /api/chapter-unlock/settings/:userId
```

### **核心逻辑**

#### **解锁状态判断**
```javascript
// 1. 检查是否已解锁
const existingUnlock = await checkExistingUnlock(userId, chapterId);

// 2. 检查订阅状态
const isSubscribed = user.subscription_status !== 'none' && 
                    user.subscription_end_date > new Date();

// 3. 检查免费解锁
const isFree = !chapter.is_premium || 
               (chapter.free_unlock_time && new Date(chapter.free_unlock_time) <= now);

// 4. 检查钥匙解锁
const canUnlockWithKey = !existingUnlock && 
                        user.points >= chapter.key_cost && 
                        chapter.is_premium;

// 5. 检查业力购买
const canBuyWithKarma = !existingUnlock && 
                       user.karma_count >= chapter.karma_cost && 
                       chapter.is_premium;
```

#### **事务处理**
```javascript
// 开始事务
await db.query('START TRANSACTION');

try {
  // 1. 扣除货币
  await db.query('UPDATE user SET points = points - ? WHERE id = ?', [cost, userId]);
  
  // 2. 记录解锁
  await db.query('INSERT INTO chapter_unlocks ...', [userId, chapterId, method, cost]);
  
  // 3. 记录访问日志
  await db.query('INSERT INTO chapter_access_log ...', [userId, chapterId, method]);
  
  // 提交事务
  await db.query('COMMIT');
} catch (error) {
  // 回滚事务
  await db.query('ROLLBACK');
  throw error;
}
```

## 🎨 **前端实现**

### **ChapterUnlockModal组件**

#### **功能特性**
- ✅ 实时倒计时显示
- ✅ 多种解锁方式选择
- ✅ 用户资源显示
- ✅ 自动解锁设置
- ✅ 响应式设计

#### **使用示例**
```jsx
import ChapterUnlockModal from './components/ChapterUnlockModal/ChapterUnlockModal';

<ChapterUnlockModal
  isOpen={showUnlockModal}
  onClose={() => setShowUnlockModal(false)}
  chapterId={currentChapterId}
  userId={currentUserId}
  onUnlockSuccess={() => {
    // 解锁成功后的处理
    fetchChapterContent();
  }}
/>
```

### **UI设计特点**

#### **匹配WuxiaWorld设计**
- 🎨 深色主题 (#2a2a2a背景)
- 🔵 蓝色强调色 (#007bff)
- 📱 响应式布局
- ⚡ 流畅动画效果

#### **解锁选项布局**
```
┌─────────────────────────────────┐
│  🕐 Time Until Free Chapter     │
│     22h:58m:35s                │
├─────────────────────────────────┤
│           or                    │
├─────────────────────────────────┤
│  [UNLOCK WITH 🔑 1]             │
│  [BUY AND READ ☯ 32]           │
│  [CHAMPIONS Subscribe...]       │
│  ☐ Enable Auto Unlock          │
└─────────────────────────────────┘
```

## 🧪 **测试验证**

### **数据库测试**
```bash
# 运行数据库测试
node test_chapter_unlock_system.js
```

### **API测试**
```bash
# 启动服务器
npm start

# 测试解锁状态
curl "http://localhost:5000/api/chapter-unlock/status/1/1"

# 测试钥匙解锁
curl -X POST "http://localhost:5000/api/chapter-unlock/unlock-with-key/1/1"
```

### **前端测试**
```bash
# 启动前端
cd frontend
npm start

# 访问测试页面
http://localhost:3000/chapter/1
```

## 📊 **系统优势**

### **1. 完整的解锁机制**
- ✅ 4种解锁方式覆盖所有用户需求
- ✅ 灵活的定价策略
- ✅ 订阅服务提供无限访问

### **2. 用户体验优化**
- ✅ 实时倒计时显示
- ✅ 清晰的解锁选项
- ✅ 自动解锁设置
- ✅ 资源余额显示

### **3. 数据完整性**
- ✅ 事务处理确保数据一致性
- ✅ 完整的解锁记录
- ✅ 访问日志追踪
- ✅ 用户设置持久化

### **4. 扩展性设计**
- ✅ 支持多种货币类型
- ✅ 灵活的订阅等级
- ✅ 可配置的解锁规则
- ✅ 完整的API接口

## 🚀 **部署指南**

### **1. 数据库初始化**
```bash
# 创建解锁系统表
node create_chapter_unlock_tables.js
```

### **2. 后端服务**
```bash
# 安装依赖
npm install

# 启动服务
npm start
```

### **3. 前端集成**
```jsx
// 在章节页面中集成解锁模态框
import ChapterUnlockModal from './components/ChapterUnlockModal/ChapterUnlockModal';

// 检查章节是否需要解锁
const checkChapterAccess = async (chapterId, userId) => {
  const response = await fetch(`/api/chapter-unlock/status/${chapterId}/${userId}`);
  const data = await response.json();
  
  if (!data.data.unlock_status.is_unlocked) {
    setShowUnlockModal(true);
  }
};
```

## 🎯 **总结**

章节解锁系统完全实现了WuxiaWorld的解锁机制，包括：

1. **4种解锁方式**：免费倒计时、钥匙解锁、业力购买、订阅服务
2. **完整的数据库设计**：支持解锁记录、用户设置、访问日志
3. **强大的后端API**：事务处理、状态管理、历史记录
4. **精美的前端界面**：匹配WuxiaWorld设计、响应式布局
5. **完善的测试验证**：数据库测试、API测试、前端测试

这个系统为您的网站提供了完整的章节解锁功能，与WuxiaWorld的用户体验完全一致！🎉
