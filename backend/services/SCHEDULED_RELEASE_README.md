# 定时发布功能说明

## 功能概述

定时发布功能用于自动发布已到期的章节。系统会每小时整点检查 `scheduledrelease` 表中需要发布的章节，并自动更新发布状态。

## 工作原理

1. **定时任务**：使用 `node-cron` 库，每小时整点（00:00, 01:00, 02:00, ...）执行一次
2. **检查条件**：查询 `scheduledrelease` 表中 `is_released = 0` 且 `release_time <= 当前时间` 的记录
3. **更新操作**：
   - 更新 `scheduledrelease` 表的 `is_released = 1`
   - 更新 `chapter` 表的 `is_released = 1`

## 文件结构

- `backend/services/scheduledReleaseService.js` - 定时发布服务核心逻辑
- `backend/scripts/testScheduledRelease.js` - 手动测试脚本

## 使用方法

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 启动服务器

定时任务会在服务器启动时自动启动：

```bash
npm start
# 或
npm run dev
```

启动后会看到日志：
```
[定时发布任务] 定时发布任务已启动，每小时整点执行一次
Server running on http://localhost:5000
```

### 3. 手动测试

如果需要手动触发定时发布任务进行测试：

```bash
node scripts/testScheduledRelease.js
```

## 定时任务配置

### Cron 表达式

当前配置：`'0 * * * *'`
- 含义：每小时的第0分钟执行（即每小时整点）
- 格式：`分钟 小时 日 月 星期`

### 修改执行频率

如果需要修改执行频率，编辑 `backend/services/scheduledReleaseService.js`：

```javascript
// 每小时整点执行（当前配置）
cron.schedule('0 * * * *', ...)

// 每15分钟执行一次
cron.schedule('*/15 * * * *', ...)

// 每5分钟执行一次
cron.schedule('*/5 * * * *', ...)

// 每天凌晨2点执行
cron.schedule('0 2 * * *', ...)
```

## 数据库查询优化

为了确保查询性能，建议在数据库中添加复合索引：

```sql
-- 如果还没有索引，可以执行以下SQL
CREATE INDEX idx_scheduled_release_query 
ON scheduledrelease(is_released, release_time);
```

## 日志说明

定时任务执行时会输出以下日志：

```
[定时发布任务] 2025-11-09 10:00:00 - 开始执行定时发布检查...
[定时发布任务] 找到 3 个需要发布的章节
[定时发布任务] 已更新 3 条 scheduledrelease 记录
[定时发布任务] 已更新 3 个章节的发布状态
[定时发布任务] 成功发布 3 个章节
[定时发布任务] - 章节ID: 1495, 小说ID: 14, 计划发布时间: 2025-11-09 09:00:00
[定时发布任务] - 章节ID: 1496, 小说ID: 14, 计划发布时间: 2025-11-09 17:00:00
[定时发布任务] - 章节ID: 1497, 小说ID: 14, 计划发布时间: 2025-11-10 10:00:00
```

## 注意事项

1. **时区设置**：定时任务使用 `Asia/Shanghai` 时区，确保时间计算准确
2. **事务处理**：使用数据库事务确保数据一致性，如果更新失败会自动回滚
3. **错误处理**：如果执行失败，会记录错误日志但不会中断服务器运行
4. **服务器重启**：服务器重启后，定时任务会自动重新启动，并会在下次整点时执行

## 故障排查

### 问题：定时任务没有执行

1. 检查服务器是否正常运行
2. 查看服务器日志，确认定时任务是否已启动
3. 检查数据库中是否有符合条件的记录：
   ```sql
   SELECT * FROM scheduledrelease 
   WHERE is_released = 0 
   AND release_time <= NOW();
   ```

### 问题：章节没有更新

1. 检查数据库连接是否正常
2. 查看错误日志，确认是否有数据库错误
3. 手动执行测试脚本验证功能：
   ```bash
   node scripts/testScheduledRelease.js
   ```

## API 接口（可选）

如果需要通过 API 手动触发，可以在路由中添加：

```javascript
// 在 routes 中添加
router.post('/api/scheduled-release/trigger', async (req, res) => {
  try {
    await scheduledReleaseService.manualTrigger();
    res.json({ success: true, message: '定时发布任务已执行' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
```

