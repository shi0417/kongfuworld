@echo off
REM Chrome DevTools MCP Server 启动脚本（使用 Edge）
REM 
REM 此脚本会：
REM 1. 启动 Edge 浏览器并启用远程调试（端口 9222）
REM 2. 启动 Chrome DevTools MCP Server 连接到 Edge
REM
REM 如果启动报错提示找不到浏览器，请修改下面的路径：
REM 64位系统通常使用：C:\Program Files\Microsoft\Edge\Application\msedge.exe
REM 32位系统通常使用：C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe

echo ========================================
echo Chrome DevTools MCP Server 启动脚本
echo ========================================
echo.
echo 正在启动 Edge 浏览器（启用远程调试端口 9222）...
echo.

REM 尝试 64 位路径
if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files\Microsoft\Edge\Application\msedge.exe" --remote-debugging-port=9222
    echo Edge 浏览器已启动（64位路径）
    goto :start_mcp
)

REM 尝试 32 位路径
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --remote-debugging-port=9222
    echo Edge 浏览器已启动（32位路径）
    goto :start_mcp
)

echo 错误：找不到 Edge 浏览器！
echo 请手动检查 Edge 安装路径，或修改此脚本中的路径。
pause
exit /b 1

:start_mcp
echo.
echo 等待 3 秒后启动 MCP Server...
timeout /t 3 /nobreak >nul
echo.
echo ========================================
echo 正在启动 Chrome DevTools MCP Server...
echo 连接到: http://localhost:9222
echo ========================================
echo.
echo 提示：此窗口需要保持打开，关闭窗口将停止 MCP Server
echo 提示：Edge 浏览器窗口也需要保持打开
echo.

chrome-devtools-mcp --browserUrl http://localhost:9222

pause

