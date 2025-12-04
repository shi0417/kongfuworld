@echo off
REM 仅启动 Chrome DevTools MCP Server（假设 Edge 已在运行并启用远程调试）

echo ========================================
echo 正在启动 Chrome DevTools MCP Server...
echo 连接到: http://localhost:9222
echo ========================================
echo.
echo 提示：确保 Edge 浏览器已启动并启用远程调试（端口 9222）
echo 提示：此窗口需要保持打开，关闭窗口将停止 MCP Server
echo.

chrome-devtools-mcp --browserUrl http://localhost:9222

pause

