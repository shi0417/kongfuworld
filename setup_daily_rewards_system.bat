@echo off
echo ========================================
echo 设置Daily Rewards系统
echo ========================================

echo.
echo 1. 创建任务系统数据库表...
node backend/create_mission_system_tables.js

echo.
echo 2. 启动后端服务器...
start "Backend Server" cmd /k "cd backend && npm start"

echo.
echo 3. 等待后端服务器启动...
timeout /t 5 /nobreak > nul

echo.
echo 4. 启动前端开发服务器...
start "Frontend Server" cmd /k "cd frontend && npm start"

echo.
echo ========================================
echo Daily Rewards系统设置完成！
echo ========================================
echo.
echo 访问地址：
echo - 前端: http://localhost:3000
echo - 后端: http://localhost:5000
echo - Daily Rewards: http://localhost:3000/daily-rewards
echo.
echo 功能说明：
echo - Login Rewards: 每日签到获得钥匙
echo - Mission Rewards: 阅读章节任务获得奖励
echo - 自动进度追踪: 阅读章节时自动更新任务进度
echo.
pause
