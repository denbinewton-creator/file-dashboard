# File Repository Dashboard - startup script
# Prerequisites: Go, Node.js, PostgreSQL running with DB 'file_dashboard'
# Run from the project root:  .\start.ps1

$ErrorActionPreference = "Stop"

Write-Host "`n=== File Repository Dashboard ===" -ForegroundColor Cyan

# PostgreSQL - create database if it does not exist
Write-Host "`n[1/3] Ensuring PostgreSQL database exists..." -ForegroundColor Yellow
try {
    $env:PGPASSWORD = "postgres"
    psql -U postgres -c "CREATE DATABASE file_dashboard;" 2>$null
    Write-Host "      Database created." -ForegroundColor Green
} catch {
    Write-Host "      Database already exists (or psql not in PATH - continuing)." -ForegroundColor DarkGray
}

# Go backend
Write-Host "`n[2/3] Starting Go backend on :8080..." -ForegroundColor Yellow
Push-Location backend
go mod tidy
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "go mod tidy failed" }
Start-Process -NoNewWindow powershell -ArgumentList "-Command", "go run main.go" -PassThru | Out-Null
Pop-Location
Write-Host "      Backend started." -ForegroundColor Green

# React frontend
Write-Host "`n[3/3] Starting React frontend on :3010..." -ForegroundColor Yellow
Push-Location frontend
if (-not (Test-Path node_modules)) {
    Write-Host "      Installing npm packages (first run)..." -ForegroundColor DarkGray
    npm install
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw "npm install failed" }
}
Pop-Location

Write-Host "`n Dashboard: http://localhost:3010" -ForegroundColor Cyan
Write-Host " GraphQL:   http://localhost:8080/graphql" -ForegroundColor Cyan
Write-Host "`nPress Ctrl+C to stop.`n" -ForegroundColor DarkGray

Push-Location frontend
npm run dev
Pop-Location
