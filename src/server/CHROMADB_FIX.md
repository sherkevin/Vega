# ChromaDB HTTP-only 模式错误修复说明

## 问题描述

ChromaDB 1.4.0 在某些情况下会被强制设置为 HTTP-only 模式，导致无法使用本地持久化存储。

## 根本原因

1. **`is_thin_client` 标志**：ChromaDB 有一个 `is_thin_client` 标志，如果为 `True`，会强制使用 HTTP API
2. **旧配置方式**：ChromaDB 1.4.0+ 不再支持旧的配置方式（如 `CHROMA_DB_IMPL` 环境变量）

## 解决方案

### 1. 强制设置 `is_thin_client = False`

在 `src/server/main/memory/mem0_client.py` 文件顶部，在导入 chromadb 之前：

```python
# CRITICAL FIX: Force is_thin_client to False to prevent HTTP-only mode
try:
    import chromadb.config
    chromadb.config.is_thin_client = False
except (ImportError, AttributeError):
    pass
```

### 2. 移除旧的配置环境变量

不要设置以下环境变量（ChromaDB 1.4.0+ 不再支持）：
- `CHROMA_DB_IMPL` ❌
- `IS_PERSISTENT` ❌
- `CHROMA_API_IMPL` ❌（除非需要强制指定）

### 3. 移除 HTTP 相关环境变量

确保以下环境变量不存在：
- `CHROMA_SERVER_HOST`
- `CHROMA_SERVER_HTTP_PORT`
- `CHROMA_HTTP_HOST`
- `CHROMA_HTTP_PORT`

### 4. 使用 mem0 的标准配置

mem0 会自动处理 ChromaDB 客户端的创建，只需要提供 `path` 参数：

```python
config = {
    "vector_store": {
        "provider": "chroma",
        "config": {
            "collection_name": "memories",
            "path": persist_path  # 本地存储路径
        }
    }
}
```

## 验证修复

运行测试脚本验证：

```bash
cd src/server
.venv\Scripts\python.exe test_mem0.py
```

如果看到 `mem0_client.memory initialized: True`，说明修复成功。

## 注意事项

1. **必须在导入 chromadb 之前设置 `is_thin_client`**：这个设置必须在任何 chromadb 模块被导入之前执行
2. **mem0 会自动创建客户端**：不需要手动创建 `PersistentClient`，mem0 会根据 `path` 参数自动创建
3. **ChromaDB 1.4.0+ 的新 API**：新版本不再支持旧的配置方式，必须使用新的客户端 API

## 如果仍然失败

如果修复后仍然遇到问题，可以尝试：

1. **检查是否有其他包设置了 ChromaDB 配置**：
   ```python
   import os
   chroma_vars = {k: v for k, v in os.environ.items() if 'CHROMA' in k.upper()}
   print(chroma_vars)
   ```

2. **重新安装 chromadb**：
   ```bash
   pip uninstall chromadb
   pip install chromadb
   ```

3. **使用 ChromaDB 的 HTTP 模式**（如果必须）：
   启动 ChromaDB 服务器，然后使用 `host` 和 `port` 配置

