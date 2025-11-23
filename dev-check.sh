#!/bin/bash
# 开发中自动检查脚本
echo "🔍 运行开发中自动检查..."
npm run check:pre-commit
if [ $? -eq 0 ]; then
  echo "✅ 开发中检查通过"
else
  echo "⚠️  开发中检查发现问题，请查看日志"
fi
