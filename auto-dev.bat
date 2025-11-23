@echo off
echo 🚀 自动开发检查脚本
echo.

echo 📋 选择要运行的检查:
echo 1. 开发前检查 (auto:start)
echo 2. 开发中检查 (auto:during)  
echo 3. 开发后检查 (auto:post)
echo 4. 运行所有检查
echo 5. 退出
echo.

set /p choice=请输入选择 (1-5): 

if "%choice%"=="1" (
    echo 🚀 运行开发前检查...
    npm run auto:start
) else if "%choice%"=="2" (
    echo 🔍 运行开发中检查...
    npm run auto:during
) else if "%choice%"=="3" (
    echo 🏁 运行开发后检查...
    npm run auto:post
) else if "%choice%"=="4" (
    echo 🎯 运行所有检查...
    npm run auto:start
    echo.
    npm run auto:during
    echo.
    npm run auto:post
) else if "%choice%"=="5" (
    echo 👋 退出
    exit
) else (
    echo ❌ 无效选择，请重新运行脚本
    pause
    exit
)

echo.
echo ✅ 检查完成！
pause
