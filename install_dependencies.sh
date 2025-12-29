#!/bin/bash
# 安装 MongoDB 和 Redis 的辅助脚本

set -e

echo "=== 修复 dpkg 问题 ==="
sudo dpkg --configure -a
sudo apt-get install -f -y

echo ""
echo "=== 安装 MongoDB ==="
if command -v mongod > /dev/null; then
    echo "✅ MongoDB 已安装"
else
    echo "正在安装 MongoDB..."
    wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
    echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
    sudo apt-get update
    sudo apt-get install -y mongodb-org
    echo "✅ MongoDB 安装完成"
fi

echo ""
echo "=== 安装 Redis ==="
if command -v redis-server > /dev/null; then
    echo "✅ Redis 已安装"
else
    echo "正在安装 Redis..."
    sudo apt-get install -y redis-server
    echo "✅ Redis 安装完成"
fi

echo ""
echo "=== 配置 Redis 密码 ==="
if [ -f "src/server/.env" ]; then
    REDIS_PASSWORD=$(grep -E "^\s*REDIS_PASSWORD\s*=" src/server/.env | cut -d '=' -f 2- | tr -d '"\r' | sed 's/^ *//;s/ *$//')
    if [ -n "$REDIS_PASSWORD" ]; then
        echo "从 .env 文件读取 Redis 密码"
        sudo sed -i "s/# requirepass foobared/requirepass $REDIS_PASSWORD/" /etc/redis/redis.conf
        sudo sed -i "s/^requirepass.*/requirepass $REDIS_PASSWORD/" /etc/redis/redis.conf
        echo "✅ Redis 密码已配置"
    else
        echo "⚠️  未找到 REDIS_PASSWORD，请手动配置"
    fi
else
    echo "⚠️  未找到 .env 文件"
fi

echo ""
echo "=== 创建 MongoDB 数据目录 ==="
sudo mkdir -p /data/db
sudo chown -R $USER:$USER /data/db 2>/dev/null || echo "⚠️  无法更改 /data/db 权限，可能需要手动设置"

echo ""
echo "=== 安装完成 ==="
echo ""
echo "要启动服务，请运行："
echo "  # MongoDB"
echo "  mongod --dbpath /data/db --fork --logpath /tmp/mongod.log"
echo ""
echo "  # Redis"
echo "  redis-server --bind 0.0.0.0 --requirepass \"\$REDIS_PASSWORD\" --daemonize yes"
echo ""
echo "或者运行启动脚本："
echo "  ./start_all_services.sh"

