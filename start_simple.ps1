# Simple startup script - only starts necessary services
Write-Host "=== Simple Chat Bot Startup ===" -ForegroundColor Cyan

# Function to check if port is in use
function Test-Port {
    param([int]$Port)
    $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    return $null -ne $connection
}

# Function to stop process on port
function Stop-ProcessOnPort {
    param([int]$Port, [string]$ServiceName)
    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($conn in $connections) {
        try {
            $process = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
            if ($process) {
                Write-Host "Stopping existing $ServiceName process (PID: $($process.Id))..." -ForegroundColor Yellow
                Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
                Start-Sleep -Seconds 2
            }
        } catch {
            # Ignore errors
        }
    }
}

# Check prerequisites
Write-Host "`n--- Checking Prerequisites ---" -ForegroundColor Yellow

# Check Python venv
$venvPath = "src\server\.venv"
if (-not (Test-Path $venvPath)) {
    Write-Host "[ERROR] Virtual environment not found at: $venvPath" -ForegroundColor Red
    Write-Host "Please create it first: cd src\server && python -m venv .venv" -ForegroundColor Yellow
    exit 1
}
Write-Host "[OK] Python virtual environment found" -ForegroundColor Green

# Check Node.js
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "[ERROR] Node.js not found. Please install Node.js first." -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Node.js version: $nodeVersion" -ForegroundColor Green

# Check npm
$npmVersion = npm --version 2>$null
if (-not $npmVersion) {
    Write-Host "[ERROR] npm not found. Please install npm first." -ForegroundColor Red
    exit 1
}
Write-Host "[OK] npm version: $npmVersion" -ForegroundColor Green

# Check if node_modules exists
$nodeModulesPath = "src\client\node_modules"
if (-not (Test-Path $nodeModulesPath)) {
    Write-Host "[WARNING] node_modules not found. Installing dependencies..." -ForegroundColor Yellow
    Set-Location src\client
    npm install
    Set-Location ..\..
    Write-Host "[OK] Dependencies installed" -ForegroundColor Green
}

# Stop existing services if running
Write-Host "`n--- Stopping Existing Services ---" -ForegroundColor Yellow

# Stop backend on port 5000
if (Test-Port -Port 5000) {
    Stop-ProcessOnPort -Port 5000 -ServiceName "FastAPI Server"
    Start-Sleep -Seconds 2
}

# Stop frontend on port 3000
if (Test-Port -Port 3000) {
    Stop-ProcessOnPort -Port 3000 -ServiceName "Next.js Client"
    Start-Sleep -Seconds 2
}

# Check and Start MongoDB
Write-Host "`n--- Checking MongoDB ---" -ForegroundColor Yellow

# First check if MongoDB is running in Docker
$dockerMongo = docker ps --filter "name=mongodb" --format "{{.Names}}" 2>$null
if ($dockerMongo -eq "mongodb") {
    Write-Host "[OK] MongoDB is running in Docker" -ForegroundColor Green
    $mongoService = @{ Status = "Running" }  # Mark as running
} else {
    # Check if Docker container exists but is stopped
    $dockerMongoStopped = docker ps -a --filter "name=mongodb" --format "{{.Names}}" 2>$null
    if ($dockerMongoStopped -eq "mongodb") {
        Write-Host "Found stopped MongoDB Docker container, starting it..." -ForegroundColor Yellow
        docker start mongodb 2>$null | Out-Null
        Start-Sleep -Seconds 2
        $dockerMongo = docker ps --filter "name=mongodb" --format "{{.Names}}" 2>$null
        if ($dockerMongo -eq "mongodb") {
            Write-Host "[OK] MongoDB Docker container started" -ForegroundColor Green
            $mongoService = @{ Status = "Running" }
        }
    }
}

# Try to find MongoDB service (possible service names)
if (-not $mongoService) {
    $mongoServiceNames = @("MongoDB", "MongoDB Server", "MongoDB Database Server")
    $mongoService = $null

    foreach ($serviceName in $mongoServiceNames) {
        $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
        if ($service) {
            $mongoService = $service
            Write-Host "Found MongoDB service: $serviceName" -ForegroundColor Cyan
            break
        }
    }
}

