# Mem0 对话隔离功能实现

## 问题描述

1. **搜索记忆时出错**：`'str' object has no attribute 'get'` - mem0 的 search 方法返回格式不一致
2. **记忆未隔离**：所有对话窗口共享同一记忆空间，导致记忆混乱
3. **提取记忆方法不存在**：`'Memory' object has no attribute 'extract'` - mem0 没有 `extract` 方法

## 解决方案

### 1. 修复搜索记忆返回格式处理

**问题**：mem0 的 `search` 方法可能返回不同格式：
- 字典列表（包含 "memory" 或 "text" 字段）
- 字符串列表
- 包含 "results" 字段的字典

**修复**：在 `search_memories` 方法中添加了统一的格式处理逻辑：

```python
# 处理不同返回格式
if isinstance(results, dict):
    if "results" in results:
        results = results["results"]
    # ... 处理单个字典格式

# 处理列表格式
for item in results:
    if isinstance(item, dict):
        memory_text = item.get("memory") or item.get("text") or item.get("content") or str(item)
        score = item.get("score") or item.get("distance") or item.get("similarity") or 0.0
        formatted_results.append({"memory": memory_text, "score": float(score)})
    # ... 处理其他格式
```

### 2. 实现对话隔离功能

**方案**：使用 `{user_id}:{conversation_id}` 作为 mem0 的 `user_id`，确保每个对话有独立的记忆空间。

**修改的方法**：

1. **`search_memories`**：
   - 新增 `conversation_id` 参数
   - 使用 `memory_user_id = f"{user_id}:{conversation_id}"` 作为 mem0 的 user_id

2. **`add_memory`**：
   - 新增 `conversation_id` 参数
   - 使用 `memory_user_id = f"{user_id}:{conversation_id}"` 作为 mem0 的 user_id
   - 在 metadata 中添加 `conversation_id` 字段

3. **`extract_and_store`**：
   - 新增 `conversation_id` 参数
   - 使用 `memory_user_id = f"{user_id}:{conversation_id}"` 作为 mem0 的 user_id
   - **修复**：使用 `add` 方法而不是不存在的 `extract` 方法
   - `add` 方法在 `infer=True`（默认）时会自动使用 LLM 提取关键事实

### 3. 修复 extract_and_store 方法

**问题**：mem0 的 `Memory` 对象没有 `extract` 方法

**修复**：使用 `add` 方法代替 `extract` 方法：
- `add` 方法可以接受 `messages` 参数（字符串、字典或字典列表）
- 当 `infer=True`（默认）时，会自动使用 LLM 提取关键事实并决定是添加、更新还是删除相关记忆
- 返回格式：`{"results": [{"id": "...", "memory": "...", "event": "ADD"}]}`

```python
# 修复后的实现
result = self.memory.add(
    messages=conversation_history,
    user_id=memory_user_id,
    metadata=metadata if metadata else None,
    infer=True  # 使用 LLM 自动提取记忆
)
```

### 4. 更新调用代码

在 `src/server/main/chat/utils.py` 中更新了所有 mem0 调用：

```python
# 搜索记忆时传入 conversation_id
long_term_memories = await mem0_client.search_memories(
    user_id, user_message, limit=5, conversation_id=conversation_id
)

# 提取记忆时传入 conversation_id
await mem0_client.extract_and_store(
    user_id, conversation_for_memory, conversation_id=conversation_id
)
```

## 验证测试

运行 `test_mem0_conversation.py` 验证：

```bash
cd src/server
.venv\Scripts\python.exe test_mem0_conversation.py
```

**测试结果**：
- ✅ 对话 1 的记忆：只包含 Python/FastAPI 相关记忆
- ✅ 对话 2 的记忆：只包含 React/TypeScript 相关记忆
- ✅ 对话隔离成功：每个对话有独立的记忆空间
- ✅ `extract_and_store` 方法正常工作：成功从对话中提取并存储记忆

## 工作原理

1. **记忆存储**：当添加记忆时，使用 `{user_id}:{conversation_id}` 作为 mem0 的 user_id
   - 例如：`"default-user:conv-001"` 和 `"default-user:conv-002"` 是两个不同的用户空间

2. **记忆检索**：搜索时使用相同的 `{user_id}:{conversation_id}` 格式
   - 只会检索到该对话窗口的记忆，不会检索到其他对话的记忆

3. **记忆提取**：从对话历史中提取记忆时，也会使用 `conversation_id` 隔离

## 注意事项

1. **向后兼容**：如果 `conversation_id` 为 `None`，则使用原来的 `user_id`，保持向后兼容
2. **记忆格式**：所有返回的记忆都统一为 `{"memory": str, "score": float}` 格式
3. **错误处理**：所有方法都包含完善的错误处理和日志记录

## 相关文件

- `src/server/main/memory/mem0_client.py` - mem0 客户端封装
- `src/server/main/chat/utils.py` - 聊天工具函数
- `src/server/test_mem0_conversation.py` - 对话隔离测试脚本

