"""
简化的配置 - 只保留必要配置
"""
import os
from dotenv import load_dotenv
import logging

# 加载.env文件
server_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
default_env_path = os.path.join(server_root, '.env')

if os.path.exists(default_env_path):
    load_dotenv(dotenv_path=default_env_path)

ENVIRONMENT = os.getenv('ENVIRONMENT', 'selfhost')
logging.info(f"[Config] Environment: {ENVIRONMENT}")

# --- Server ---
APP_SERVER_PORT = int(os.getenv("APP_SERVER_PORT", 5000))

# --- Database ---
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/sentient_db")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "sentient_db")

# --- LLM配置 ---
OPENAI_API_BASE_URL = os.getenv("OPENAI_API_BASE_URL", "https://llmapi.paratera.com/v1")
OPENAI_MODEL_NAME = os.getenv("OPENAI_MODEL_NAME", "DeepSeek-V3.2")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

if not OPENAI_API_KEY:
    logging.warning("OPENAI_API_KEY is not set. LLM functionality will not work.")