# If service found, try to start it
if ($mongoService) {
    if ($mongoService.Status -ne "Running") {
        Write-Host "Starting MongoDB service..." -ForegroundColor Yellow
        try {
            Start-Service -Name $mongoService.Name -ErrorAction Stop
            Start-Sleep -Seconds 3
            Write-Host "[OK] MongoDB service started" -ForegroundColor Green
        } catch {
            Write-Host "[ERROR] Failed to start MongoDB service: $_" -ForegroundColor Red
            Write-Host "Trying to start MongoDB manually..." -ForegroundColor Yellow
            $mongoService = $null
        }
    } else {
        Write-Host "[OK] MongoDB service is already running" -ForegroundColor Green
    }
}

# If no service or service failed, try Docker or mongod process
if (-not $mongoService -or $mongoService.Status -ne "Running") {
    # Try Docker first
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        Write-Host "Trying to start MongoDB with Docker..." -ForegroundColor Yellow
        $dockerRunning = docker ps --filter "name=mongodb" --format "{{.Names}}" 2>$null
        if ($dockerRunning -ne "mongodb") {
            # Check if container exists
            $containerExists = docker ps -a --filter "name=mongodb" --format "{{.Names}}" 2>$null
            if ($containerExists -eq "mongodb") {
                Write-Host "Starting existing MongoDB container..." -ForegroundColor Yellow
                docker start mongodb 2>$null | Out-Null
                Start-Sleep -Seconds 2
            } else {
                Write-Host "Creating new MongoDB Docker container..." -ForegroundColor Yellow
                docker run -d -p 27017:27017 --name mongodb mongo:latest 2>$null | Out-Null
                Start-Sleep -Seconds 3
            }
            
            $dockerCheck = docker ps --filter "name=mongodb" --format "{{.Names}}" 2>$null
            if ($dockerCheck -eq "mongodb") {
                Write-Host "[OK] MongoDB started in Docker" -ForegroundColor Green
                $mongoService = @{ Status = "Running" }
            }
        } else {
            Write-Host "[OK] MongoDB is already running in Docker" -ForegroundColor Green
            $mongoService = @{ Status = "Running" }
        }
    }
}

# If still not running, try mongod process
if (-not $mongoService -or $mongoService.Status -ne "Running") {
    # Check if MongoDB process is already running
    $mongoProcess = Get-Process -Name "mongod" -ErrorAction SilentlyContinue
    if ($mongoProcess) {
        Write-Host "[OK] MongoDB process is already running" -ForegroundColor Green
    } else {
        Write-Host "MongoDB is not running, attempting to start..." -ForegroundColor Yellow
        
        # Try to find mongod.exe
        $mongodPath = $null
        
        # Check common installation paths
        $commonPaths = @(
            "C:\Program Files\MongoDB\Server\*\bin\mongod.exe",
            "C:\mongodb\bin\mongod.exe",
            "$env:ProgramFiles\MongoDB\Server\*\bin\mongod.exe",
            "$env:LOCALAPPDATA\Programs\MongoDB\Server\*\bin\mongod.exe"
        )
        
        foreach ($pattern in $commonPaths) {
            $found = Get-Item $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($found) {
                $mongodPath = $found.FullName
                Write-Host "Found MongoDB at: $mongodPath" -ForegroundColor Cyan
                break
            }
        }
        
        # Also check if mongod is in PATH
        if (-not $mongodPath) {
            $mongodInPath = Get-Command mongod -ErrorAction SilentlyContinue
            if ($mongodInPath) {
                $mongodPath = $mongodInPath.Source
                Write-Host "Found MongoDB in PATH: $mongodPath" -ForegroundColor Cyan
            }
        }
        
        if ($mongodPath) {
            # Default data directory
            $dataDir = "$env:USERPROFILE\data\db"
            if (-not (Test-Path $dataDir)) {
                New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
                Write-Host "Created data directory: $dataDir" -ForegroundColor Cyan
            }
            
            Write-Host "Starting MongoDB process..." -ForegroundColor Yellow
            try {
                $mongoProcess = Start-Process -FilePath $mongodPath -ArgumentList "--dbpath", "`"$dataDir`"" -PassThru -WindowStyle Hidden
                Start-Sleep -Seconds 3
                
                # Verify it's running
                $checkProcess = Get-Process -Id $mongoProcess.Id -ErrorAction SilentlyContinue
                if ($checkProcess) {
                    Write-Host "[OK] MongoDB process started (PID: $($mongoProcess.Id))" -ForegroundColor Green
                } else {
                    Write-Host "[WARNING] MongoDB process may have failed to start" -ForegroundColor Yellow
                }
            } catch {
                Write-Host "[ERROR] Failed to start MongoDB: $_" -ForegroundColor Red
                Write-Host "Please start MongoDB manually" -ForegroundColor Yellow
            }
        } else {
            Write-Host "[WARNING] MongoDB executable not found" -ForegroundColor Yellow
            Write-Host "`nMongoDB is not installed. Please install it first:" -ForegroundColor Yellow
            Write-Host "1. Download from: https://www.mongodb.com/try/download/community" -ForegroundColor Cyan
            Write-Host "2. Choose Windows MSI installer" -ForegroundColor Cyan
            Write-Host "3. Install with 'Install as Service' option checked" -ForegroundColor Cyan
            Write-Host "4. Or see MONGODB_SETUP.md for detailed instructions" -ForegroundColor Cyan
            Write-Host "`nPress any key to continue anyway (app will fail without MongoDB)..." -ForegroundColor Yellow
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        }
    }
}

# Start FastAPI Server
Write-Host "`n--- Starting FastAPI Server ---" -ForegroundColor Yellow

$serverScript = @"
cd $PWD\src\server
.\.venv\Scripts\activate
python -m main.app
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $serverScript
Write-Host "[OK] FastAPI server starting..." -ForegroundColor Green

# Wait for backend to be ready
Write-Host "Waiting for backend to be ready..." -ForegroundColor Yellow
$backendReady = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5000/health" -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $backendReady = $true
            Write-Host "[OK] Backend is ready" -ForegroundColor Green
            break
        }
    } catch {
        # Continue waiting
    }
}

