#!/usr/bin/env bash
set -euo pipefail

REPO="/data/apps/kongfuworld"
NGINX_ROOT="/var/www/kongfuworld"
PM2_NAME="kongfuworld-api"
ENV_FILE="$REPO/backend/kongfuworld.env"

# 定义 run() 函数：打印命令 -> 执行 -> 若失败打印 [FAIL] 并 exit 1
run() {
  local cmd="$*"
  echo "[RUN] $cmd"
  if eval "$cmd"; then
    echo "[OK] Command succeeded"
  else
    echo "[FAIL] Command failed: $cmd"
    exit 1
  fi
}

echo "=============================="
echo "KongFuWorld Production Deploy"
echo "Scheme A: Enhanced with robust error handling"
echo "=============================="

# A) Baseline
echo "[A] Baseline"
run "date"
run "cd $REPO"
run "pwd"
run "git rev-parse --short HEAD"
run "node -v || echo 'node not in PATH'"
run "npm -v || echo 'npm not in PATH'"
run "pm2 -v || echo 'pm2 not found'"
run "nginx -v || echo 'nginx not found'"

# B) Git 更新（保留 env）
echo "[B] Git Update (preserve env)"
if [ -f "$ENV_FILE" ] && git check-ignore -q "$ENV_FILE"; then
  echo "[OK] $ENV_FILE exists and is ignored"
else
  echo "[WARN] $ENV_FILE may not be properly ignored"
fi

# Git stash（允许无变更继续）
echo "[B.1] Git stash (preserve env)"
STASH_NAME="deploy:stash-keep-env-$(date +%F-%H%M%S)"
if git stash push -u -m "$STASH_NAME" -- . ":(exclude)backend/kongfuworld.env" 2>/dev/null; then
  echo "[OK] Stashed changes"
else
  echo "[INFO] No changes to stash (continuing)"
fi
run "git stash list | head -n 3 || true"

# 拉取最新代码
echo "[B.2] Git pull"
run "git pull --rebase"
run "git status --porcelain"

# C) Node 20
echo "[C] Node 20 Setup"
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
elif [ -s "$HOME/.bashrc" ]; then
  # shellcheck disable=SC1090
  source "$HOME/.bashrc"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck disable=SC1090
    . "$NVM_DIR/nvm.sh"
  fi
fi

if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  echo "[FAIL] nvm not found at $NVM_DIR/nvm.sh"
  exit 1
fi

run "nvm install 20"
run "nvm use 20"
run "node -v"
run "npm -v"
run "which node"

# D) Backend 部署
echo "[D] Backend Deployment"
run "cd $REPO/backend"

# npm ci with fallback
echo "[D.1] Installing backend dependencies"
if npm ci 2>&1; then
  echo "[OK] npm ci succeeded"
else
  CI_ERROR=$?
  echo "[WARN] npm ci failed (exit $CI_ERROR), attempting fallback..."
  echo "[INFO] Fallback step 1: npm install --no-audit --no-fund"
  run "npm install --no-audit --no-fund"
  echo "[INFO] Fallback step 2: retry npm ci"
  run "npm ci"
fi

# PM2 重启
echo "[D.2] PM2 Restart"
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  run "pm2 restart $PM2_NAME --update-env"
else
  run "pm2 start server.js --name $PM2_NAME --update-env"
fi
run "pm2 save"
run "pm2 list | grep $PM2_NAME || pm2 list"

# 验证端口
echo "[D.3] Verify port 5000"
run "ss -lntp | grep ':5000'"

# E) Frontend 构建（Node20）
echo "[E] Frontend Build (Node20)"
run "cd $REPO/frontend"

# 安全检查：react-facebook-login
echo "[E.1] Safety check: react-facebook-login"
if node -e "const p=require('./package.json'); if((p.dependencies&&p.dependencies['react-facebook-login'])||(p.devDependencies&&p.devDependencies['react-facebook-login'])){console.error('react-facebook-login still present');process.exit(2)}" 2>/dev/null; then
  echo "[OK] react-facebook-login not found in package.json"
else
  echo "[FAIL] react-facebook-login is still present in package.json"
  echo "[FAIL] Please remove it from dependencies first"
  exit 2
fi

# 清理旧依赖
echo "[E.2] Clean old dependencies"
run "rm -rf node_modules"

# 安装依赖
echo "[E.3] Install frontend dependencies"
run "npm install --legacy-peer-deps --no-audit --no-fund"

# 构建
echo "[E.4] Build frontend"
run "npm run build"

# 验证 build 目录
echo "[E.5] Verify build directory"
run "test -d build && echo BUILD_OK"

# F) 发布静态文件 + nginx
echo "[F] Publish Static Files + Nginx"
run "sudo rm -rf $NGINX_ROOT/*"
run "sudo cp -r $REPO/frontend/build/* $NGINX_ROOT/"
run "sudo nginx -t"
run "sudo systemctl reload nginx"

# G) 健康检查
echo "[G] Health Checks"
run "curl -I https://kongfuworld.com/ | head -n 10"
run "curl -I 'https://kongfuworld.com/api/chapter/1244?userId=1000' | head -n 10"

# H) Summary
echo "=============================="
echo "[H] Deployment Summary"
echo "=============================="
cd "$REPO"
echo "HEAD: $(git rev-parse --short HEAD)"
echo "Node: $(node -v) | NPM: $(npm -v)"
echo "PM2 Status:"
pm2 list | grep "$PM2_NAME" || pm2 list
echo "Nginx Status: $(systemctl is-active nginx)"
echo "Build Files Count: $(ls -1 $NGINX_ROOT | wc -l)"
echo "Git Status:"
git status --porcelain || echo "clean"

echo "=============================="
echo "✅ Deploy finished successfully"
echo "=============================="

