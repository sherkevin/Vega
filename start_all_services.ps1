# Place this script in the root of your project (e.g., D:\Documents\cyber\projects\Sentient-New\Code)

<#
.SYNOPSIS
    Starts all backend services, workers, and the frontend client for the Sentient project.

.DESCRIPTION
    This script automates the startup of all necessary services for local development.
    It launches each service in its own dedicated PowerShell terminal window with a clear title.

    The script handles:
    - Starting databases like MongoDB (as admin) and Docker services (Waha, PGVector, Chroma, LiteLLM).
    - Launching the Redis message broker within the Windows Subsystem for Linux (WSL).
    - Dynamically discovering and starting all MCP (Modular Companion Protocol) servers.
    - Activating the Python virtual environment for all backend scripts.
    - Running the Celery worker and beat scheduler for background tasks.
    - Starting the main FastAPI server and the Next.js frontend client.

.NOTES
    - Run this script from your project's root directory.
    - Requires Docker Desktop to be installed and running.
    - You may need to adjust your PowerShell execution policy to run this script.
      Open PowerShell as an Administrator and run:
      Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
#>

# --- Parameters ---
# Run mode: "windows" (separate windows) or "single" (single terminal with logs)
param(
    [string]$Mode = "windows"  # "windows" or "single"
)

# --- Configuration ---
# Please review and update these paths to match your local setup.

# The name of your WSL distribution where Redis is installed.
$wslDistroName = "Ubuntu"

# Virtual environment location - UNIFIED: Always use src/server/.venv
$VENV_LOCATION = "src\server\.venv"

