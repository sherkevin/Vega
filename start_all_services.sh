#!/bin/bash
#
# ==============================================================================
# start_all_services.sh
# ==============================================================================
#
# SYNOPSIS:
#   Starts all backend services, workers, and the frontend client for the
#   Sentient project on a Linux environment.
#
# DESCRIPTION:
#   This script automates the startup of all necessary services for local
#   development. It launches each service in its own dedicated terminal window
#   with a clear title.
#
# NOTES:
#   - Run this script from the project's root directory.
#   - You might need to install 'gnome-terminal' or change the TERMINAL_CMD
#     variable below to your preferred terminal emulator (e.g., konsole, xterm, terminator).
#   - Ensure services like MongoDB, Redis, and Docker are installed and enabled.
#   - This script may require 'sudo' for starting system services.
#
# ==============================================================================

# --- Configuration ---
# Select your preferred terminal emulator to launch services.
# If you encounter "symbol lookup error" with gnome-terminal (a common issue with Snap),
# try changing this to a different terminal you have installed.
#
# Examples:
# TERMINAL_CMD="xterm -e"
# TERMINAL_CMD="konsole -e"
# This command forces a new window for each service, which is ideal for Alt+Tabbing.
TERMINAL_CMD="gnome-terminal --window --"
# If the above still fails due to Snap issues, a great alternative is Terminator:
# TERMINAL_CMD="terminator -e"

# --- Script Body ---
# Exit immediately if a command exits with a non-zero status.
set -e

# --- Helper Functions ---
function check_command() {
    if ! command -v $1 &> /dev/null
    then
        echo "Error: Command '$1' could not be found. Please install it to continue."
        exit 1
    fi
}

function start_in_new_terminal() {
    local title="$1"
    local command="$2"
    printf "🚀 Launching %s...\n" "$title"
    # CRITICAL FIX: Unset LD_LIBRARY_PATH to prevent conflicts with Snap-based terminals.
    # This allows gnome-terminal (as a Snap) to launch correctly from the script's environment.
    # The rest of the command sets the window title and keeps it open after execution.
    unset LD_LIBRARY_PATH && \
    $TERMINAL_CMD /bin/bash -c "echo -ne '\033]0;${title}\a'; ${command}; exec bash" &
    sleep 0.5
}

# --- Pre-run Checks ---
echo "--- Performing Pre-run Checks ---"
check_command systemctl
# redis-cli is optional - we can use Python redis client as fallback
if ! command -v redis-cli &> /dev/null; then
    echo "⚠️  Warning: redis-cli not found. Will use Python redis client for Redis operations."
    REDIS_CLI_AVAILABLE=false
else
    REDIS_CLI_AVAILABLE=true
fi
check_command npm
# Docker is optional - check if it's available and working
DOCKER_AVAILABLE=false
if command -v docker > /dev/null 2>&1; then
    if docker ps > /dev/null 2>&1; then
        DOCKER_AVAILABLE=true
        echo "✅ Docker is available and working."
    else
        echo "⚠️  Warning: Docker command found but not accessible in WSL."
        echo "   Please enable WSL integration in Docker Desktop settings:"
        echo "   1. Open Docker Desktop"
        echo "   2. Go to Settings > Resources > WSL Integration"
        echo "   3. Enable integration for your WSL distro: $(wsl.exe -l -v 2>/dev/null | grep -i default | awk '{print $1}' || echo 'your-distro')"
        echo "   4. Restart Docker Desktop"
    fi
else
    echo "⚠️  Warning: Docker not found. Some services may not start."
fi

# --- Path and Environment Setup ---
echo "--- Setting up Environment ---"
PROJECT_ROOT=$(pwd)
SRC_PATH="$PROJECT_ROOT/src"
SERVER_PATH="$SRC_PATH/server"
CLIENT_PATH="$SRC_PATH/client"
MCP_HUB_PATH="$SERVER_PATH/mcp_hub"
# Use .venv in project root (preferred) or fallback to src/server/venv
if [ -f "$PROJECT_ROOT/.venv/bin/activate" ]; then
    VENV_ACTIVATE_PATH="$PROJECT_ROOT/.venv/bin/activate"
elif [ -f "$SERVER_PATH/venv/bin/activate" ]; then
    VENV_ACTIVATE_PATH="$SERVER_PATH/venv/bin/activate"
else
    echo "Error: Python virtual environment not found."
    echo "Expected locations:"
    echo "  - $PROJECT_ROOT/.venv/bin/activate (preferred)"
    echo "  - $SERVER_PATH/venv/bin/activate"
    echo "Please create it first (e.g., uv venv or python -m venv .venv)."
    exit 1
fi
ENV_FILE="$SERVER_PATH/.env"

if [ ! -d "$SRC_PATH" ] || [ ! -d "$SERVER_PATH" ] || [ ! -d "$CLIENT_PATH" ]; then
    echo "Error: Critical directories (src, src/server, src/client) not found."
    echo "Please ensure you are running this script from the project's root directory."
    exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
    echo "Error: .env file not found at '$ENV_FILE'. Please copy from .env.template."
    exit 1
fi

