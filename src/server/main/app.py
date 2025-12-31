"""
极简FastAPI应用 - 只包含聊天功能
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from bson import ObjectId
from fastapi.encoders import ENCODERS_BY_TYPE

from main.config import APP_SERVER_PORT
from main.db import mongo_manager
from main.chat.routes import router as chat_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 添加ObjectId编码器
ENCODERS_BY_TYPE[ObjectId] = str

@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    """应用生命周期管理"""
    logger.info("App startup...")
    await mongo_manager.initialize_db()
    logger.info("App startup complete.")
    yield
    logger.info("App shutdown sequence initiated...")
    if mongo_manager and mongo_manager.client:
        mongo_manager.client.close()
    logger.info("App shutdown complete.")

app = FastAPI(
    title="Simple Chat Bot",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 开发环境允许所有来源
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(chat_router)

@app.get("/", tags=["General"])
async def root():
    return {"message": "Simple Chat Bot API"}

@app.get("/health", tags=["General"])
async def health():
    return {
        "status": "healthy",
        "database": "connected" if mongo_manager.client else "disconnected"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main.app:app",
        host="127.0.0.1",
        port=APP_SERVER_PORT,
        reload=False,
        workers=1
    )