if (-not $backendReady) {
    Write-Host "[WARNING] Backend may not be ready yet. Please check manually." -ForegroundColor Yellow
}

# Start Next.js Client
Write-Host "`n--- Starting Next.js Client ---" -ForegroundColor Yellow

$clientScript = @"
cd $PWD\src\client
npm run dev
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $clientScript
Write-Host "[OK] Next.js client starting..." -ForegroundColor Green

# Wait for frontend to be ready
Write-Host "Waiting for frontend to be ready..." -ForegroundColor Yellow
$frontendReady = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $frontendReady = $true
            Write-Host "[OK] Frontend is ready" -ForegroundColor Green
            break
        }
    } catch {
        # Continue waiting
    }
}

if (-not $frontendReady) {
    Write-Host "[WARNING] Frontend may not be ready yet. Please check manually." -ForegroundColor Yellow
}

# Final status check
Write-Host "`n=== Services Status ===" -ForegroundColor Green

# Check MongoDB
$mongoStatus = docker ps --filter "name=mongodb" --format "{{.Status}}" 2>$null
if ($mongoStatus) {
    Write-Host "[OK] MongoDB: Running ($mongoStatus)" -ForegroundColor Green
} else {
    Write-Host "[WARNING] MongoDB: Status unknown" -ForegroundColor Yellow
}

# Check Backend
if (Test-Port -Port 5000) {
    Write-Host "[OK] FastAPI Server: Running on http://localhost:5000" -ForegroundColor Green
} else {
    Write-Host "[ERROR] FastAPI Server: Not running" -ForegroundColor Red
}

# Check Frontend
if (Test-Port -Port 3000) {
    Write-Host "[OK] Next.js Client: Running on http://localhost:3000" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Next.js Client: Not running" -ForegroundColor Red
}

Write-Host "`n=== Startup Complete ===" -ForegroundColor Green
Write-Host "FastAPI Server: http://localhost:5000" -ForegroundColor Cyan
Write-Host "Next.js Client: http://localhost:3000" -ForegroundColor Cyan
Write-Host "API Docs: http://localhost:5000/docs" -ForegroundColor Cyan
Write-Host "`nAll services are running in separate PowerShell windows." -ForegroundColor Yellow
Write-Host "Close those windows to stop the services." -ForegroundColor Yellow
Write-Host "`nPress any key to exit this window..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

