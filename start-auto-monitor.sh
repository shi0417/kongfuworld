#!/bin/bash

echo "🚀 启动自动开发监听程序..."
echo ""
echo "📋 功能说明:"
echo "  - 开发前: 自动运行 npm run auto:start"
echo "  - 开发中: 监听文件变化，自动运行 npm run auto:during"
echo "  - 开发后: 按 Ctrl+C 退出时自动运行 npm run auto:post"
echo ""
echo "💡 按 Ctrl+C 退出程序"
echo ""

node scripts/auto-dev-hooks.js
