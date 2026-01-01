#!/bin/bash
set -e  # 遇到错误立即退出

# ============================================
# 一键部署脚本 - KongFuworld
# ============================================
# 使用方法：
#   1. 修改下面的配置变量
#   2. 在服务器上执行：bash deploy/deploy.sh
# ============================================

# ========== 配置变量（请根据实际情况修改） ==========
# 项目目录（请修改为实际的项目路径）
APP_DIR="${APP_DIR:-/data/apps/kongfuworld}"

# Git 分支名（默认 main）
BRANCH="${BRANCH:-main}"

# PM2 应用名称（如果使用 pm2，请修改为实际的应用名）
PM2_APP_NAME="${PM2_APP_NAME:-kongfuworld}"

# ========== 颜色输出 ==========
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ========== 检查环境 ==========
log_info "开始部署流程..."

if [ ! -d "$APP_DIR" ]; then
    log_error "项目目录不存在: $APP_DIR"
    log_error "请设置环境变量 APP_DIR 或修改脚本中的 APP_DIR 变量"
    exit 1
fi

cd "$APP_DIR" || exit 1
log_info "当前目录: $(pwd)"

# ========== 打印 Git 信息 ==========
log_info "当前 Git 状态:"
git rev-parse HEAD
git log -1 --oneline

# ========== 打印环境变量 ==========
log_info "检查环境变量:"
printenv | grep -E "REACT_APP_API_URL|API_URL" || log_warn "未找到 REACT_APP_API_URL 环境变量（将使用同源）"

# ========== Git 拉取最新代码 ==========
log_info "拉取最新代码..."
git fetch origin "$BRANCH" || {
    log_error "Git fetch 失败"
    exit 1
}

git reset --hard "origin/$BRANCH" || {
    log_error "Git reset 失败"
    exit 1
}

log_info "代码已更新到最新版本: $(git rev-parse --short HEAD)"

# ========== 后端依赖安装 ==========
log_info "安装后端依赖..."
cd backend || {
    log_error "backend 目录不存在"
    exit 1
}

npm ci || {
    log_warn "npm ci 失败，尝试 npm install..."
    npm install --legacy-peer-deps || {
        log_error "后端依赖安装失败"
        exit 1
    }
}

log_info "后端依赖安装完成"

# ========== 前端依赖安装和构建 ==========
log_info "安装前端依赖..."
cd ../frontend || {
    log_error "frontend 目录不存在"
    exit 1
}

npm ci || {
    log_warn "npm ci 失败，尝试 npm install..."
    npm install --legacy-peer-deps || {
        log_error "前端依赖安装失败"
        exit 1
    }
}

log_info "前端依赖安装完成"

# 创建或更新 .env.production（如果不存在）
if [ ! -f .env.production ]; then
    log_info "创建 .env.production 文件..."
    cat > .env.production << 'EOF'
# 生产环境配置
# 如果留空，将自动使用 window.location.origin（同源）
REACT_APP_API_URL=
REACT_APP_ASSET_URL=
EOF
    log_info ".env.production 已创建"
fi

# ========== 清理旧构建 ==========
log_info "清理旧构建..."
rm -rf build

log_info "开始构建前端..."
npm run build || {
    log_error "前端构建失败"
    exit 1
}

log_info "前端构建完成"

# ========== 强制验证构建产物（必须通过） ==========
log_info "强制验证构建产物（禁止 localhost:5000）..."
if grep -R "localhost:5000" -n build/static/js >/dev/null 2>&1; then
    log_error "[FAIL] 生产构建产物包含 localhost:5000，部署终止！"
    log_error "发现以下问题："
    grep -R "localhost:5000" -n build/static/js | head -n 50
    exit 1
fi
log_info "✓ 构建产物验证通过（无 localhost:5000 硬编码）"

# ========== 重启服务 ==========
log_info "重启服务..."

# 检查是否使用 PM2
if command -v pm2 &> /dev/null; then
    log_info "使用 PM2 重启服务..."
    pm2 restart "$PM2_APP_NAME" || {
        log_warn "PM2 restart 失败，尝试 pm2 restart all..."
        pm2 restart all || {
            log_error "PM2 重启失败"
            exit 1
        }
    }
    log_info "PM2 服务已重启"
else
    log_warn "未检测到 PM2，请手动重启服务"
    log_warn "如果使用 systemd，可以执行: sudo systemctl restart kongfuworld"
fi

# ========== 验证部署 ==========
log_info "等待服务启动（5秒）..."
sleep 5

log_info "验证部署..."

# 验证首页
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://kongfuworld.com/ || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    log_info "✓ 首页访问正常 (HTTP $HTTP_CODE)"
else
    log_error "✗ 首页访问异常 (HTTP $HTTP_CODE)"
    exit 1
fi

# 验证 API
API_RESPONSE=$(curl -sS "https://kongfuworld.com/api/homepage/all?limit=1" | head -c 100 || echo "")
if echo "$API_RESPONSE" | grep -q "success\|data" || [ ${#API_RESPONSE} -gt 0 ]; then
    log_info "✓ API 接口响应正常"
else
    log_error "✗ API 接口响应异常"
    exit 1
fi

# ========== 完成 ==========
log_info ""
log_info "============================================"
log_info "部署完成！"
log_info "============================================"
log_info "Git Commit: $(git rev-parse --short HEAD)"
log_info "部署时间: $(date '+%Y-%m-%d %H:%M:%S')"
log_info ""
log_info "验证命令："
log_info "  curl -I https://kongfuworld.com/"
log_info "  curl -sS https://kongfuworld.com/api/homepage/all?limit=1 | head"
log_info "============================================"

exit 0

