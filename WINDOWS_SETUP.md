# Windows 系统运行指南

本指南将帮助您在 Windows 系统上运行 Vega 项目。

## 📋 前置要求

在开始之前，请确保您已安装以下软件：

### 1. 必需软件

- **Python 3.12+** - [下载地址](https://www.python.org/downloads/)
- **Node.js 18+** - [下载地址](https://nodejs.org/)
- **Docker Desktop** - [下载地址](https://www.docker.com/products/docker-desktop/)
- **MongoDB** - [下载地址](https://www.mongodb.com/try/download/community)
- **WSL (Windows Subsystem for Linux)** - 用于运行 Redis
  - 在 PowerShell（管理员）中运行：`wsl --install`
  - 或安装 Ubuntu：`wsl --install -d Ubuntu`
- **uv（可选但推荐）** - 快速的 Python 包管理器
  - 安装方法：`pip install uv` 或使用官方安装脚本

### 2. PowerShell 执行策略设置

以管理员身份打开 PowerShell，运行以下命令：

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## 🚀 安装步骤

### 步骤 1: 克隆项目（如果还没有）

```powershell
cd D:\Codes\CodesForLearning\Vega
```

### 步骤 2: 安装 Python 依赖

#### 方法 1: 使用 uv（推荐，更快）

首先安装 `uv`：

```powershell
# 使用 pip 安装 uv
pip install uv

# 或者使用官方安装脚本（推荐）
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

然后使用 `uv` 创建虚拟环境并安装依赖：

```powershell
# 进入服务器目录
cd src\server

# 使用 uv 创建虚拟环境（会自动创建 .venv 目录）
uv venv

# 使用 uv 安装依赖（会自动激活虚拟环境）
uv pip install -r requirements.txt

# 安装 workers 依赖
uv pip install -r workers\requirements.txt

# 安装所有 MCP 服务器的依赖
Get-ChildItem -Path mcp_hub -Directory | ForEach-Object {
    $reqFile = Join-Path $_.FullName "requirements.txt"
    if (Test-Path $reqFile) {
        Write-Host "安装 $($_.Name) 的依赖..."
        uv pip install -r $reqFile
    }
}

cd ..\..
```

**注意**: 如果使用 `uv`，启动脚本会自动检测并使用 `uv run` 来运行 Python 命令，无需手动激活虚拟环境。

#### 方法 2: 使用传统 venv

```powershell
# 进入服务器目录
cd src\server

# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
.\venv\Scripts\activate.ps1

# 安装依赖
pip install -r requirements.txt

# 安装 workers 依赖
cd workers
pip install -r requirements.txt
cd ..

# 安装所有 MCP 服务器的依赖
cd mcp_hub
Get-ChildItem -Directory | ForEach-Object {
    Write-Host "安装 $($_.Name) 的依赖..."
    if (Test-Path "$($_.FullName)\requirements.txt") {
        pip install -r "$($_.FullName)\requirements.txt"
    }
}
cd ..\..
```

### 步骤 3: 安装前端依赖

```powershell
# 进入客户端目录
cd src\client

# 安装依赖
npm install

cd ..\..
```

### 步骤 4: 配置环境变量

在 `src\server` 目录下创建 `.env` 文件（如果不存在），并配置以下必需的环境变量：

```env
# 服务器配置
APP_SERVER_PORT=5000
ENVIRONMENT=dev-local

# MongoDB 配置
MONGO_URI=mongodb://localhost:27017/
MONGO_DB_NAME=sentient_dev_db

# Redis 配置（用于 Celery）
REDIS_PASSWORD=your_redis_password_here
REDIS_HOST=localhost
REDIS_PORT=6379

# Auth0 配置（如果需要）
AUTH0_DOMAIN=your_auth0_domain
AUTH0_AUDIENCE=your_auth0_audience
AUTH0_SCOPE=your_auth0_scope
AUTH0_NAMESPACE=your_auth0_namespace
AUTH0_MANAGEMENT_CLIENT_ID=your_client_id
AUTH0_MANAGEMENT_CLIENT_SECRET=your_client_secret

# 加密配置（生成随机密钥）
AES_SECRET_KEY=your_64_character_hex_string_here
AES_IV=your_32_character_hex_string_here

# OpenAI/LLM 配置
OPENAI_API_BASE_URL=http://localhost:11434/v1/
OPENAI_MODEL_NAME=qwen3:4b
OPENAI_API_KEY=ollama

# Gemini API（用于嵌入）
GEMINI_API_KEY=your_gemini_api_key

# ChromaDB 配置
CHROMA_HOST=localhost
CHROMA_PORT=8002
EMBEDDING_MODEL_NAME=models/gemini-embedding-001

# VAPID 配置（用于推送通知）
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_ADMIN_EMAIL=your_email@example.com
```

**生成加密密钥的方法：**

在 Python 中运行：

```python
import secrets
print("AES_SECRET_KEY=" + secrets.token_hex(32))
print("AES_IV=" + secrets.token_hex(16))
```

### 步骤 5: 安装和配置 MongoDB

1. 下载并安装 MongoDB Community Edition
2. 将 MongoDB 安装为 Windows 服务：
   ```powershell
   # 以管理员身份运行
   mongod --install --serviceName "MongoDB" --serviceDisplayName "MongoDB"
   ```
3. 启动 MongoDB 服务：
   ```powershell
   Start-Service -Name "MongoDB"
   ```

### 步骤 6: 安装和配置 Redis（在 WSL 中）

1. 打开 WSL（Ubuntu）：
   ```powershell
   wsl -d Ubuntu
   ```

2. 在 WSL 中安装 Redis：
   ```bash
   sudo apt-get update
   sudo apt-get install redis-server
   ```

3. 配置 Redis 密码（编辑 `/etc/redis/redis.conf`）：
   ```bash
   sudo nano /etc/redis/redis.conf
   ```
   找到 `# requirepass foobared`，取消注释并设置密码：
   ```
   requirepass your_redis_password_here
   ```

4. 退出 WSL：
   ```bash
   exit
   ```

### 步骤 7: 配置 Docker Compose 文件

确保以下 Docker Compose 文件存在于项目根目录：
- `start_waha.yaml`
- `start_pgvector.yaml`
- `start_chroma.yaml`
- `start_litellm.yaml`

如果这些文件不存在，您需要创建它们或从项目仓库获取。

### 步骤 8: 修改启动脚本（如果需要）

编辑 `start_all_services.ps1`，确保 `$wslDistroName` 变量与您的 WSL 发行版名称匹配：

```powershell
$wslDistroName = "Ubuntu"  # 或您的 WSL 发行版名称
```

## 🎯 运行项目

### 方法 1: 使用自动化脚本（推荐）

在项目根目录运行：

```powershell
.\start_all_services.ps1
```

这个脚本会自动启动所有必需的服务：
- MongoDB 服务
- Redis（在 WSL 中）
- Docker 服务（Waha, PGVector, ChromaDB, LiteLLM）
- 所有 MCP 服务器
- Celery Worker 和 Beat
- FastAPI 主服务器
- Next.js 前端客户端

### 方法 2: 手动启动各个服务

如果您想手动控制每个服务，可以分别运行：

#### 1. 启动 MongoDB
```powershell
Start-Service -Name "MongoDB"
```

#### 2. 启动 Redis（在 WSL 中）
```powershell
wsl -d Ubuntu -e redis-server --bind 0.0.0.0 --requirepass "your_redis_password"
```

#### 3. 启动 Docker 服务
```powershell
docker compose -f start_waha.yaml up -d
docker compose -f start_pgvector.yaml up -d
docker compose -f start_chroma.yaml up -d
docker compose -f start_litellm.yaml up -d
```

#### 4. 启动 MCP 服务器
```powershell
cd src\server
.\venv\Scripts\activate.ps1
python -m mcp_hub.gmail.main
python -m mcp_hub.gcal.main
# ... 其他 MCP 服务器
```

#### 5. 启动 Celery Worker
```powershell
cd src\server
.\venv\Scripts\activate.ps1
celery -A workers.celery_app worker --loglevel=info --pool=solo
```

#### 6. 启动 Celery Beat
```powershell
cd src\server
.\venv\Scripts\activate.ps1
celery -A workers.celery_app beat --loglevel=info
```

#### 7. 启动 FastAPI 服务器
```powershell
cd src\server
.\venv\Scripts\activate.ps1
python -m main.app
```

#### 8. 启动 Next.js 客户端
```powershell
cd src\client
npm run dev
```

## 🌐 访问应用

启动成功后，您可以通过以下地址访问：

- **前端客户端**: http://localhost:3000
- **API 服务器**: http://localhost:5000

## 🔧 常见问题

### 1. PowerShell 执行策略错误

**错误**: `无法加载文件，因为在此系统上禁止运行脚本`

**解决方案**:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 2. MongoDB 服务无法启动

**解决方案**:
- 检查 MongoDB 是否已安装
- 以管理员身份运行 PowerShell
- 检查服务状态：`Get-Service MongoDB`

### 3. Redis 连接失败

**解决方案**:
- 确保 WSL 已安装并运行
- 检查 Redis 密码是否与 `.env` 文件中的 `REDIS_PASSWORD` 匹配
- 在 WSL 中测试 Redis：`wsl -d Ubuntu -e redis-cli ping`

### 4. Docker 容器无法启动

**解决方案**:
- 确保 Docker Desktop 正在运行
- 检查端口是否被占用
- 查看 Docker 日志：`docker compose -f start_chroma.yaml logs`

### 5. Python 模块导入错误

**解决方案**:
- 确保虚拟环境已激活
- 重新安装依赖：`pip install -r requirements.txt`
- 检查 Python 版本是否为 3.12+

### 6. Node.js 依赖安装失败

**解决方案**:
- 清除缓存：`npm cache clean --force`
- 删除 `node_modules` 和 `package-lock.json`，然后重新安装
- 尝试使用 `yarn` 或 `pnpm` 代替 `npm`

## 📝 注意事项

1. **端口占用**: 确保以下端口未被占用：
   - 3000 (Next.js)
   - 5000 (FastAPI)
   - 6379 (Redis)
   - 27017 (MongoDB)
   - 8002 (ChromaDB)
   - 以及其他 Docker 服务使用的端口

2. **防火墙**: 如果遇到连接问题，检查 Windows 防火墙设置

3. **WSL 网络**: Redis 在 WSL 中运行时，确保 WSL 网络配置正确

4. **环境变量**: 确保所有必需的环境变量都已正确配置

5. **虚拟环境**: 每次运行 Python 相关命令前，都要激活虚拟环境

## 🆘 获取帮助

如果遇到问题，请：
1. 检查各个服务的日志输出
2. 查看项目的 GitHub Issues
3. 参考项目文档：https://sentient-2.gitbook.io/docs

祝您使用愉快！🎉

