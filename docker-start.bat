@echo off
REM Docker 一键启动脚本 (Windows)

echo ==========================================
echo Vega Chat Bot - Docker 启动脚本
echo ==========================================

REM 检查 Docker 是否安装
where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: Docker 未安装，请先安装 Docker Desktop
    pause
    exit /b 1
)

REM 检查 Docker Compose 是否安装
docker compose version >nul 2>&1
if %errorlevel% neq 0 (
    docker-compose version >nul 2>&1
    if %errorlevel% neq 0 (
        echo 错误: Docker Compose 未安装
        pause
        exit /b 1
    )
)

REM 检查 .env 文件
if not exist .env (
    echo 警告: .env 文件不存在，正在从 .env.example 创建...
    if exist .env.example (
        copy .env.example .env >nul
        echo 请编辑 .env 文件，设置你的 OPENAI_API_KEY
        echo 然后重新运行此脚本
        pause
        exit /b 1
    ) else (
        echo 错误: .env.example 文件不存在
        pause
        exit /b 1
    )
)

echo.
echo 正在启动服务...
echo.

REM 使用 docker compose 或 docker-compose
docker compose version >nul 2>&1
if %errorlevel% equ 0 (
    docker compose up -d
) else (
    docker-compose up -d
)

if %errorlevel% equ 0 (
    echo.
    echo ==========================================
    echo 服务启动成功！
    echo ==========================================
    echo.
    echo 前端界面: http://localhost:3000
    echo 后端 API: http://localhost:5000
    echo API 文档: http://localhost:5000/docs
    echo.
    echo 查看日志: docker-compose logs -f
    echo 停止服务: docker-compose down
    echo.
) else (
    echo.
    echo ==========================================
    echo 服务启动失败，请查看错误信息
    echo ==========================================
)

pause

