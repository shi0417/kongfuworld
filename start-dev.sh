#!/bin/bash

echo "启动开发环境..."

echo ""
echo "1. 启动后端服务器..."
cd backend
gnome-terminal --title="Backend Server" -- bash -c "node server.js; exec bash" &
# 或者使用其他终端模拟器
# xterm -title "Backend Server" -e "node server.js; bash" &
# konsole --title "Backend Server" -e bash -c "node server.js; exec bash" &

echo ""
echo "2. 等待后端服务器启动..."
sleep 3

echo ""
echo "3. 启动前端服务器..."
cd ../frontend
gnome-terminal --title="Frontend Server" -- bash -c "npm start; exec bash" &
# 或者使用其他终端模拟器
# xterm -title "Frontend Server" -e "npm start; bash" &
# konsole --title "Frontend Server" -e bash -c "npm start; exec bash" &

echo ""
echo "开发环境启动完成！"
echo "后端服务器: http://localhost:5000"
echo "前端服务器: http://localhost:3000"
echo ""
echo "按 Ctrl+C 退出..."
wait 