# --- Script Body ---
try {
    # Prerequisite check
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw "Docker command not found. Please install Docker Desktop and ensure it is running."
    }
    
    # Check if Docker is actually running
    try {
        docker ps | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Docker command found but Docker Desktop is not running."
            Write-Warning "Please start Docker Desktop and wait for it to fully initialize, then try again."
            Write-Host "`nPress any key to continue anyway (services may fail to start)..." -ForegroundColor Yellow
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        }
    }
    catch {
        Write-Warning "Cannot connect to Docker. Please ensure Docker Desktop is running."
        Write-Host "`nPress any key to continue anyway (services may fail to start)..." -ForegroundColor Yellow
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }

    # Get the directory where the script is located (your project root)
    $projectRoot = $PSScriptRoot
    if (-not $projectRoot) { $projectRoot = Get-Location }

    # Define key paths
    $srcPath = Join-Path -Path $projectRoot -ChildPath "src"
    $serverPath = Join-Path -Path $srcPath -ChildPath "server"
    $clientPath = Join-Path -Path $srcPath -ChildPath "client"
    $mcpHubPath = Join-Path -Path $serverPath -ChildPath "mcp_hub"
    
    # --- Path Validation ---
    if (-not (Test-Path -Path $srcPath)) { throw "The 'src' directory was not found. Please run this script from the project root." }
    if (-not (Test-Path -Path $serverPath)) { throw "The 'src/server' directory was not found." }
    if (-not (Test-Path -Path $clientPath)) { throw "The 'src/client' directory was not found." }
    if (-not (Test-Path -Path $mcpHubPath)) { throw "The 'src/server/mcp_hub' directory was not found." }
    
    # --- Setup Virtual Environment (UNIFIED LOCATION: src/server/.venv) ---
    $useUv = $false
    $venvPath = Join-Path -Path $projectRoot -ChildPath $VENV_LOCATION
    $venvActivatePath = Join-Path -Path $venvPath -ChildPath "Scripts\activate.ps1"
    
    # Check if uv is available
    if (Get-Command uv -ErrorAction SilentlyContinue) {
        $useUv = $true
        Write-Host "✅ Found uv, will use uv for virtual environment management." -ForegroundColor Green
        
        # Create virtual environment if it doesn't exist (always in src/server/.venv)
        if (-not (Test-Path -Path $venvActivatePath)) {
            Write-Host "📦 Creating virtual environment at: $venvPath" -ForegroundColor Yellow
            Push-Location $serverPath
            try {
                uv venv .venv
                if (-not (Test-Path -Path $venvActivatePath)) {
                    throw "Failed to create virtual environment with uv at '$venvPath'."
                }
                Write-Host "✅ Virtual environment created successfully." -ForegroundColor Green
            }
            finally {
                Pop-Location
            }
        }
        else {
            Write-Host "✅ Virtual environment found at: $venvPath" -ForegroundColor Green
        }
        
        # Always check and install dependencies if needed
        Write-Host "📥 Checking Python dependencies..." -ForegroundColor Yellow
        Push-Location $serverPath
        try {
            # Check if fastapi is installed
            $pythonExe = Join-Path $venvPath "Scripts\python.exe"
            if (-not (Test-Path $pythonExe)) {
                throw "Python executable not found at '$pythonExe'"
            }
            
            $fastapiCheck = & $pythonExe -c "import fastapi" 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-Host "   Installing main dependencies..." -ForegroundColor Gray
                uv pip install -r requirements.txt
            }
            
            if (Test-Path "workers\requirements.txt") {
                $celeryCheck = & $pythonExe -c "import celery" 2>&1
                if ($LASTEXITCODE -ne 0) {
                    Write-Host "   Installing workers dependencies..." -ForegroundColor Gray
                    uv pip install -r workers\requirements.txt
                }
            }
            
            Write-Host "✅ Dependencies check completed." -ForegroundColor Green
        }
        catch {
            Write-Warning "Dependency check failed: $_"
            Write-Host "   Attempting to install all dependencies..." -ForegroundColor Yellow
            uv pip install -r requirements.txt
            if (Test-Path "workers\requirements.txt") {
                uv pip install -r workers\requirements.txt
            }
        }
        finally {
            Pop-Location
        }
    }
    else {
        Write-Host "⚠️  uv not found, falling back to traditional venv." -ForegroundColor Yellow
        # Fallback: Check for traditional venv in same location
        $venvPath = Join-Path -Path $serverPath -ChildPath "venv"
        $venvActivatePath = Join-Path -Path $venvPath -ChildPath "Scripts\activate.ps1"
        if (-not (Test-Path -Path $venvActivatePath)) {
            throw "Virtual environment not found at '$venvActivatePath'. Please create it first (e.g., cd src\server; python -m venv .venv) or install uv (pip install uv)."
        }
    }
    
    Write-Host "✅ Using virtual environment at: $venvPath" -ForegroundColor Green
    Write-Host "   Activation script: $venvActivatePath" -ForegroundColor Gray
    
    # Check Node.js dependencies
    Write-Host "📥 Checking Node.js dependencies..." -ForegroundColor Yellow
    $nodeModulesPath = Join-Path $clientPath "node_modules"
    $nextBinPath = Join-Path $nodeModulesPath ".bin\next.cmd"
    
    if (-not (Test-Path $nodeModulesPath) -or -not (Test-Path $nextBinPath)) {
        Write-Host "   Installing Node.js dependencies..." -ForegroundColor Gray
        Push-Location $clientPath
        try {
            $npmOutput = npm install 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-Warning "npm install failed. Output: $npmOutput"
                throw "Failed to install Node.js dependencies"
            }
            Write-Host "✅ Node.js dependencies installed." -ForegroundColor Green
        }
        catch {
            Write-Warning "Failed to install Node.js dependencies: $_"
            Write-Host "   Please run manually: cd src\client && npm install" -ForegroundColor Yellow
        }
        finally {
            Pop-Location
        }
    }
    else {
        Write-Host "✅ Node.js dependencies found." -ForegroundColor Green
    }

    # Check and validate .env file
    $envFilePath = Join-Path -Path $serverPath -ChildPath ".env"
    $redisPassword = ""
    $missingVars = @()
    
    if (Test-Path $envFilePath) {
        $envContent = Get-Content $envFilePath
        $passwordLine = $envContent | Select-String -Pattern "^\s*REDIS_PASSWORD\s*=\s*(.+)"
        if ($passwordLine) {
            $redisPassword = $passwordLine.Matches[0].Groups[1].Value.Trim()
        }
        
        # Check for required Celery variables
        $celeryBroker = $envContent | Select-String -Pattern "^\s*CELERY_BROKER_URL\s*="
        $celeryBackend = $envContent | Select-String -Pattern "^\s*CELERY_RESULT_BACKEND\s*="
        
        if (-not $celeryBroker) { $missingVars += "CELERY_BROKER_URL" }
        if (-not $celeryBackend) { $missingVars += "CELERY_RESULT_BACKEND" }
    }
    else {
        Write-Warning ".env file not found at '$envFilePath'"
        $missingVars += "REDIS_PASSWORD", "CELERY_BROKER_URL", "CELERY_RESULT_BACKEND"
    }
    
    if (-not $redisPassword) {
        Write-Warning "REDIS_PASSWORD not found in .env file. Using default 'redis'"
        $redisPassword = "redis"
    }
    
    if ($missingVars.Count -gt 0) {
        Write-Warning "Missing required environment variables: $($missingVars -join ', ')"
        Write-Host "   Please add these to src/server/.env file:" -ForegroundColor Yellow
        Write-Host "   REDIS_PASSWORD=your_redis_password" -ForegroundColor Gray
        Write-Host "   CELERY_BROKER_URL=redis://:your_redis_password@localhost:6379/0" -ForegroundColor Gray
        Write-Host "   CELERY_RESULT_BACKEND=redis://:your_redis_password@localhost:6379/0" -ForegroundColor Gray
        Write-Host ""
        Write-Host "   Continuing with defaults (services may fail)..." -ForegroundColor Yellow
    }

    # Create logs directory
    $logsDir = Join-Path $projectRoot "logs"
    if (-not (Test-Path $logsDir)) {
        New-Item -ItemType Directory -Path $logsDir | Out-Null
    }

    # Helper function to start a process in a new terminal window
    function Start-NewTerminal {
        param(
            [string]$WindowTitle,
            [string]$Command,
            [string]$WorkDir = $projectRoot,
            [switch]$NoExit = $true
        )
        # Using -NoExit keeps the window open to see output/errors
        $psCommand = "Set-Location -Path '$WorkDir'; `$Host.UI.RawUI.WindowTitle = '$WindowTitle'; $Command"
        $startArgs = @{
            FilePath         = "powershell.exe"
            WorkingDirectory = $WorkDir
            ArgumentList     = "-NoExit", "-Command", $psCommand
        }
        if (-not $NoExit) {
            # For fire-and-forget commands
            $startArgs.ArgumentList = "-Command", $psCommand
        }
        Start-Process @startArgs
    }

    # Helper function to start a process in background (single terminal mode)
    function Start-BackgroundService {
        param(
            [string]$ServiceName,
            [string]$Command,
            [string]$WorkDir = $projectRoot
        )
        $logFile = Join-Path $logsDir "$ServiceName.log"
        $psCommand = "Set-Location -Path '$WorkDir'; $Command *> '$logFile'"
        Start-Job -ScriptBlock {
            param($cmd, $dir)
            Set-Location $dir
            Invoke-Expression $cmd
        } -ArgumentList $psCommand, $WorkDir | Out-Null
        Write-Host "   ✅ $ServiceName started (logs: $logFile)" -ForegroundColor Green
    }


    # --- 1. Start Databases & Core Infrastructure ---
    Write-Host "`n--- 1. Starting Databases & Core Infrastructure ---" -ForegroundColor Cyan

    # Start MongoDB Service (requires admin)
    Write-Host "🚀 Launching MongoDB Service (requires admin)..." -ForegroundColor Yellow
    Start-Process powershell.exe -Verb RunAs -ArgumentList "Start-Service -Name 'MongoDB' -ErrorAction SilentlyContinue; if (`$?) { Write-Host 'MongoDB service started successfully.' -ForegroundColor Green } else { Write-Host 'MongoDB service was already running or failed to start.' -ForegroundColor Yellow }; Read-Host 'Press Enter to close this admin window.'"
    Start-Sleep -Seconds 3

    # Start Redis Server (for Celery)
    Write-Host "🚀 Launching Redis Server (in WSL)..." -ForegroundColor Yellow
    # Check if redis-server is installed in WSL
    $redisCheck = wsl -d $wslDistroName -e which redis-server 2>$null
    if (-not $redisCheck -or $redisCheck -eq "") {
        Write-Warning "Redis not found in WSL."
        Write-Host "   Please install Redis manually in WSL:" -ForegroundColor Yellow
        Write-Host "   1. Open WSL: wsl -d $wslDistroName" -ForegroundColor Gray
        Write-Host "   2. Run: sudo apt-get update && sudo apt-get install -y redis-server" -ForegroundColor Gray
        Write-Host "   3. Configure password in /etc/redis/redis.conf: requirepass $redisPassword" -ForegroundColor Gray
        Write-Host "   4. Restart Redis: sudo service redis-server restart" -ForegroundColor Gray
        Write-Host ""
        Write-Host "   Continuing without Redis (some services may fail)..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }
    else {
        # Check if Redis is already running
        $redisRunning = wsl -d $wslDistroName -e bash -c "pgrep -x redis-server > /dev/null && echo 'running' || echo 'stopped'" 2>$null
        if ($redisRunning -ne "running") {
            $redisStartCommand = "wsl -d $wslDistroName -e redis-server --bind 0.0.0.0 --requirepass `"$redisPassword`""
            if ($Mode -eq "single") {
                Start-Job -ScriptBlock { param($cmd) Invoke-Expression $cmd } -ArgumentList $redisStartCommand | Out-Null
                Write-Host "✅ Redis started in background" -ForegroundColor Green
            }
            else {
                Start-NewTerminal -WindowTitle "SERVICE - Redis" -Command $redisStartCommand
                Write-Host "✅ Redis started in new terminal" -ForegroundColor Green
            }
            Start-Sleep -Seconds 2
        }
        else {
            Write-Host "✅ Redis is already running" -ForegroundColor Green
        }
    }
    
    # Start Docker Containers (Waha, PGVector, Chroma, LiteLLM)
    Write-Host "🚀 Launching Docker services (Waha, PGVector, Chroma, LiteLLM)..." -ForegroundColor Yellow
    $dockerServices = @(
        @{ Name = "WAHA"; File = "start_waha.yaml" },
        @{ Name = "PGVector"; File = "start_pgvector.yaml" },
        @{ Name = "ChromaDB"; File = "start_chroma.yaml" },
        @{ Name = "LiteLLM"; File = "start_litellm.yaml" }
    )

    foreach ($service in $dockerServices) {
        $composeFile = Join-Path -Path $projectRoot -ChildPath $service.File
        if (Test-Path $composeFile) {
            Write-Host "   - Starting $($service.Name) from '$($service.File)'..." -ForegroundColor Gray
            docker compose -f $composeFile up -d
            if ($LASTEXITCODE -ne 0) {
                Write-Warning "   - Command to start $($service.Name) failed. Check Docker's output above."
            }
            else {
                Write-Host "   - $($service.Name) start command issued successfully." -ForegroundColor Green
            }
        }
        else {
            Write-Warning "   - Docker compose file not found: '$($service.File)'. Skipping."
        }
    }
    
    Write-Host "Waiting a few seconds for Docker containers to initialize..."
    Start-Sleep -Seconds 5


    # --- 2. Start MCP Servers ---
    Write-Host "`n--- 2. Starting All MCP Servers ---" -ForegroundColor Cyan
    $mcpServers = Get-ChildItem -Path $mcpHubPath -Directory | Select-Object -ExpandProperty Name
    if ($mcpServers.Count -eq 0) { throw "No MCP server directories found in '$mcpHubPath'." }

    Write-Host "Found the following MCP servers to start:" -ForegroundColor Green
    $mcpServers | ForEach-Object { Write-Host " - $_" }
    Write-Host ""
    
    if ($Mode -eq "single") {
        Write-Host "🚀 Launching all MCP servers in background (single terminal mode)..." -ForegroundColor Yellow
        foreach ($serverName in $mcpServers) {
            $pythonModule = "mcp_hub.$serverName.main"
            $commandToRun = "& '$venvActivatePath'; python -m '$pythonModule'"
            Start-BackgroundService -ServiceName "MCP-$serverName" -Command $commandToRun -WorkDir $serverPath
            Start-Sleep -Milliseconds 100
        }
        Write-Host "✅ All MCP servers launched in background" -ForegroundColor Green
    }
    else {
        Write-Host "🚀 Launching all MCP servers in separate windows..." -ForegroundColor Yellow
        foreach ($serverName in $mcpServers) {
            $windowTitle = "MCP - $($serverName.ToUpper())"
            $pythonModule = "mcp_hub.$serverName.main"
            $commandToRun = "& '$venvActivatePath'; python -m '$pythonModule'"
            $psCommand = "Set-Location -Path '$serverPath'; `$Host.UI.RawUI.WindowTitle = '$windowTitle'; $commandToRun"
            Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", $psCommand -WindowStyle Minimized
            Start-Sleep -Milliseconds 300
        }
        Write-Host "✅ All MCP servers launched (check taskbar for minimized windows)" -ForegroundColor Green
    }

    # --- 3. Resetting Queues & State (for clean development starts) ---
    Write-Host "`n--- 3. Resetting Queues & State ---" -ForegroundColor Cyan

    # Clear Redis (Celery queue) - Run silently without opening window
    Write-Host "🚀 Flushing Redis database (Celery Queue)..." -ForegroundColor Yellow
    try {
        # Check if redis-cli is available
        $redisCliCheck = wsl -d $wslDistroName -e which redis-cli 2>$null
        if ($redisCliCheck -and $redisCliCheck -ne "") {
            $redisFlushCommand = "wsl -d $wslDistroName -e redis-cli -a `"$redisPassword`" FLUSHALL"
            Invoke-Expression $redisFlushCommand 2>&1 | Out-Null
            Write-Host "✅ Redis flushed successfully" -ForegroundColor Green
        }
        else {
            Write-Warning "redis-cli not found in WSL, skipping flush"
        }
    }
    catch {
        Write-Warning "Failed to flush Redis: $_"
    }

    # --- 4. Start Backend Workers ---
    Write-Host "`n--- 4. Starting Backend Workers ---" -ForegroundColor Cyan
    # Always use virtual environment activation instead of uv run to avoid workspace issues
    $workerServices = @(
        @{ Name = "Celery Worker"; Command = "& '$venvActivatePath'; celery -A workers.celery_app worker --loglevel=info --pool=solo" },
        @{ Name = "Celery Beat Scheduler"; Command = "& '$venvActivatePath'; celery -A workers.celery_app beat --loglevel=info" }
    )

    foreach ($service in $workerServices) {
        $windowTitle = "WORKER - $($service.Name)"
        Write-Host "🚀 Launching $windowTitle..." -ForegroundColor Yellow
        if ($Mode -eq "single") {
            Start-BackgroundService -ServiceName $service.Name -Command $service.Command -WorkDir $serverPath
        }
        else {
            $psCommand = "Set-Location -Path '$serverPath'; `$Host.UI.RawUI.WindowTitle = '$windowTitle'; $($service.Command)"
            Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", $psCommand -WindowStyle Minimized
            Start-Sleep -Milliseconds 300
        }
    }
    if ($Mode -eq "single") {
        Write-Host "✅ Workers launched in background" -ForegroundColor Green
    }
    else {
        Write-Host "✅ Workers launched (check taskbar for minimized windows)" -ForegroundColor Green
    }

    # --- 5. Start Main API Server and Frontend Client ---
    Write-Host "`n--- 5. Starting Main API and Client ---" -ForegroundColor Cyan

    # Start Main FastAPI Server
    Write-Host "🚀 Launching Main API Server..." -ForegroundColor Yellow
    $mainApiCommand = "& '$venvActivatePath'; python -m main.app"
    if ($Mode -eq "single") {
        Start-BackgroundService -ServiceName "API-Server" -Command $mainApiCommand -WorkDir $serverPath
    }
    else {
        $apiPsCommand = "Set-Location -Path '$serverPath'; `$Host.UI.RawUI.WindowTitle = 'API - Main Server'; Write-Host 'FastAPI Server starting on http://localhost:5000' -ForegroundColor Green; Write-Host 'API Docs: http://localhost:5000/docs' -ForegroundColor Cyan; Write-Host ''; $mainApiCommand"
        Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", $apiPsCommand
    }
    Start-Sleep -Seconds 2

    # Start Next.js Client
    Write-Host "🚀 Launching Next.js Client..." -ForegroundColor Yellow
    # Use npx to ensure we use the local next installation
    $nextCommand = if (Test-Path $nextBinPath) { 
        ".\node_modules\.bin\next.cmd dev" 
    } else { 
        "npx next dev" 
    }
    
    if ($Mode -eq "single") {
        Start-BackgroundService -ServiceName "NextJS-Client" -Command $nextCommand -WorkDir $clientPath
    }
    else {
        $clientPsCommand = "Set-Location -Path '$clientPath'; `$Host.UI.RawUI.WindowTitle = 'CLIENT - Next.js'; Write-Host 'Next.js Client starting on http://localhost:3000' -ForegroundColor Green; Write-Host ''; $nextCommand"
        Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", $clientPsCommand
    }
    Start-Sleep -Seconds 2

    # --- Display Service Ports Information ---
    Write-Host ""
    Write-Host "=================================================================" -ForegroundColor Cyan
    Write-Host "                    SERVICES STARTED SUCCESSFULLY" -ForegroundColor Green
    Write-Host "=================================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
    Write-Host "  🌐 WEB FRONTEND (Open this in your browser)" -ForegroundColor Yellow -BackgroundColor DarkBlue
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "     >>>  http://localhost:3000  <<<" -ForegroundColor White -BackgroundColor Green
    Write-Host ""
    Write-Host "  This is your main web application interface." -ForegroundColor Gray
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "  🔧 BACKEND SERVICES" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  • FastAPI Server:     http://localhost:5000" -ForegroundColor White
    Write-Host "  • API Documentation:  http://localhost:5000/docs" -ForegroundColor White
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
    Write-Host "  🗄️  DATABASE SERVICES" -ForegroundColor Magenta
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "  • MongoDB:            mongodb://localhost:27017" -ForegroundColor White
    Write-Host "  • PostgreSQL:         localhost:5432" -ForegroundColor White
    Write-Host "  • Redis:              localhost:6379" -ForegroundColor White
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
    Write-Host "  🤖 AI/ML SERVICES" -ForegroundColor Blue
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
    Write-Host ""
    Write-Host "  • ChromaDB:           http://localhost:8002" -ForegroundColor White
    Write-Host "  • LiteLLM/AnythingLLM: http://localhost:4000" -ForegroundColor White
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkYellow
    Write-Host "  💬 OTHER SERVICES" -ForegroundColor DarkYellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkYellow
    Write-Host ""
    Write-Host "  • WAHA/Evolution API: http://localhost:8000" -ForegroundColor White
    Write-Host "  • MCP Servers:        26 servers running" -ForegroundColor White
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
    Write-Host "  ℹ️  INFORMATION" -ForegroundColor DarkGray
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
    Write-Host ""
    if ($Mode -eq "single") {
        Write-Host "  • All services running in background" -ForegroundColor Gray
        Write-Host "  • Logs saved to: logs/ directory" -ForegroundColor Gray
        Write-Host "  • View logs: Get-Content logs\ServiceName.log -Tail 50" -ForegroundColor Gray
        Write-Host "  • View jobs: Get-Job" -ForegroundColor Gray
        Write-Host "  • Stop all: Get-Job | Stop-Job; Get-Job | Remove-Job" -ForegroundColor Gray
    }
    else {
        Write-Host "  • Services running in separate terminal windows" -ForegroundColor Gray
        Write-Host "  • Check taskbar for minimized windows (MCP servers, Workers)" -ForegroundColor Gray
        Write-Host "  • Main windows visible: API Server, Next.js Client" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "=================================================================" -ForegroundColor Cyan
    Write-Host "  ✅ All services launched successfully!" -ForegroundColor Green
    Write-Host "=================================================================" -ForegroundColor Cyan
    Write-Host ""
}
catch {
    Write-Error "An error occurred during startup: $_"
    Read-Host "Press Enter to exit..."
}