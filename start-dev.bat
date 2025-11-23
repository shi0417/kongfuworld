@echo off
echo 启动开发环境...

echo.
echo 1. 启动后端服务器...
cd backend
start "Backend Server" cmd /k "node server.js"

echo.
echo 2. 等待后端服务器启动...
timeout /t 3 /nobreak > nul

echo.
echo 3. 启动前端服务器...
cd ..\frontend
start "Frontend Server" cmd /k "npm start"

echo.
echo 开发环境启动完成！
echo 后端服务器: http://localhost:5000
echo 前端服务器: http://localhost:3000
echo.
echo 按任意键退出...
pause > nul 