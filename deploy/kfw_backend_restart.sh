#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/data/apps/kongfuworld"
BACKEND_DIR="$APP_DIR/backend"

cd "$BACKEND_DIR"

echo "🔄 Restarting PM2 backend..."
pm2 restart kongfuworld-backend

echo "✅ Backend restarted successfully!"
echo ""
echo "Check logs:"
echo "  pm2 logs kongfuworld-backend --lines 50"
