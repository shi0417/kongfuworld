#!/bin/bash
# 开发后自动检查脚本
echo "🏁 运行开发后自动检查..."
npm run check:all
if [ $? -eq 0 ]; then
  echo "✅ 开发后检查通过，开发完成"
else
  echo "⚠️  开发后检查发现问题，请查看日志"
fi
