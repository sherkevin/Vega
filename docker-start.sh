#!/bin/bash
# Docker 一键启动脚本

echo "=========================================="
echo "Vega Chat Bot - Docker 启动脚本"
echo "=========================================="

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "错误: Docker 未安装，请先安装 Docker Desktop"
    exit 1
fi

# 检查 Docker Compose 是否安装
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "错误: Docker Compose 未安装"
    exit 1
fi

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "警告: .env 文件不存在，正在从 .env.example 创建..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "请编辑 .env 文件，设置你的 OPENAI_API_KEY"
        echo "然后重新运行此脚本"
        exit 1
    else
        echo "错误: .env.example 文件不存在"
        exit 1
    fi
fi

# 检查 API Key 是否设置
if ! grep -q "OPENAI_API_KEY=.*[^=]$" .env 2>/dev/null; then
    echo "警告: OPENAI_API_KEY 未在 .env 文件中设置"
    echo "请编辑 .env 文件，设置你的 API Key"
    read -p "是否继续？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "正在启动服务..."
echo ""

# 使用 docker compose 或 docker-compose
if docker compose version &> /dev/null; then
    docker compose up -d
else
    docker-compose up -d
fi

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "服务启动成功！"
    echo "=========================================="
    echo ""
    echo "前端界面: http://localhost:3000"
    echo "后端 API: http://localhost:5000"
    echo "API 文档: http://localhost:5000/docs"
    echo ""
    echo "查看日志: docker-compose logs -f"
    echo "停止服务: docker-compose down"
    echo ""
else
    echo ""
    echo "=========================================="
    echo "服务启动失败，请查看错误信息"
    echo "=========================================="
    exit 1
fi

