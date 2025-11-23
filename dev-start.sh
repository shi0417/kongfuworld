#!/bin/bash
# 开发前自动检查脚本
echo "🚀 开始Chat开发前自动检查..."
npm run auto:check
if [ $? -eq 0 ]; then
  echo "✅ 开发前检查通过，可以开始开发"
else
  echo "❌ 开发前检查失败，请修复问题后开始开发"
  exit 1
fi