# Extract Redis password from .env file
REDIS_PASSWORD=$(grep -E "^\s*REDIS_PASSWORD\s*=" "$ENV_FILE" | cut -d '=' -f 2- | tr -d '"\r' | sed 's/^ *//;s/ *$//')
if [ -z "$REDIS_PASSWORD" ]; then
    echo "Error: Could not find REDIS_PASSWORD in '$ENV_FILE'."
    exit 1
fi
echo "✅ Redis password loaded from .env file."

# --- 1. Start Databases & Core Infrastructure ---
echo -e "\n--- 1. Starting Databases & Core Infrastructure ---"

# Check if systemd is available (not available in WSL by default)
SYSTEMD_AVAILABLE=false
if systemctl is-system-running > /dev/null 2>&1; then
    SYSTEMD_AVAILABLE=true
fi

# Start MongoDB Service
echo "🚀 Starting MongoDB Service..."
if pgrep -x "mongod" > /dev/null; then
    echo "✅ MongoDB is already running (process)."
elif [ "$DOCKER_AVAILABLE" = true ] && docker ps --format '{{.Names}}' | grep -q "^mongodb$"; then
    echo "✅ MongoDB container is already running."
elif [ "$SYSTEMD_AVAILABLE" = true ]; then
    # Use systemctl if available
    sudo systemctl start mongod || echo "⚠️  MongoDB service was already running or failed to start. Check with: sudo systemctl status mongod"
elif [ "$DOCKER_AVAILABLE" = true ]; then
    # Try Docker if available
    echo "Starting MongoDB with Docker..."
    if docker run -d --name mongodb -p 27017:27017 --restart unless-stopped mongo:latest 2>/dev/null; then
        echo "✅ MongoDB started in Docker."
        sleep 2
    else
        # Container might already exist, try to start it
        docker start mongodb 2>/dev/null && echo "✅ MongoDB container started." || echo "⚠️  Failed to start MongoDB. Please check Docker."
    fi
elif command -v mongod > /dev/null; then
    echo "⚠️  MongoDB not running. Please start it manually:"
    echo "   mongod --dbpath /path/to/data --fork --logpath /path/to/mongod.log"
else
    echo "⚠️  MongoDB not found and Docker is not available."
    echo "   Options:"
    echo "   1. Enable Docker Desktop WSL integration (recommended)"
    echo "   2. Install MongoDB manually: sudo apt-get install mongodb"
fi
sleep 1

# Start Redis Server
echo "🚀 Starting Redis Server..."
if pgrep -x "redis-server" > /dev/null; then
    echo "✅ Redis is already running (process)."
elif [ "$DOCKER_AVAILABLE" = true ] && docker ps --format '{{.Names}}' | grep -q "^redis$"; then
    echo "✅ Redis container is already running."
elif [ "$SYSTEMD_AVAILABLE" = true ]; then
    # Use systemctl if available
    sudo systemctl start redis-server || echo "⚠️  Failed to start Redis via systemctl."
    sleep 1
    if pgrep -x "redis-server" > /dev/null; then
        echo "✅ Redis service started."
    else
        echo "⚠️  Failed to start Redis via systemctl."
    fi
elif [ "$DOCKER_AVAILABLE" = true ]; then
    # Try Docker if available
    echo "Starting Redis with Docker..."
    if docker run -d --name redis -p 6379:6379 --restart unless-stopped redis:7-alpine redis-server --requirepass "$REDIS_PASSWORD" 2>/dev/null; then
        echo "✅ Redis started in Docker."
        sleep 2
    else
        # Container might already exist, try to start it
        docker start redis 2>/dev/null && echo "✅ Redis container started." || echo "⚠️  Failed to start Redis. Please check Docker."
    fi
elif command -v redis-server > /dev/null; then
    # WSL or non-systemd environment - try to start manually
    echo "Starting Redis manually..."
    redis-server --bind 0.0.0.0 --requirepass "$REDIS_PASSWORD" --daemonize yes 2>/dev/null
    sleep 2
    if pgrep -x "redis-server" > /dev/null; then
        echo "✅ Redis started successfully."
    else
        echo "⚠️  Failed to start Redis. Please start it manually:"
        echo "   redis-server --bind 0.0.0.0 --requirepass '$REDIS_PASSWORD' --daemonize yes"
    fi
else
    echo "⚠️  Redis not found and Docker is not available."
    echo "   Options:"
    echo "   1. Enable Docker Desktop WSL integration (recommended)"
    echo "   2. Install Redis manually: sudo apt-get install redis-server"
fi
sleep 1

# Start Docker Containers
if [ "$DOCKER_AVAILABLE" = true ]; then
    echo "🚀 Starting Docker services (Waha, PGVector, Chroma, LiteLLM)..."
    DOCKER_SERVICES=(
        # "WAHA:start_waha.yaml"
        "PGVector:start_pgvector.yaml"
        "ChromaDB:start_chroma.yaml"
        "LiteLLM:start_litellm.yaml"
    )

    for service_info in "${DOCKER_SERVICES[@]}"; do
        IFS=':' read -r name file <<< "$service_info"
        COMPOSE_FILE="$PROJECT_ROOT/$file"

        if [ -f "$COMPOSE_FILE" ]; then
            echo "   - Starting $name from $file..."
            if docker compose -f "$COMPOSE_FILE" up -d; then
                echo "   - ✅ $name started successfully."
            else
                echo "   - ⚠️  Failed to start $name. Check Docker output above."
            fi
        else
            echo "⚠️  - Docker compose file not found: '$file'. Skipping."
        fi
    done
    echo "Waiting a few seconds for Docker containers to initialize..."
    sleep 5
