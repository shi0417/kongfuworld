# Stage 2 - S1 完成报告：novelCreation.js DB 收敛

## 验收结果

### 1. 语法检查
```bash
node --check backend/routes/novelCreation.js
```
**结果**: ✅ 通过 (exit code: 0)

### 2. 残留扫描结果

#### 2.1 db.query() 调用
```bash
grep -r "db\.query(" backend/routes/novelCreation.js
```
**结果**: ✅ 0 处（已全部修复）

#### 2.2 beginTransaction/commit/rollback
```bash
grep -r "beginTransaction\|commit\|rollback" backend/routes/novelCreation.js
```
**结果**: ✅ 仅出现在 `conn.beginTransaction()`、`conn.commit()`、`conn.rollback()` 中（正确的事务处理）

#### 2.3 mysql.createConnection
```bash
grep -r "mysql\.createConnection" backend/routes/novelCreation.js
```
**结果**: ✅ 0 处（已全部移除）

#### 2.4 db 变量定义
```bash
grep -r "^const db\|^let db\|^var db" backend/routes/novelCreation.js
```
**结果**: ✅ 0 处（未定义模块级 db 变量）

### 3. 修复统计

#### 修复的路由（按类型分类）

**事务路由（已改为 async + pool.getConnection()）**:
1. ✅ `POST /novel/create` - 创建小说（包含事务）
2. ✅ `POST /novel/update` - 更新小说（包含事务）

**简单查询路由（已改为 Db.query().then().catch()）**:
3. ✅ `GET /chapters/novel/:novelId/list` - 获取章节列表
4. ✅ `GET /chapters/novel/:novelId/drafts` - 获取草稿列表
5. ✅ `POST /chapter/:chapterId/submit` - 提交草稿审核
6. ✅ `GET /chapters/novel/:novelId/next-number` - 获取下一个章节号
7. ✅ `GET /chapters/novel/:novelId/last-chapter-status` - 获取最新章节状态
8. ✅ `GET /chapters/novel/:novelId/chapter/:chapterId/prev-chapter-status` - 获取前一章节状态
9. ✅ `GET /novels/:novelId/volumes` - 获取卷列表
10. ✅ `PATCH /chapter/:chapterId/volume` - 更新章节所属卷
11. ✅ `POST /chapter/create` - 创建章节（async 路由，已改为 await Db.query()）
12. ✅ `POST /chapter/update` - 更新章节（async 路由，已改为 await Db.query()）
13. ✅ `DELETE /chapter/:chapterId` - 删除章节
14. ✅ `GET /chapters/novel/:novelId/paid` - 获取付费章节列表
15. ✅ `POST /chapters/batch-update-unlock-price` - 批量更新章节价格
16. ✅ `POST /chapter/update-unlock-price` - 单独更新章节价格

**总计**: 16 个路由已全部修复

### 4. 关键改动点

#### 4.1 文件顶部
- ✅ 添加 `const pool = Db.getPool();`（用于事务路由）

#### 4.2 事务路由模式
```javascript
// 修复前
db.beginTransaction((err) => {
  db.query(...);
  db.commit(...);
});

// 修复后
const conn = await pool.getConnection();
try {
  await conn.beginTransaction();
  const [rows] = await conn.execute(...);
  await conn.commit();
} catch (err) {
  try { await conn.rollback(); } catch {}
} finally {
  conn.release();
}
```

#### 4.3 简单查询路由模式
```javascript
// 修复前
db.query(sql, params, (err, results) => {
  if (err) { ... }
  res.json(results);
});

// 修复后
Db.query(sql, params, { tag: 'novelCreation.<routeName>', idempotent: true/false })
  .then(([results]) => {
    res.json(results);
  })
  .catch((err) => {
    ...
  });
```

### 5. Tag 命名规范

所有 Db.query() 调用都添加了唯一的 tag，格式为：
- `novelCreation.<功能模块>.<具体操作>`
- 例如：
  - `novelCreation.chapter.create.insert`
  - `novelCreation.chapter.update.main`
  - `novelCreation.chapters.list`
  - `novelCreation.batchUpdate.config`

### 6. 待验收测试

需要执行以下 curl 测试（需要后端运行）：

**GET 接口（3个）**:
1. `GET /api/chapters/novel/:novelId/next-number`
2. `GET /api/chapters/novel/:novelId/list`
3. `GET /api/novels/:novelId/volumes`

**写操作接口（2个）**:
4. `POST /api/novel/create`（事务路由）
5. `POST /api/novel/update`（事务路由）

## 结论

✅ **novelCreation.js 的 DB 入口已全部收敛到 pool**

- 所有 `db.query()` 调用已替换为 `Db.query()` 或 `conn.execute()`
- 所有事务路由已改为使用 `pool.getConnection()` + `conn.beginTransaction()`
- 无模块级 `db` 变量定义
- 无 `mysql.createConnection()` 调用
- 语法检查通过
- 所有路由都添加了唯一的 tag 用于日志追踪

