# Stage 2 - S2 完成报告：server.js request-scoped createConnection 清理

## S2.1 全文件定位结果

### 发现的 createConnection 位置

1. **行3010-3042**: `/api/mission-v2/user/:userId` 路由
   - **类型**: 简单单条 SELECT 查询
   - **SQL**: 查询用户任务列表（mission_config + user_mission_progress JOIN）
   - **修复策略**: 使用 `Db.query()` 替换

2. **行3445-3568**: `/api/user/:userId/read-chapter` 路由
   - **类型**: 多条查询 + 函数调用（需要连接参数）
   - **SQL**: 
     - SELECT chapter
     - SELECT user
     - SELECT chapter_unlocks (在 checkAndUpdateTimeUnlock 函数中)
     - UPDATE chapter_unlocks (在 checkAndUpdateTimeUnlock 函数中)
     - SELECT chapter_unlocks
     - SELECT user_champion_subscription
     - SELECT reading_log
     - INSERT reading_log
     - 多个查询（在 checkIsNewChapterImproved 函数中）
   - **修复策略**: 使用 `pool.getConnection()` 获取连接，传递给函数，最后释放

## S2.2 修复实施

### 修复 1: `/api/mission-v2/user/:userId` 路由

**修复前**:
```javascript
const mysql = require('mysql2/promise');
const db = await mysql.createConnection({...});
const [missions] = await db.execute(...);
await db.end();
```

**修复后**:
```javascript
const [missions] = await Db.query(..., { tag: 'server.mission-v2.list', idempotent: true });
```

### 修复 2: `/api/user/:userId/read-chapter` 路由

**修复前**:
```javascript
const mysql = require('mysql2/promise');
db = await mysql.createConnection({...});
// 多个查询...
await checkAndUpdateTimeUnlock(db, userId, chapterId);
await checkIsNewChapterImproved(db, userId, chapterId, hasValidChampion);
// ...
await db.end();
```

**修复后**:
```javascript
const pool = Db.getPool();
let conn = null;
try {
  conn = await pool.getConnection();
  // 多个查询使用 conn.execute()...
  await checkAndUpdateTimeUnlock(conn, userId, chapterId);
  await checkIsNewChapterImproved(conn, userId, chapterId, hasValidChampion);
  // ...
} finally {
  if (conn) conn.release();
}
```

## S2.3 删除无用 require

**检查结果**: 
- `grep "require.*mysql2/promise"` 在 server.js 中无匹配
- 行3010 和 3445 的 `const mysql = require('mysql2/promise');` 已删除
- 文件顶部仍有 `const mysql = require('mysql2');`（用于其他用途，保留）

## S2.4 验收结果

### 1. 语法检查
```bash
node --check backend/server.js
```
**结果**: ✅ 通过（需要从正确目录执行）

### 2. 残留扫描
```bash
grep "mysql2/promise.*createConnection\|createConnection.*mysql2/promise" backend/server.js
```
**结果**: ✅ 0 处（仅剩注释中的提及）

### 3. 代码验证

**修复 1 验证**:
- ✅ 使用 `Db.query()` 替换 `createConnection`
- ✅ 添加 tag: `server.mission-v2.list`
- ✅ 删除 `db.end()` 调用

**修复 2 验证**:
- ✅ 使用 `pool.getConnection()` 替换 `createConnection`
- ✅ 使用 `conn.release()` 替换 `db.end()`
- ✅ 保持函数签名不变（`checkAndUpdateTimeUnlock(conn, ...)` 和 `checkIsNewChapterImproved(conn, ...)`）

## 待执行的 curl 验收测试

需要重启后端后执行：

### Test 1: GET /api/mission-v2/user/:userId
```bash
curl -i "http://localhost:5000/api/mission-v2/user/1000"
```

### Test 2: POST /api/user/:userId/read-chapter
```bash
curl -i -X POST "http://localhost:5000/api/user/1000/read-chapter" \
  -H "Content-Type: application/json" \
  -d '{"chapterId": 1244}'
```

## Git Diff 摘要

**修改文件**: `backend/server.js`

**关键改动**:
1. 行3009-3042: 删除 `mysql.createConnection()`，改为 `Db.query()`
2. 行3431-3558: 删除 `mysql.createConnection()`，改为 `pool.getConnection()` + `conn.release()`

## 结论

✅ **server.js 的 request-scoped createConnection 已全部清理**

- 所有 `mysql2/promise.createConnection()` 调用已替换为 `Db.query()` 或 `pool.getConnection()`
- 语法检查通过
- 残留扫描通过（0 处）
- 业务逻辑保持不变（函数签名、返回结构）

**下一步**: 重启后端并执行 curl 验收测试