else
    echo "⚠️  Skipping Docker services (Docker not available)."
    echo "   To use Docker services, please:"
    echo "   1. Install Docker Desktop for Windows"
    echo "   2. Enable WSL integration in Docker Desktop settings"
    echo "   3. Restart Docker Desktop and this WSL session"
fi

# --- 2. Resetting Queues & State ---
echo -e "\n--- 2. Resetting Queues & State ---"
echo "🚀 Flushing Redis database (Celery Queue)..."
if [ "$REDIS_CLI_AVAILABLE" = true ]; then
    # Use redis-cli if available
    export REDISCLI_AUTH="$REDIS_PASSWORD"
    if ! redis-cli PING | grep -q "PONG"; then
        echo "❌ Error: Failed to authenticate with Redis. Please check your REDIS_PASSWORD in the .env file."
        unset REDISCLI_AUTH
        exit 1
    fi
    redis-cli FLUSHALL
    unset REDISCLI_AUTH # Unset for security
    echo "✅ Redis flushed."
else
    # Use Python redis client as fallback
    echo "Using Python redis client (redis-cli not available)..."
    # Try to use venv if available
    PYTHON_CMD="python3"
    if [ -f "$VENV_ACTIVATE_PATH" ]; then
        source "$VENV_ACTIVATE_PATH"
        PYTHON_CMD="python"
    fi
    
    $PYTHON_CMD << EOF
import sys
try:
    import redis
except ImportError:
    print("❌ Error: redis Python module not found.")
    print("Please install it: pip install redis")
    sys.exit(1)

import os
from dotenv import load_dotenv

# Load .env file
env_path = os.path.join('$SERVER_PATH', '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)

redis_password = os.getenv('REDIS_PASSWORD', '$REDIS_PASSWORD')
try:
    r = redis.Redis(host='localhost', port=6379, password=redis_password, decode_responses=True)
    r.ping()
    r.flushall()
    print("✅ Redis flushed.")
except redis.ConnectionError:
    print("❌ Error: Failed to connect to Redis. Please ensure Redis is running.")
    sys.exit(1)
except redis.AuthenticationError:
    print("❌ Error: Failed to authenticate with Redis. Please check your REDIS_PASSWORD in the .env file.")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
EOF
    if [ $? -ne 0 ]; then
        echo "⚠️  Warning: Failed to flush Redis using Python client."
        echo "You can manually flush Redis later or install redis-cli: sudo apt-get install redis-tools"
    fi
fi

# --- 3. Start MCP Servers ---
echo -e "\n--- 3. Starting All MCP Servers ---"

if [ ! -d "$MCP_HUB_PATH" ]; then
    echo "Error: MCP Hub directory not found at '$MCP_HUB_PATH'."
    exit 1
fi

MCP_SERVERS=$(find "$MCP_HUB_PATH" -mindepth 1 -maxdepth 1 -type d -exec basename {} \;)
echo "Found the following MCP servers to start:"
echo "$MCP_SERVERS" | sed 's/^/ - /'
echo ""

for server_name in $MCP_SERVERS; do
    window_title="MCP - ${server_name^^}" # Uppercase title
    python_module="mcp_hub.$server_name.main"
    command_to_run="source '$VENV_ACTIVATE_PATH' && cd '$SERVER_PATH' && python -m '$python_module'"
    start_in_new_terminal "$window_title" "$command_to_run"
done

# --- 4. Start Backend Workers ---
echo -e "\n--- 4. Starting Backend Workers ---"

worker_command="source '$VENV_ACTIVATE_PATH' && cd '$SERVER_PATH' && celery -A workers.celery_app worker --loglevel=info --pool=solo"
start_in_new_terminal "WORKER - Celery Worker" "$worker_command"

beat_command="source '$VENV_ACTIVATE_PATH' && cd '$SERVER_PATH' && celery -A workers.celery_app beat --loglevel=info"
start_in_new_terminal "WORKER - Celery Beat" "$beat_command"

# --- 5. Start Main API Server and Frontend Client ---
echo -e "\n--- 5. Starting Main API and Client ---"

main_api_command="source '$VENV_ACTIVATE_PATH' && cd '$SERVER_PATH' && python -m main.app"
start_in_new_terminal "API - Main Server" "$main_api_command"

client_command="cd '$CLIENT_PATH' && npm run dev"
start_in_new_terminal "CLIENT - Next.js" "$client_command"

# --- 6. Final Message ---
echo -e "\n✅ All services have been launched successfully in new terminal windows."
echo "You can switch between them using your desktop environment's window management (e.g., Alt+Tab)."