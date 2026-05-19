# Build Volle desktop app for Windows locally
# Run from repo root in PowerShell

$ErrorActionPreference = "Stop"

$ClientDir = "apps/client-desktop"

Write-Host "==> Installing frontend dependencies..." -ForegroundColor Cyan
Set-Location $ClientDir
npm install

Write-Host "==> Building frontend..." -ForegroundColor Cyan
npm run build

Write-Host "==> Installing tauri-cli (if missing)..." -ForegroundColor Cyan
cargo install tauri-cli --locked

Write-Host "==> Building Tauri Windows bundles (MSI + NSIS)..." -ForegroundColor Cyan
cargo tauri build

Write-Host "==> Done. Artifacts should be in:" -ForegroundColor Green
Write-Host "   src-tauri/target/release/bundle/msi/" -ForegroundColor Yellow
Write-Host "   src-tauri/target/release/bundle/nsis/" -ForegroundColor Yellow

Set-Location ../..
