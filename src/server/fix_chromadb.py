"""
修复 ChromaDB HTTP-only 模式问题的脚本
在导入任何其他模块之前运行此脚本
"""
import os
import sys

# 必须在导入 chromadb 之前设置这些环境变量
os.environ["CHROMA_DB_IMPL"] = "duckdb+parquet"
os.environ["IS_PERSISTENT"] = "TRUE"
os.environ["CHROMA_API_IMPL"] = "chromadb.api.rust.RustBindingsAPI"

# 移除可能强制 HTTP 模式的环境变量
for key in list(os.environ.keys()):
    if "CHROMA" in key.upper() and ("HTTP" in key.upper() or "SERVER" in key.upper()):
        if key not in ["CHROMA_DB_IMPL", "IS_PERSISTENT", "CHROMA_API_IMPL"]:
            del os.environ[key]

# 现在导入 chromadb 并测试
try:
    import chromadb
    client = chromadb.PersistentClient(path="./test_chroma_fix")
    print("SUCCESS: ChromaDB PersistentClient created successfully!")
    print(f"ChromaDB version: {chromadb.__version__}")
    import shutil
    shutil.rmtree("./test_chroma_fix", ignore_errors=True)
    sys.exit(0)
except Exception as e:
    print(f"FAILED: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

