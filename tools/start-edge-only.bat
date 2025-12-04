@echo off
REM 仅启动 Edge 浏览器（启用远程调试）
REM 如果 MCP Server 已经在运行，只需要启动浏览器时使用此脚本

echo 正在启动 Edge 浏览器（启用远程调试端口 9222）...

REM 尝试 64 位路径
if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files\Microsoft\Edge\Application\msedge.exe" --remote-debugging-port=9222
    echo Edge 浏览器已启动（64位路径）
    echo 远程调试端口: 9222
    pause
    exit /b 0
)

REM 尝试 32 位路径
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --remote-debugging-port=9222
    echo Edge 浏览器已启动（32位路径）
    echo 远程调试端口: 9222
    pause
    exit /b 0
)

echo 错误：找不到 Edge 浏览器！
pause
exit /b 1

