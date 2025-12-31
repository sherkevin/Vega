# MongoDB 安装指南

## 选项1: 使用MongoDB官方安装程序（推荐）

### 下载和安装
1. 访问 MongoDB 官网：https://www.mongodb.com/try/download/community
2. 选择：
   - Version: 最新稳定版（如 7.0）
   - Platform: Windows
   - Package: MSI
3. 下载并运行安装程序
4. 安装时选择：
   - ✅ Install MongoDB as a Service（安装为Windows服务）
   - ✅ Install MongoDB Compass（可选，图形界面工具）
   - Service Name: MongoDB（默认）
   - Data Directory: 默认即可

### 验证安装
```powershell
# 检查服务
Get-Service -Name MongoDB

# 检查MongoDB是否运行
mongod --version
```

## 选项2: 使用Chocolatey（如果已安装）

```powershell
choco install mongodb
```

## 选项3: 使用Docker（如果已安装Docker）

```powershell
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

## 选项4: 便携版安装（无需安装程序）

1. 下载 MongoDB 便携版 ZIP
2. 解压到 `C:\mongodb`
3. 创建数据目录：`C:\data\db`
4. 手动启动：
   ```powershell
   C:\mongodb\bin\mongod.exe --dbpath C:\data\db
   ```

## 安装后

安装完成后，重新运行启动脚本：
```powershell
.\start_simple.ps1
```

脚本会自动检测并启动MongoDB。

## 注意事项

- MongoDB需要约500MB磁盘空间
- 默认端口：27017
- 数据存储在：`C:\data\db`（或安装时指定的目录）

