#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/data/apps/kongfuworld"
BACKEND_DIR="$APP_DIR/backend"

cd "$BACKEND_DIR"

echo "📦 Installing dependencies..."
npm install --legacy-peer-deps

echo "🚀 Starting PM2 in production mode..."
NODE_ENV=production pm2 start ecosystem.config.js --env production

echo "💾 Saving PM2 configuration..."
pm2 save

echo "✅ Backend started successfully!"
echo ""
echo "Check logs:"
echo "  pm2 logs kongfuworld-backend"
echo ""
echo "Check status:"
echo "  pm2 status"
