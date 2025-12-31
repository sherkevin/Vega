# Mem0 长期记忆功能测试说明

## 测试脚本

运行测试脚本：
```bash
cd src/server
.venv\Scripts\python.exe test_mem0.py
```

## 测试内容

测试脚本会验证以下功能：

1. **配置检查**：验证 OPENAI_API_KEY 是否配置
2. **客户端初始化**：检查 mem0 客户端是否成功初始化
3. **添加记忆**：测试添加单条记忆
4. **搜索记忆**：测试根据查询搜索相关记忆
5. **提取记忆**：测试从对话历史中自动提取并存储记忆
6. **综合测试**：验证记忆检索功能

## 已知问题

### ChromaDB HTTP-only 模式错误

如果遇到以下错误：
```
RuntimeError: Chroma is running in http-only client mode
```

**可能的原因：**
- 某些环境变量或配置强制 ChromaDB 使用 HTTP 模式
- ChromaDB 版本兼容性问题
- 导入顺序导致的配置问题

**解决方案：**

1. **检查环境变量**：
   ```bash
   # 检查是否有强制 HTTP 模式的变量
   echo $CHROMA_SERVER_HOST
   echo $CHROMA_API_IMPL
   ```

2. **尝试在代码中设置**：
   在 `mem0_client.py` 中，我们已经尝试设置环境变量，但可能需要在导入 chromadb 之前设置。

3. **使用不同的向量存储**：
   如果 ChromaDB 持续有问题，可以考虑：
   - 使用 SQLite（如果 mem0 支持）
   - 使用其他向量数据库（如 Qdrant、Pinecone）

4. **重启 Python 进程**：
   某些配置可能在模块导入时设置，重启 Python 进程可能解决问题。

## 验证 mem0 是否工作

即使 ChromaDB 初始化失败，mem0 包本身已经成功安装。你可以通过以下方式验证：

```python
# 验证 mem0 包已安装
python -c "from mem0 import Memory; print('mem0 imported successfully')"

# 检查 mem0_client 模块
python -c "from main.memory.mem0_client import mem0_client; print('mem0_client imported')"
```

## 实际使用中的行为

在实际的聊天流程中（`src/server/main/chat/utils.py`），mem0 的使用是容错的：

- 如果 mem0 未初始化，会记录警告但不会中断对话
- 短期记忆（最近 5 轮对话）仍然正常工作
- 只有长期记忆功能会被禁用

这意味着即使 mem0 初始化失败，聊天功能仍然可以正常使用，只是没有长期记忆能力。

## 下一步

1. 如果测试通过：mem0 功能正常工作，长期记忆已启用
2. 如果测试失败但包已安装：检查 ChromaDB 配置，或考虑使用其他向量存储
3. 如果包未安装：运行 `pip install mem0ai` 安装

