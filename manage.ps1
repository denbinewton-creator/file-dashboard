# File Repository Dashboard - manage.ps1
# Usage:  .\manage.ps1 start
#         .\manage.ps1 stop
#         .\manage.ps1 status
# Note:   Starting/stopping PostgreSQL requires running as Administrator.

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("start","stop","status")]
    [string]$Action
)

$pgService = "postgresql-x64-18"
$psql      = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
$bauPidFile = Join-Path $PSScriptRoot "bau.pid"
$env:PGPASSWORD = "postgres"

function Is-Admin {
    ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]"Administrator")
}

function Get-PortPID($port) {
    $line = netstat -ano | Select-String ":$port\s.*LISTENING"
    if ($line) { return ($line -split '\s+')[-1] }
    return $null
}

function Get-DBStatus {
    $svc = sc.exe query $pgService 2>$null | Select-String "RUNNING"
    return $null -ne $svc
}

function Get-BauPID {
    if (-not (Test-Path $bauPidFile)) { return $null }
    $stored = Get-Content $bauPidFile -ErrorAction SilentlyContinue
    if (-not $stored) { return $null }
    $proc = Get-Process -Id $stored -ErrorAction SilentlyContinue
    if ($proc) { return $stored }
    Remove-Item $bauPidFile -ErrorAction SilentlyContinue
    return $null
}

function Show-Status {
    $dbUp  = Get-DBStatus
    $bPID  = Get-PortPID 8080
    $fPID  = Get-PortPID 3010
    $bauP  = Get-BauPID

    Write-Host ""
    if ($dbUp) {
        Write-Host "  Database     (PostgreSQL)  RUNNING   service: $pgService" -ForegroundColor Green
    } else {
        Write-Host "  Database     (PostgreSQL)  STOPPED" -ForegroundColor DarkGray
    }
    if ($bPID) {
        Write-Host "  Backend      (port 8080)   RUNNING   PID $bPID" -ForegroundColor Green
    } else {
        Write-Host "  Backend      (port 8080)   STOPPED" -ForegroundColor DarkGray
    }
    if ($fPID) {
        Write-Host "  Frontend     (port 3010)   RUNNING   PID $fPID" -ForegroundColor Green
    } else {
        Write-Host "  Frontend     (port 3010)   STOPPED" -ForegroundColor DarkGray
    }
    if ($bauP) {
        Write-Host "  BAU Imitator (100 rec/hr)  RUNNING   PID $bauP" -ForegroundColor Green
    } else {
        Write-Host "  BAU Imitator (100 rec/hr)  STOPPED" -ForegroundColor DarkGray
    }
    Write-Host ""
}

