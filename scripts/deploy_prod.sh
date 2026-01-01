#!/usr/bin/env bash
set -euo pipefail

REPO="/data/apps/kongfuworld"
NGINX_ROOT="/var/www/kongfuworld"
PM2_NAME="kongfuworld-api"
ENV_FILE="$REPO/backend/kongfuworld.env"

echo "=============================="
echo "KongFuWorld Production Deploy"
echo "Scheme A: stash keep env + pull + Node20 + pm2 + frontend build + publish + nginx reload"
echo "=============================="

echo "[0] Baseline"
cd "$REPO"
date
echo "PWD=$(pwd)"
echo "HEAD=$(git rev-parse --short HEAD)"
git status -sb || true

echo "[1] Git stash（保留 env）"
# 仅 stash 其他变更，保留 env 文件本地化
# --keep-index: 保持 index（通常无 staged）
# --include-untracked: 把未跟踪也 stash 掉，避免污染 pull
STASH_NAME="local-deploy-changes-keep-env-$(date +%F-%H%M%S)"
git stash push --include-untracked -m "$STASH_NAME" -- . ":(exclude)$ENV_FILE" || true
echo "[INFO] stash list:"
git stash list | head -n 5 || true

echo "[2] 拉取最新代码"
git pull --rebase

echo "[3] Node 20 运行环境（nvm）"
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
else
  echo "[ERROR] nvm not found at $NVM_DIR/nvm.sh"
  exit 1
fi

# 安装/使用 Node 20（幂等）
nvm install 20
nvm use 20
echo "[INFO] node=$(node -v) npm=$(npm -v)"

echo "[4] 后端：安装依赖 + PM2 重启"
cd "$REPO/backend"
if [ -f package-lock.json ]; then
  npm ci || npm install
else
  npm install
fi

# 用 Node20 启动/重启（通过 pm2 使用当前 PATH 下 node）
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_NAME" --update-env
else
  pm2 start server.js --name "$PM2_NAME" --update-env
fi
pm2 save
pm2 list

echo "[5] 前端：Node20 构建"
cd "$REPO/frontend"
# 依赖安装：优先 npm ci；若 peer 冲突则 fallback
if [ -f package-lock.json ]; then
  npm ci || npm install --legacy-peer-deps
else
  npm install --legacy-peer-deps
fi

npm run build

echo "[6] 发布静态文件到 Nginx 目录"
if [ ! -d build ]; then
  echo "[ERROR] frontend/build not found."
  exit 1
fi

sudo mkdir -p "$NGINX_ROOT"
sudo rm -rf "$NGINX_ROOT"/*
sudo cp -r build/* "$NGINX_ROOT"/

echo "[7] Nginx reload"
sudo nginx -t
sudo systemctl reload nginx

echo "[8] 健康检查"
echo "- Frontend:"
curl -I -L https://kongfuworld.com/ | head -n 20 || true
echo "- API:"
curl -I -L "https://kongfuworld.com/api/chapter/1244?userId=1000" | head -n 20 || true

echo "✅ Deploy finished."
echo "[INFO] Remaining git status:"
cd "$REPO"
git status -sb || true
