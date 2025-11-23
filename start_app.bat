@echo off
chcp 65001 >nul
echo ========================================
echo 武侠世界应用启动脚本
echo ========================================
echo.

echo 正在检查MySQL服务状态...

REM 检查MySQL93服务
sc query "MySQL93" >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ 找到MySQL93服务
    sc query "MySQL93" | find "RUNNING" >nul
    if %errorlevel% equ 0 (
        echo ✓ MySQL93服务正在运行
        goto check_port
    ) else (
        echo ✗ MySQL93服务未运行
        echo.
        echo 尝试启动MySQL93服务...
        net start MySQL93 >nul 2>&1
        if %errorlevel% equ 0 (
            echo ✓ MySQL93服务启动成功
            goto check_port
        ) else (
            echo ✗ 无法通过服务启动MySQL93
            goto manual_mysql_start
        )
    )
) else (
    echo ✗ 未找到MySQL93服务
    goto manual_mysql_start
)

:check_port
echo.
echo 检查MySQL端口状态...
netstat -an | find ":3306" | find "LISTENING" >nul
if %errorlevel% equ 0 (
    echo ✓ MySQL端口3306正在监听
    goto start_app_services
) else (
    echo ✗ MySQL端口3306未监听
    echo 当前3306端口状态:
    netstat -an | find ":3306"
    goto manual_mysql_start
)

:manual_mysql_start
echo.
echo ========================================
echo MySQL启动选项
echo ========================================
echo 1. 手动启动MySQL (推荐)
echo 2. 跳过MySQL检查，直接启动应用
echo 3. 退出
echo.
set /p choice="请选择 (1-3): "

if "%choice%"=="1" (
    echo.
    echo 正在手动启动MySQL...
    if exist "D:\MySql\bin\mysqld.exe" (
        if exist "D:\MySql\MySqlServer\my.ini" (
            echo 使用配置文件启动MySQL...
            start "MySQL Server" "D:\MySql\bin\mysqld.exe" --defaults-file="D:\MySql\MySqlServer\my.ini" MySQL93
            echo 等待MySQL启动...
            timeout /t 10 /nobreak >nul
            echo 请检查MySQL是否成功启动，然后按任意键继续...
            pause >nul
        ) else (
            echo 错误: 未找到配置文件 D:\MySql\MySqlServer\my.ini
            pause
            exit /b 1
        )
    ) else (
        echo 错误: 未找到MySQL可执行文件 D:\MySql\bin\mysqld.exe
        pause
        exit /b 1
    )
    goto start_app_services
) else if "%choice%"=="2" (
    echo 跳过MySQL检查，直接启动应用...
    goto start_app_services
) else if "%choice%"=="3" (
    echo 退出...
    exit /b 0
) else (
    echo 无效选择，请重新运行脚本
    pause
    exit /b 1
)

:start_app_services
echo.
echo ========================================
echo 启动应用服务
echo ========================================

echo 正在释放端口5000...
echo 检查端口5000占用情况...
netstat -ano | findstr ":5000" >nul
if %errorlevel% equ 0 (
    echo 发现端口5000被占用，正在释放...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000"') do (
        echo 终止进程 %%a
        taskkill /F /PID %%a >nul 2>&1
    )
    echo 等待端口释放...
    timeout /t 3 /nobreak >nul
    
    REM 再次检查端口是否已释放
    netstat -ano | findstr ":5000" >nul
    if %errorlevel% equ 0 (
        echo ⚠ 端口5000仍被占用，尝试强制释放...
        REM 强制终止所有Node.js进程
        taskkill /F /IM node.exe >nul 2>&1
        timeout /t 2 /nobreak >nul
    ) else (
        echo ✓ 端口5000已成功释放
    )
) else (
    echo ✓ 端口5000未被占用
)

echo 正在启动后端服务...
start "Backend Server" cmd /k "cd /d D:\project\wuxiaworld-clone\backend && node server.js"

echo 等待后端服务启动...
timeout /t 5 /nobreak >nul

REM 检查后端服务是否启动成功
echo 检查后端服务状态...
netstat -ano | findstr ":5000" | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
    echo ✓ 后端服务启动成功 (端口5000正在监听)
) else (
    echo ⚠ 后端服务可能未正常启动，请检查后端控制台窗口
)

echo 正在启动前端服务...
start "Frontend App" cmd /k "cd /d D:\project\wuxiaworld-clone\frontend && npm start"

echo.
echo ✓ 所有服务已启动
echo.
echo 后端服务: http://localhost:5000
echo 前端服务: http://localhost:3000
echo.
echo 新功能: 通知页面现在分为两个标签页
echo - "Unlock": 显示时间解锁记录
echo - "ChapterUpdates&Marketing": 显示章节更新和营销通知
echo.
echo 如果遇到数据库连接问题，请确保MySQL已正确启动
echo 可以手动运行: "D:\MySql\bin\mysqld.exe" --defaults-file="D:\MySql\MySqlServer\my.ini" MySQL93
echo.
echo 按任意键退出...
pause >nul
