#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/data/apps/kongfuworld"
NGINX_ROOT="/var/www/kongfuworld"

cd "$APP_DIR"
git fetch origin
git reset --hard origin/main

cd frontend
npm install --legacy-peer-deps
rm -rf build
export GENERATE_SOURCEMAP=false
npm run build

# Gate 1: build 内禁止 localhost
echo "🔍 Gate 1: Checking build directory for localhost references..."
grep -R "localhost:5000" build && exit 1 || true
grep -R "http://localhost" build && exit 1 || true
grep -R "localhost" build && exit 1 || true
echo "✅ Gate 1 passed: No localhost references in build directory"

rsync -av --delete build/ "$NGINX_ROOT/"

# Gate 2: nginx root 禁止 localhost
echo "🔍 Gate 2: Checking nginx root for localhost references..."
grep -R "localhost:5000" "$NGINX_ROOT" && exit 2 || true
grep -R "http://localhost" "$NGINX_ROOT" && exit 2 || true
grep -R "localhost" "$NGINX_ROOT" && exit 2 || true
echo "✅ Gate 2 passed: No localhost references in nginx root"

nginx -t
systemctl reload nginx

echo "✅ Deployment completed successfully!"
echo ""
echo "Verify:"
echo "curl -I https://kongfuworld.com/"
echo "curl -sS https://kongfuworld.com/api/homepage/all?limit=1 | head"