function Start-Project {
    Write-Host ""
    Write-Host "=== Starting File Repository Dashboard ===" -ForegroundColor Cyan

    # Database
    Write-Host ""
    Write-Host "[1/4] Starting database..." -ForegroundColor Yellow
    if (Get-DBStatus) {
        Write-Host "      Already running - skipping." -ForegroundColor DarkGray
    } else {
        if (-not (Is-Admin)) {
            Write-Host "      Not running as Administrator - cannot start PostgreSQL service." -ForegroundColor Red
            Write-Host "      Re-run as Administrator, or start PostgreSQL manually." -ForegroundColor Red
        } else {
            Start-Service $pgService
            Start-Sleep -Seconds 2
            if (Get-DBStatus) {
                Write-Host "      PostgreSQL started." -ForegroundColor Green
            } else {
                Write-Host "      Failed to start PostgreSQL - check Windows Services." -ForegroundColor Red
            }
        }
    }
    try {
        & $psql -U postgres -c "CREATE DATABASE file_dashboard;" 2>$null | Out-Null
        Write-Host "      Database 'file_dashboard' created." -ForegroundColor Green
    } catch {
        Write-Host "      Database 'file_dashboard' already exists - continuing." -ForegroundColor DarkGray
    }

    # Backend
    Write-Host ""
    Write-Host "[2/4] Starting backend on :8080..." -ForegroundColor Yellow
    $bPID = Get-PortPID 8080
    if ($bPID) {
        Write-Host "      Already running (PID $bPID) - skipping." -ForegroundColor DarkGray
    } else {
        Push-Location backend
        go mod tidy | Out-Null
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "go run main.go" -WindowStyle Minimized
        Pop-Location
        Start-Sleep -Seconds 3
        $bPID = Get-PortPID 8080
        if ($bPID) {
            Write-Host "      Started (PID $bPID)." -ForegroundColor Green
        } else {
            Write-Host "      Started (check the minimised terminal for errors)." -ForegroundColor Yellow
        }
    }

    # Frontend
    Write-Host ""
    Write-Host "[3/4] Starting frontend on :3010..." -ForegroundColor Yellow
    $fPID = Get-PortPID 3010
    if ($fPID) {
        Write-Host "      Already running (PID $fPID) - skipping." -ForegroundColor DarkGray
    } else {
        Push-Location frontend
        if (-not (Test-Path node_modules)) {
            Write-Host "      Installing npm packages (first run)..." -ForegroundColor DarkGray
            npm install | Out-Null
        }
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev" -WindowStyle Minimized
        Pop-Location
        Start-Sleep -Seconds 4
        $fPID = Get-PortPID 3010
        if ($fPID) {
            Write-Host "      Started (PID $fPID)." -ForegroundColor Green
        } else {
            Write-Host "      Started (check the minimised terminal for errors)." -ForegroundColor Yellow
        }
    }

    # BAU Imitator
    Write-Host ""
    Write-Host "[4/4] Starting BAU file imitator (100 records/hr)..." -ForegroundColor Yellow
    $bauP = Get-BauPID
    if ($bauP) {
        Write-Host "      Already running (PID $bauP) - skipping." -ForegroundColor DarkGray
    } else {
        Push-Location bau
        go mod tidy | Out-Null
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "go run main.go" -WindowStyle Minimized
        Pop-Location
        Start-Sleep -Seconds 4
        $bauP = Get-BauPID
        if ($bauP) {
            Write-Host "      Started (PID $bauP) - inserting 1 record every 36s." -ForegroundColor Green
        } else {
            Write-Host "      Started (check the minimised terminal for errors)." -ForegroundColor Yellow
        }
    }

    Write-Host ""
    Write-Host "  Dashboard : http://localhost:3010" -ForegroundColor Cyan
    Write-Host "  GraphQL   : http://localhost:8080/graphql" -ForegroundColor Cyan
    Write-Host ""
}

function Stop-Project {
    Write-Host ""
    Write-Host "=== Stopping File Repository Dashboard ===" -ForegroundColor Cyan
    Write-Host ""

    # Frontend
    $fPID = Get-PortPID 3010
    if ($fPID) {
        Stop-Process -Id $fPID -Force -ErrorAction SilentlyContinue
        Write-Host "  Frontend     (port 3010)   stopped (PID $fPID)." -ForegroundColor Green
    } else {
        Write-Host "  Frontend     (port 3010)   was not running." -ForegroundColor DarkGray
    }

    # Backend
    $bPID = Get-PortPID 8080
    if ($bPID) {
        Stop-Process -Id $bPID -Force -ErrorAction SilentlyContinue
        Write-Host "  Backend      (port 8080)   stopped (PID $bPID)." -ForegroundColor Green
    } else {
        Write-Host "  Backend      (port 8080)   was not running." -ForegroundColor DarkGray
    }

    # BAU Imitator
    $bauP = Get-BauPID
    if ($bauP) {
        Stop-Process -Id $bauP -Force -ErrorAction SilentlyContinue
        Remove-Item $bauPidFile -ErrorAction SilentlyContinue
        Write-Host "  BAU Imitator (100 rec/hr)  stopped (PID $bauP)." -ForegroundColor Green
    } else {
        Write-Host "  BAU Imitator (100 rec/hr)  was not running." -ForegroundColor DarkGray
    }

    # Database
    if (Get-DBStatus) {
        if (-not (Is-Admin)) {
            Write-Host "  Database     (PostgreSQL)  cannot stop - re-run as Administrator." -ForegroundColor Red
        } else {
            Stop-Service $pgService -Force
            Write-Host "  Database     (PostgreSQL)  stopped." -ForegroundColor Green
        }
    } else {
        Write-Host "  Database     (PostgreSQL)  was not running." -ForegroundColor DarkGray
    }

    Write-Host ""
}

switch ($Action) {
    "start"  { Start-Project }
    "stop"   { Stop-Project  }
    "status" { Show-Status   }
}
