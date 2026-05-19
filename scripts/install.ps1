# Volle Windows Installer
# Run as Administrator in PowerShell

$ErrorActionPreference = "Stop"

$InstallDir = "$env:LOCALAPPDATA\Volle"
$BackendDir = "$InstallDir\backend"
$DataDir = "$InstallDir\data"
$LogDir = "$InstallDir\logs"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Volle Voice Agent Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# ------------------------------------------------------------------
# 1. Check admin
# ------------------------------------------------------------------
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: Please run this script as Administrator." -ForegroundColor Red
    exit 1
}

# ------------------------------------------------------------------
# 2. Install Python (via Microsoft Store / winget)
# ------------------------------------------------------------------
Write-Host "==> Checking Python..." -ForegroundColor Yellow
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Host "Python not found. Installing via winget..." -ForegroundColor Yellow
    winget install Python.Python.3.11 --silent --accept-package-agreements --accept-source-agreements
    $env:PATH = [Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [Environment]::GetEnvironmentVariable("PATH", "User")
}

$pythonPath = (Get-Command python).Source
Write-Host "Using Python: $pythonPath" -ForegroundColor Green

# ------------------------------------------------------------------
# 3. Create directories
# ------------------------------------------------------------------
Write-Host "==> Creating directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $InstallDir, $BackendDir, $DataDir, $LogDir | Out-Null

# ------------------------------------------------------------------
# 4. Install backend (agent-worker)
# ------------------------------------------------------------------
Write-Host "==> Installing Volle backend..." -ForegroundColor Yellow

# Copy backend source
$SourceBackend = "$PSScriptRoot\..\apps\agent-worker"
if (-not (Test-Path $SourceBackend)) {
    Write-Host "ERROR: Backend source not found at $SourceBackend" -ForegroundColor Red
    exit 1
}

# Use robocopy for reliable copy
robocopy $SourceBackend $BackendDir /MIR /XD __pycache__ .venv /NJH /NJS /NDL /NC /NS

# Create virtual environment
& $pythonPath -m venv "$BackendDir\.venv"
$pip = "$BackendDir\.venv\Scripts\pip.exe"

# Install dependencies
& $pip install --upgrade pip
& $pip install -r "$BackendDir\requirements.txt"

# ------------------------------------------------------------------
# 5. Create .env file
# ------------------------------------------------------------------
Write-Host "==> Creating environment config..." -ForegroundColor Yellow
$envContent = @"
# Volle Agent Worker Environment
DATABASE_URL=sqlite:///$DataDir\volle.db
OPENAI_API_KEY=your_openai_key_here
ELEVENLABS_API_KEY=your_elevenlabs_key_here
DEEPGRAM_API_KEY=your_deepgram_key_here
LLM_PROVIDER=openai
"@
$envContent | Set-Content "$BackendDir\.env" -Encoding UTF8

# ------------------------------------------------------------------
# 6. Run database migrations
# ------------------------------------------------------------------
Write-Host "==> Running database migrations..." -ForegroundColor Yellow
$venvPython = "$BackendDir\.venv\Scripts\python.exe"
Set-Location $BackendDir
& $venvPython -c "import asyncio; from db import init_pool, run_migrations; asyncio.run(init_pool()); asyncio.run(run_migrations())"
Set-Location $PSScriptRoot\..

# ------------------------------------------------------------------
# 7. Install desktop app (MSI)
# ------------------------------------------------------------------
Write-Host "==> Installing Volle Desktop..." -ForegroundColor Yellow
$msiPath = Get-ChildItem -Path "$PSScriptRoot\..\apps\client-desktop\src-tauri\target\release\bundle\msi" -Filter "*.msi" | Select-Object -First 1
if ($msiPath) {
    Write-Host "Found MSI: $($msiPath.FullName)" -ForegroundColor Green
    Start-Process msiexec.exe -ArgumentList "/i `"$($msiPath.FullName)`" /quiet /norestart" -Wait
} else {
    Write-Host "WARNING: MSI not found. Build it first with build-windows.ps1" -ForegroundColor Yellow
}

# ------------------------------------------------------------------
# 8. Create Windows Service for backend
# ------------------------------------------------------------------
Write-Host "==> Creating Windows Service..." -ForegroundColor Yellow
$serviceName = "VolleBackend"
$serviceDisplayName = "Volle Agent Backend"

# Remove old service if exists
$existing = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Removing existing service..." -ForegroundColor Yellow
    sc.exe delete $serviceName | Out-Null
    Start-Sleep -Seconds 2
}

# Use nssm (Non-Sucking Service Manager) for Python service wrapper
$nssmPath = "$InstallDir\nssm.exe"
if (-not (Test-Path $nssmPath)) {
    Write-Host "Downloading NSSM..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri "https://nssm.cc/release/nssm-2.24.zip" -OutFile "$InstallDir\nssm.zip"
    Expand-Archive "$InstallDir\nssm.zip" "$InstallDir\nssm" -Force
    Copy-Item "$InstallDir\nssm\nssm-2.24\win64\nssm.exe" $nssmPath -Force
}

# Create service
& $nssmPath install $serviceName $venvPython "$BackendDir\main.py"
& $nssmPath set $serviceName DisplayName $serviceDisplayName
& $nssmPath set $serviceName Description "Volle Voice Agent Backend API"
& $nssmPath set $serviceName Start SERVICE_AUTO_START
& $nssmPath set $serviceName AppDirectory $BackendDir
& $nssmPath set $serviceName AppStdout "$LogDir\backend.log"
& $nssmPath set $serviceName AppStderr "$LogDir\backend_error.log"

Start-Service $serviceName

# ------------------------------------------------------------------
# 9. Create desktop shortcut
# ------------------------------------------------------------------
Write-Host "==> Creating desktop shortcut..." -ForegroundColor Yellow
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\Volle.lnk")
$Shortcut.TargetPath = "$env:LOCALAPPDATA\Volle\Volle.exe"
$Shortcut.WorkingDirectory = "$env:LOCALAPPDATA\Volle"
$Shortcut.IconLocation = "$env:LOCALAPPDATA\Volle\Volle.exe,0"
$Shortcut.Save()

# ------------------------------------------------------------------
# 10. Done
# ------------------------------------------------------------------
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Volle installed successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Installation directory: $InstallDir" -ForegroundColor Cyan
Write-Host "Logs: $LogDir" -ForegroundColor Cyan
Write-Host "Database: $DataDir\volle.db" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Edit $BackendDir\.env and add your API keys" -ForegroundColor White
Write-Host "  2. Restart the service: Restart-Service VolleBackend" -ForegroundColor White
Write-Host "  3. Launch Volle from your desktop" -ForegroundColor White
