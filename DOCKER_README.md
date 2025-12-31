# Docker 部署指南

本项目已完全 Docker 化，支持一键启动所有服务。

## 快速开始

### 1. 前置要求

- Docker Desktop（Windows/Mac）或 Docker Engine（Linux）
- Docker Compose（通常已包含在 Docker Desktop 中）

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写你的 API Key：

**Windows:**
```cmd
copy .env.example .env
```

**Linux/Mac:**
```bash
cp .env.example .env
```

编辑 `.env` 文件，设置你的 LLM API 配置：

```env
OPENAI_API_BASE_URL=https://llmapi.paratera.com/v1
OPENAI_MODEL_NAME=DeepSeek-V3.2
OPENAI_API_KEY=your_api_key_here
```

### 3. 一键启动

**方式一：使用启动脚本（推荐）**

**Windows:**
```cmd
docker-start.bat
```

**Linux/Mac:**
```bash
chmod +x docker-start.sh
./docker-start.sh
```

**方式二：直接使用 Docker Compose**

```bash
docker-compose up -d
```

### 4. 访问应用

等待所有服务启动完成后（约 1-2 分钟），访问：

- **前端界面**: http://localhost:3000
- **后端 API**: http://localhost:5000
- **API 文档**: http://localhost:5000/docs

## 服务说明

### MongoDB
- **端口**: 27017
- **数据持久化**: 存储在 Docker volume `mongodb_data`
- **健康检查**: 自动检查数据库连接

### Backend (FastAPI)
- **端口**: 5000
- **健康检查**: http://localhost:5000/health
- **mem0 数据**: 存储在 Docker volume `mem0_data`

### Frontend (Next.js)
- **端口**: 3000
- **构建**: 使用 Next.js standalone 模式优化镜像大小

## 常用命令

### 启动服务
```bash
docker-compose up -d
```

### 查看日志
```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb
```

### 停止服务
```bash
docker-compose down
```

### 停止并删除数据
```bash
docker-compose down -v
```

### 重启服务
```bash
docker-compose restart
```

### 查看服务状态
```bash
docker-compose ps
```

### 重建镜像（代码更新后）
```bash
docker-compose build --no-cache
docker-compose up -d
```

## 开发模式

如果需要开发模式（代码热重载），可以修改 `docker-compose.yml`：

```yaml
backend:
  volumes:
    - ./src/server:/app/src/server  # 已启用，代码变更会自动重载
```

前端开发模式需要重新构建镜像或使用本地开发环境。

## 数据持久化

所有数据都存储在 Docker volumes 中：

- `mongodb_data`: MongoDB 数据库文件
- `mem0_data`: mem0 长期记忆数据

即使删除容器，数据也会保留。要完全清除数据：

```bash
docker-compose down -v
```

## 故障排查

### 1. 端口被占用

如果 3000 或 5000 端口被占用，可以修改 `docker-compose.yml` 中的端口映射：

```yaml
ports:
  - "3001:3000"  # 改为其他端口
```

### 2. MongoDB 连接失败

检查 MongoDB 容器是否正常启动：

```bash
docker-compose logs mongodb
docker-compose ps mongodb
```

### 3. API Key 未设置

确保 `.env` 文件中的 `OPENAI_API_KEY` 已正确设置：

```bash
docker-compose logs backend | grep API_KEY
```

### 4. 查看容器日志

```bash
# 查看所有日志
docker-compose logs

# 查看最近 100 行日志
docker-compose logs --tail=100

# 实时查看日志
docker-compose logs -f
```

### 5. 进入容器调试

```bash
# 进入后端容器
docker-compose exec backend bash

# 进入前端容器
docker-compose exec frontend sh

# 进入 MongoDB 容器
docker-compose exec mongodb mongosh
```

## 生产环境部署

### 1. 使用环境变量文件

创建 `.env.production`：

```env
OPENAI_API_BASE_URL=https://your-api-endpoint.com/v1
OPENAI_MODEL_NAME=your-model-name
OPENAI_API_KEY=your-production-api-key
```

启动时指定：

```bash
docker-compose --env-file .env.production up -d
```

### 2. 使用反向代理（Nginx）

可以添加 Nginx 服务到 `docker-compose.yml`：

```yaml
nginx:
  image: nginx:alpine
  ports:
    - "80:80"
  volumes:
    - ./nginx.conf:/etc/nginx/nginx.conf
  depends_on:
    - frontend
    - backend
```

### 3. 资源限制

在 `docker-compose.yml` 中添加资源限制：

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

## 镜像构建

### 单独构建镜像

```bash
# 构建后端镜像
docker build -f Dockerfile.backend -t vega-backend .

# 构建前端镜像
docker build -f Dockerfile.frontend -t vega-frontend .
```

### 推送到 Docker Hub

```bash
# 登录
docker login

# 标记镜像
docker tag vega-backend yourusername/vega-backend:latest
docker tag vega-frontend yourusername/vega-frontend:latest

# 推送
docker push yourusername/vega-backend:latest
docker push yourusername/vega-frontend:latest
```

## 性能优化

### 1. 使用多阶段构建

前端 Dockerfile 已使用多阶段构建，减小镜像大小。

### 2. 缓存优化

Dockerfile 已优化层缓存，依赖安装和代码复制分离。

### 3. 健康检查

所有服务都配置了健康检查，确保服务正常启动。

## 安全建议

1. **不要将 `.env` 文件提交到 Git**
2. **使用强密码保护 MongoDB**（生产环境）
3. **限制端口暴露**（仅暴露必要端口）
4. **定期更新基础镜像**
5. **使用 Docker secrets**（生产环境）

## 支持

如有问题，请查看：
- 项目 README.md
- Docker Compose 文档: https://docs.docker.com/compose/
- Docker 文档: https://docs.docker.com/

