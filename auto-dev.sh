#!/bin/bash

echo "🚀 自动开发检查脚本"
echo

echo "📋 选择要运行的检查:"
echo "1. 开发前检查 (auto:start)"
echo "2. 开发中检查 (auto:during)"  
echo "3. 开发后检查 (auto:post)"
echo "4. 运行所有检查"
echo "5. 退出"
echo

read -p "请输入选择 (1-5): " choice

case $choice in
    1)
        echo "🚀 运行开发前检查..."
        npm run auto:start
        ;;
    2)
        echo "🔍 运行开发中检查..."
        npm run auto:during
        ;;
    3)
        echo "🏁 运行开发后检查..."
        npm run auto:post
        ;;
    4)
        echo "🎯 运行所有检查..."
        npm run auto:start
        echo
        npm run auto:during
        echo
        npm run auto:post
        ;;
    5)
        echo "👋 退出"
        exit
        ;;
    *)
        echo "❌ 无效选择，请重新运行脚本"
        exit 1
        ;;
esac

echo
echo "✅ 检查完成！"
