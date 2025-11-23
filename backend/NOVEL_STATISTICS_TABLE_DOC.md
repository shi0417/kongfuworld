# novel_statistics 表使用文档

## 表的作用

`novel_statistics` 表用于**统计小说每日的访问和行为数据**，主要用于：

1. **首页热门小说排序**
   - 支持"本周热门"功能，根据最近7天的浏览量(`views`)和阅读量(`reads`)进行排序
   - 用于动态展示最受欢迎的小说

2. **数据分析与统计**
   - 记录每日的浏览量、阅读量、收藏量、评论量、分享量
   - 支持按日期查询历史数据
   - 可用于生成趋势图表和数据分析报告

3. **推荐算法支持**
   - 为推荐系统提供数据基础
   - 支持按不同维度（浏览量、阅读量等）进行排序

## 表结构

```sql
CREATE TABLE `novel_statistics` (
  `id` int NOT NULL AUTO_INCREMENT,
  `novel_id` int NOT NULL,
  `date` date NOT NULL COMMENT '统计日期',
  `views` int DEFAULT 0 COMMENT '当日浏览量',
  `reads` int DEFAULT 0 COMMENT '当日阅读量',
  `favorites` int DEFAULT 0 COMMENT '当日收藏量',
  `comments` int DEFAULT 0 COMMENT '当日评论量',
  `shares` int DEFAULT 0 COMMENT '当日分享量',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_novel_date` (`novel_id`, `date`),
  KEY `date` (`date`),
  KEY `views` (`views`),
  KEY `reads` (`reads`),
  CONSTRAINT `novel_statistics_ibfk_1` FOREIGN KEY (`novel_id`) REFERENCES `novel` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 关键特性

- **唯一约束**: `(novel_id, date)` 组合唯一，确保每天每个小说只有一条统计记录
- **索引优化**: 
  - `date` 索引：用于按日期范围查询
  - `views` 索引：用于按浏览量排序
  - `reads` 索引：用于按阅读量排序
- **自动更新时间戳**: `updated_at` 字段自动更新

## 数据更新时机

### 1. ✅ 已实现的更新事件

#### 浏览量 (views) 更新
- **事件**: 用户访问小说详情页
- **API接口**: `POST /api/novel/:id/view`
- **代码位置**: `backend/server.js` 第 1475-1493 行
- **更新逻辑**:
  ```sql
  INSERT INTO novel_statistics (novel_id, date, views) 
  VALUES (?, ?, 1)
  ON DUPLICATE KEY UPDATE views = views + 1
  ```
- **触发场景**: 
  - 用户点击进入小说详情页时
  - 前端调用该接口记录访问

### 2. ⚠️ 未实现的更新事件（表中有字段但代码未实现）

#### 阅读量 (reads) 更新
- **预期事件**: 用户开始阅读章节时
- **当前状态**: 字段存在，但代码中**没有实现更新逻辑**
- **建议实现位置**: 
  - 章节阅读页面加载时 (`/api/novel/:novelId/chapter/:chapterId`)
  - 或阅读记录创建时 (`reading_log` 表插入时)

#### 收藏量 (favorites) 更新
- **预期事件**: 用户收藏/取消收藏章节时
- **当前状态**: 字段存在，但代码中**没有实现更新逻辑**
- **建议实现位置**: 
  - `POST /api/favorites/add` - 收藏时 `favorites = favorites + 1`
  - `DELETE /api/favorites/remove` - 取消收藏时 `favorites = favorites - 1`

#### 评论量 (comments) 更新
- **预期事件**: 用户发表评论时
- **当前状态**: 字段存在，但代码中**没有实现更新逻辑**
- **建议实现位置**: 
  - `POST /api/review` - 添加评论时 `comments = comments + 1`
  - 删除评论时 `comments = comments - 1`

#### 分享量 (shares) 更新
- **预期事件**: 用户分享小说时
- **当前状态**: 字段存在，但代码中**没有实现更新逻辑**
- **建议实现位置**: 
  - 分享功能实现时调用接口 `POST /api/novel/:id/share`

## 数据查询使用场景

### 1. 本周热门小说查询

**API**: `GET /api/homepage/popular-this-week`

**SQL查询**:
```sql
SELECT 
  n.id, n.title, n.author, n.cover, n.rating, n.reviews, n.status,
  COALESCE(SUM(ns.views), 0) as weekly_views,
  COALESCE(SUM(ns.reads), 0) as weekly_reads
FROM novel n
LEFT JOIN novel_statistics ns ON n.id = ns.novel_id 
  AND ns.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
GROUP BY n.id
HAVING weekly_views > 0
ORDER BY weekly_views DESC, weekly_reads DESC
LIMIT ?
```

**逻辑说明**:
- 查询最近7天的统计数据
- 按浏览量降序排序，浏览量相同则按阅读量降序排序
- 只显示有浏览记录的小说

### 2. 首页综合数据查询

**API**: `GET /api/homepage/all`

在首页数据组合接口中，也使用了 `novel_statistics` 来获取热门小说数据。

## 建议的改进

### 1. 完善统计更新逻辑

建议在以下位置添加统计更新：

```javascript
// 阅读章节时更新 reads
app.get('/api/novel/:novelId/chapter/:chapterId', (req, res) => {
  // ... 现有逻辑 ...
  
  // 更新阅读统计
  const today = new Date().toISOString().split('T')[0];
  db.query(`
    INSERT INTO novel_statistics (novel_id, date, reads) 
    VALUES (?, ?, 1)
    ON DUPLICATE KEY UPDATE reads = reads + 1
  `, [novelId, today]);
});

// 收藏时更新 favorites
app.post('/api/favorites/add', (req, res) => {
  // ... 现有逻辑 ...
  
  // 更新收藏统计
  const today = new Date().toISOString().split('T')[0];
  db.query(`
    INSERT INTO novel_statistics (novel_id, date, favorites) 
    VALUES (?, ?, 1)
    ON DUPLICATE KEY UPDATE favorites = favorites + 1
  `, [novelId, today]);
});

// 评论时更新 comments
app.post('/api/review', (req, res) => {
  // ... 现有逻辑 ...
  
  // 更新评论统计
  const today = new Date().toISOString().split('T')[0];
  db.query(`
    INSERT INTO novel_statistics (novel_id, date, comments) 
    VALUES (?, ?, 1)
    ON DUPLICATE KEY UPDATE comments = comments + 1
  `, [novelId, today]);
});
```

### 2. 防止重复统计

建议在更新统计时：
- 使用用户ID进行去重，避免同一用户重复统计
- 可以考虑添加 `user_view_log` 表记录用户的访问记录

### 3. 定期清理旧数据

建议定期清理过期的统计数据（如保留最近90天），减少表的大小：
```sql
DELETE FROM novel_statistics 
WHERE date < DATE_SUB(CURDATE(), INTERVAL 90 DAY);
```

## 总结

- ✅ **已实现**: 浏览量(views)的统计更新
- ⚠️ **未实现**: 阅读量(reads)、收藏量(favorites)、评论量(comments)、分享量(shares)的统计更新
- 📊 **主要用途**: 首页热门小说排序和数据分析
- 🔍 **查询场景**: 本周热门小说查询（基于最近7天的数据）

