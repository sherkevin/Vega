# ChromaDB HTTP-only 模式错误修复总结

## 问题描述

ChromaDB 1.4.0 在某些情况下会被强制设置为 HTTP-only 模式，导致无法使用本地持久化存储，错误信息：
```
RuntimeError: Chroma is running in http-only client mode
```

## 根本原因

1. **`is_thin_client` 标志**：ChromaDB 有一个 `is_thin_client` 标志，如果为 `True`，会强制使用 HTTP API
2. **ChromaDB 1.4.0+ 的新架构**：不再支持旧的配置方式（如 `CHROMA_DB_IMPL` 环境变量）

## 修复方案

### 1. 强制设置 `is_thin_client = False`

在 `src/server/main/memory/mem0_client.py` 文件顶部（第 22-28 行）：

```python
# CRITICAL FIX: Force is_thin_client to False to prevent HTTP-only mode
try:
    import chromadb.config
    chromadb.config.is_thin_client = False
except (ImportError, AttributeError):
    pass
```

**关键**：这必须在任何 chromadb 模块被导入之前执行。

### 2. 移除旧的配置环境变量

不要设置以下环境变量（ChromaDB 1.4.0+ 不再支持）：
- ❌ `CHROMA_DB_IMPL`
- ❌ `IS_PERSISTENT`
- ❌ `CHROMA_API_IMPL`（除非需要强制指定）

### 3. 移除 HTTP 相关环境变量

确保以下环境变量不存在：
- `CHROMA_SERVER_HOST`
- `CHROMA_SERVER_HTTP_PORT`
- `CHROMA_HTTP_HOST`
- `CHROMA_HTTP_PORT`

### 4. 配置 mem0 使用正确的模型

mem0 需要配置：
- **embedder**：用于生成向量嵌入（使用 `GLM-Embedding-3`）
- **llm**：用于提取记忆（使用 `DeepSeek-V3.2-Instruct` 或 `GLM-4-Flash`）

模型名称映射：
- `DeepSeek-V3.2` → `DeepSeek-V3.2-Instruct`
- `GLM-4` → `GLM-4-Flash`

### 5. 配置 API base_url

mem0 的 OpenAI 客户端会从环境变量 `OPENAI_BASE_URL` 读取 base_url，需要设置：
```python
os.environ["OPENAI_BASE_URL"] = OPENAI_API_BASE_URL
```

## 验证修复

运行简化测试脚本：
```bash
cd src/server
.venv\Scripts\python.exe test_mem0_simple.py
```

如果看到 `[OK] mem0 客户端已成功初始化`，说明修复成功。

## 当前状态

✅ **ChromaDB HTTP-only 模式问题已修复**
✅ **mem0 客户端已成功初始化**
✅ **长期记忆功能已启用**

## 注意事项

1. **必须在导入 chromadb 之前设置 `is_thin_client`**：这个设置必须在任何 chromadb 模块被导入之前执行
2. **mem0 会自动创建客户端**：不需要手动创建 `PersistentClient`，mem0 会根据 `path` 参数自动创建
3. **ChromaDB 1.4.0+ 的新 API**：新版本不再支持旧的配置方式，必须使用新的客户端 API
4. **模型名称映射**：需要将配置的模型名称映射到 API 允许的模型名称

## 相关文件

- `src/server/main/memory/mem0_client.py` - mem0 客户端配置
- `src/server/test_mem0_simple.py` - 简化测试脚本
- `src/server/CHROMADB_FIX.md` - 详细修复文档

