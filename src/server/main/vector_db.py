import os
import chromadb
import logging
from chromadb.utils.embedding_functions import GoogleGenerativeAiEmbeddingFunction, OpenAIEmbeddingFunction
from dotenv import load_dotenv


ENVIRONMENT = os.getenv('ENVIRONMENT', 'dev-local')
logging.info(f"[Config] Initializing configuration for ENVIRONMENT='{ENVIRONMENT}'")
server_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

if ENVIRONMENT == 'dev-local':
    # Prefer .env.local, fall back to .env
    dotenv_local_path = os.path.join(server_root, '.env.local')
    dotenv_path = os.path.join(server_root, '.env')
    load_path = dotenv_local_path if os.path.exists(dotenv_local_path) else dotenv_path
    if os.path.exists(load_path):
        load_dotenv(dotenv_path=load_path)
elif ENVIRONMENT == 'selfhost':
    dotenv_path = os.path.join(server_root, '.env.selfhost')
    load_dotenv(dotenv_path=dotenv_path)

# --- Configuration ---
CHROMA_HOST = os.getenv("CHROMA_HOST", "localhost")
CHROMA_PORT = int(os.getenv("CHROMA_PORT", 8002))
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "models/gemini-embedding-001")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
# OpenAI兼容配置（用于GLM-Embedding-3等）
OPENAI_API_BASE_URL = os.getenv("OPENAI_API_BASE_URL")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
# 使用OpenAI兼容API还是Gemini API
USE_OPENAI_COMPATIBLE = os.getenv("USE_OPENAI_COMPATIBLE_EMBEDDING", "false").lower() == "true"
CONVERSATION_SUMMARIES_COLLECTION_NAME = "conversation_summaries"

logger = logging.getLogger(__name__)

# --- Singleton Client Instance ---
_client = None
_embedding_function = None

def get_chroma_client():
    """
    Initializes and returns a singleton ChromaDB HTTP client.
    """
    global _client
    if _client is None:
        try:
            logger.info(f"Initializing ChromaDB client for host={CHROMA_HOST}, port={CHROMA_PORT}")
            _client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
            # Ping the server to ensure it's alive
            _client.heartbeat()
            logger.info("ChromaDB client connected successfully.")
        except Exception as e:
            logger.error(f"Failed to connect to ChromaDB at {CHROMA_HOST}:{CHROMA_PORT}: {e}", exc_info=True)
            _client = None  # Reset on failure
            raise ConnectionError("Could not connect to ChromaDB service.") from e
    return _client

def get_embedding_function():
    """
    Initializes and returns a singleton embedding function.
    Supports both OpenAI-compatible APIs (like GLM-Embedding-3) and Google Gemini API.
    """
    global _embedding_function
    if _embedding_function is None:
        if USE_OPENAI_COMPATIBLE:
            # Use OpenAI-compatible API (e.g., GLM-Embedding-3)
            if not OPENAI_API_KEY:
                logger.error("OPENAI_API_KEY is not set. Cannot initialize OpenAI-compatible embedding function.")
                raise ValueError("OPENAI_API_KEY is not configured.")
            if not OPENAI_API_BASE_URL:
                logger.error("OPENAI_API_BASE_URL is not set. Cannot initialize OpenAI-compatible embedding function.")
                raise ValueError("OPENAI_API_BASE_URL is not configured.")
            
            logger.info(f"Initializing OpenAI-compatible embedding model: {EMBEDDING_MODEL_NAME} at {OPENAI_API_BASE_URL}")
            try:
                _embedding_function = OpenAIEmbeddingFunction(
                    api_key=OPENAI_API_KEY,
                    model_name=EMBEDDING_MODEL_NAME,
                    api_base=OPENAI_API_BASE_URL
                )
                logger.info("OpenAI-compatible embedding model loaded.")
            except Exception as e:
                logger.error(f"Failed to initialize OpenAIEmbeddingFunction: {e}", exc_info=True)
                _embedding_function = None
                raise
        else:
            # Use Google Gemini API (default)
            if not GEMINI_API_KEY:
                logger.error("GEMINI_API_KEY is not set. Cannot initialize Google embedding function.")
                raise ValueError("GEMINI_API_KEY is not configured.")
            
            logger.info(f"Initializing Google Generative AI embedding model: {EMBEDDING_MODEL_NAME}")
            try:
                _embedding_function = GoogleGenerativeAiEmbeddingFunction(
                    api_key=GEMINI_API_KEY,
                    model_name=EMBEDDING_MODEL_NAME
                    # The default task_type is RETRIEVAL_DOCUMENT, which is appropriate for storing summaries.
                )
                logger.info("Google Generative AI embedding model loaded.")
            except Exception as e:
                logger.error(f"Failed to initialize GoogleGenerativeAiEmbeddingFunction: {e}", exc_info=True)
                _embedding_function = None
                raise
    return _embedding_function

def get_conversation_summaries_collection():
    """
    Gets or creates the collection for storing conversation summaries.
    """
    client = get_chroma_client()
    embedding_function = get_embedding_function()
    
    collection = client.get_or_create_collection(
        name=CONVERSATION_SUMMARIES_COLLECTION_NAME,
        embedding_function=embedding_function,
        metadata={"hnsw:space": "cosine"} # Use cosine distance for similarity
    )
    return collection