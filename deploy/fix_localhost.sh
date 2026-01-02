#!/bin/bash
# 批量修复 localhost:5000 硬编码的辅助脚本

# 注意：此脚本仅用于辅助，实际修改需要逐文件审查

echo "搜索所有包含 localhost:5000 的文件..."
find frontend/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "localhost:5000" {} \; | sort

echo ""
echo "搜索所有包含 http://localhost 的文件..."
find frontend/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "http://localhost" {} \; | sort

echo ""
echo "public 目录中的硬编码："
find frontend/public -type f -exec grep -l "localhost:5000" {} \;
