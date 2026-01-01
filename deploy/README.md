# 部署脚本使用说明

## 快速开始

### 1. 配置变量

在服务器上执行部署前，需要设置以下环境变量（或修改 `deploy.sh` 中的默认值）：

```bash
# 项目目录（必须）
export APP_DIR=/data/apps/kongfuworld

# Git 分支名（可选，默认 main）
export BRANCH=main

# PM2 应用名称（可选，如果使用 PM2）
export PM2_APP_NAME=kongfuworld
```

### 2. 执行部署

```bash
# SSH 登录服务器后执行
cd /data/apps/kongfuworld
bash deploy/deploy.sh
```

### 3. 验证部署

```bash
# 验证首页
curl -I https://kongfuworld.com/

# 验证 API
curl -sS https://kongfuworld.com/api/homepage/all?limit=1 | head
```

## 部署流程说明

脚本会自动执行以下步骤：

1. **拉取最新代码**
   - `git fetch origin <BRANCH>`
   - `git reset --hard origin/<BRANCH>`

2. **安装后端依赖**
   - `cd backend && npm ci`

3. **安装前端依赖并构建**
   - `cd frontend && npm ci`
   - `npm run build`
   - 自动创建 `.env.production`（如果不存在）

4. **验证构建产物**
   - 检查构建产物中是否包含 `localhost:5000` 硬编码

5. **重启服务**
   - 如果检测到 PM2：`pm2 restart <PM2_APP_NAME>`
   - 否则提示手动重启

6. **验证部署**
   - 检查首页 HTTP 状态码
   - 检查 API 接口响应

## 环境变量配置

### 前端环境变量（.env.production）

部署脚本会自动创建 `frontend/.env.production` 文件，内容如下：

```bash
# 生产环境配置
# 如果留空，将自动使用 window.location.origin（同源）
REACT_APP_API_URL=
REACT_APP_ASSET_URL=
```

**说明：**
- 如果 `REACT_APP_API_URL` 留空，前端会自动使用 `window.location.origin`（即 `https://kongfuworld.com`）
- 如果需要指定不同的 API 服务器，可以设置：`REACT_APP_API_URL=https://api.kongfuworld.com`

## 故障排查

### 1. 部署失败

如果部署失败，检查：
- 项目目录是否正确
- Git 分支是否存在
- Node.js 和 npm 版本是否兼容
- 网络连接是否正常

### 2. 服务无法启动

- 检查 PM2 状态：`pm2 list`
- 查看 PM2 日志：`pm2 logs <PM2_APP_NAME>`
- 如果使用 systemd：`sudo systemctl status kongfuworld`

### 3. API 请求仍指向 localhost:5000

- 检查前端构建产物：`grep -r "localhost:5000" frontend/build/static/js/`
- 确认 `.env.production` 文件存在且配置正确
- 清除浏览器缓存并重新加载页面

## 手动部署步骤（备用）

如果自动部署脚本失败，可以手动执行以下步骤：

```bash
# 1. 进入项目目录
cd /data/apps/kongfuworld

# 2. 拉取代码
git fetch origin main
git reset --hard origin/main

# 3. 安装后端依赖
cd backend
npm ci

# 4. 安装前端依赖并构建
cd ../frontend
npm ci
npm run build

# 5. 重启服务（根据实际情况选择）
pm2 restart kongfuworld
# 或
sudo systemctl restart kongfuworld

# 6. 验证
curl -I https://kongfuworld.com/
curl -sS https://kongfuworld.com/api/homepage/all?limit=1 | head
```

## 注意事项

1. **备份**：部署前建议备份当前版本
2. **测试**：在生产环境部署前，建议先在测试环境验证
3. **监控**：部署后监控服务状态和日志
4. **回滚**：如果部署后出现问题，可以使用 Git 回滚到之前的版本

