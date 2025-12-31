# Simple Chat Bot

A minimal AI chat assistant with conversation and memory capabilities, similar to Doubao web interface.

## Features

- ✅ **Pure Chat** - Stream-based conversation
- ✅ **Short-term Memory** - Last 5 rounds of conversation (10 messages)
- ✅ **Long-term Memory** - mem0 integration for persistent memory
- ✅ **Beautiful UI** - Clean, centered interface like Doubao
- ❌ **No Authentication** - Open access, no login required

## Tech Stack

- **Backend**: FastAPI + MongoDB + mem0 + qwen-agent
- **Frontend**: Next.js + React + Tailwind CSS
- **LLM**: Configurable via `.env` (OpenAI-compatible API)

## Quick Start

### 1. Install Dependencies

**Backend:**
```powershell
cd src\server
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

**Frontend:**
```powershell
cd src\client
npm install
```

### 2. Configure Environment

Create `src/server/.env`:
```env
# Server
APP_SERVER_PORT=5000

# Database
MONGO_URI=mongodb://localhost:27017/chatbot_db
MONGO_DB_NAME=chatbot_db

# LLM Configuration
OPENAI_API_BASE_URL=https://llmapi.paratera.com/v1
OPENAI_MODEL_NAME=DeepSeek-V3.2
OPENAI_API_KEY=sk-your-api-key-here
```

Create `src/client/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

### 3. Start Services

**Option 1: Use startup script**
```powershell
.\start_simple.ps1
```

**Option 2: Manual start**

Terminal 1 - Backend:
```powershell
cd src\server
.\.venv\Scripts\activate
python -m main.app
```

Terminal 2 - Frontend:
```powershell
cd src\client
npm run dev
```

### 4. Access

- Frontend: http://localhost:3000
- API Docs: http://localhost:5000/docs

## Project Structure

```
src/
├── server/main/
│   ├── app.py              # FastAPI app (no auth)
│   ├── config.py           # Configuration
│   ├── db.py               # MongoDB (fixed user ID)
│   ├── llm.py              # LLM calls
│   ├── chat/
│   │   ├── routes.py        # Chat routes (no auth)
│   │   └── utils.py         # Chat logic with memory
│   └── memory/
│       └── mem0_client.py   # mem0 client (optional)
└── client/
    ├── app/
    │   ├── layout.js        # Simple layout
    │   └── page.js          # Chat page (Doubao-style)
    └── components/ui/
        └── InteractiveNetworkBackground.js
```

## Memory System

### Short-term Memory
- Automatically maintains last 5 rounds (10 messages)
- Stored in MongoDB
- Loaded automatically on each conversation

### Long-term Memory (Optional)
- Uses mem0 library for persistent memory
- Automatically extracts and stores important facts
- Requires: `pip install mem0ai`
- If not installed, app still works but without long-term memory

## API Endpoints

- `POST /api/chat/message` - Send chat message (streaming)
- `GET /api/chat/history` - Get chat history
- `POST /api/chat/delete` - Delete messages

All endpoints are public (no authentication required).

## Notes

- MongoDB must be running
- LLM API key must be configured in `.env`
- mem0ai is optional - app works without it
- All users share the same conversation history (single user mode)
