# Stage 2 Baseline 报告

## E1 Baseline 清单（连接形态分类）

### High risk (global single connection): 
- **backend/routes/novelCreation.js**: 文件中存在大量 `db.query()` 调用，但 `db` 变量未定义（疑似 bug）。已开始修复，将迁移到 `Db.query()` / `Db.getPool()`。

### Medium (request-scoped createConnection):
- **backend/server.js** (行3011): `/api/mission-v2/list` 路由中使用 `mysql.createConnection()`
- **backend/server.js** (行3446): 某个路由中使用 `mysql.createConnection()`（需要确认具体路由）
- **backend/upload_novel.js** (行221): `getNovelChapters()` 函数中使用 `mysql.createConnection()`

### Low (pool/Db.query):
- **backend/db/index.js**: 使用 `mysql.createPool()`，提供 `Db.query()` 和 `Db.getPool()` 接口
- **backend/routes/novelCreation.js**: 部分路由已迁移到 `Db.query()`（如 `/genre/all`, `/languages/all`, `/novels/user/:user_id`, `/novel/:id`, `/novel/:id/detail`）
- **backend/server.js**: 多处使用 `Db.query()` 和 `Db.getPool()`
- **backend/routes/publicNews.js**: 使用 `Db.query()`
- **backend/upload_novel.js**: 大部分函数使用 `executeQuery()`，通过 `setDatabase()` 接收 pool

## 统计

- **mysql.createConnection()**: 约 586+ 处（主要在 server.js、admin.js、writer.js 等路由文件中）
- **mysql.createPool()**: 14 处（主要在 db/index.js 和 services 中）
- **Db.query()**: 70+ 处（已迁移的路由）
- **Db.getPool()**: 9 处

## 发现的问题

1. **novelCreation.js**: `db` 变量未定义但被大量使用，这是一个严重的 bug。需要全部迁移到 `Db.query()` / `Db.getPool()`。
2. **server.js**: 有两处 request-scoped `createConnection`，需要迁移到 pool。
3. **upload_novel.js**: `getNovelChapters()` 函数使用 `createConnection`，需要迁移。

## 修复进度

### S1: novelCreation.js 修复进度
- ✅ `/novel/create` - 已迁移到 async/await + pool.getConnection() + 事务
- ✅ `/novel/update` - 已迁移到 async/await + pool.getConnection() + 事务
- ✅ `/chapters/novel/:novelId/next-number` - 已迁移到 Db.query()
- ✅ `/chapters/novel/:novelId/last-chapter-status` - 已迁移到 Db.query()
- ✅ `/chapters/novel/:novelId/chapter/:chapterId/prev-chapter-status` - 已迁移到 Db.query()
- ✅ `/novels/:novelId/volumes` - 已迁移到 Db.query()
- ✅ `/chapter/:chapterId/volume` - 已迁移到 Db.query()
- ⏳ 剩余约 40 处 `db.query()` 调用需要修复

## 下一步行动

1. 继续修复 novelCreation.js 中剩余的 `db.query()` 调用
2. 修复 server.js 中的两处 request-scoped createConnection
3. 修复 upload_novel.js 中的 createConnection
4. 统一 DB 默认值策略和 fail-fast

