# Start-BIGBoss-OS.ps1
# One-click launcher for the whole BIGBoss Trading Organization OS stack:
#   1) Ollama  (local model runtime, :11434)   - fallback provider
#   2) FCC     (Free Claude Code proxy, :8082)  - routes to NVIDIA NIM etc.
#   3) Cockpit (Vite dev server, :5173)         - the dashboard
# Then opens the dashboard in your default browser.
# Each service is only started if it is not already listening.

$ProjectDir = $PSScriptRoot
$logDir = Join-Path $env:USERPROFILE "fcc-logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

function Test-Port {
    param([int]$Port)
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $client.Connect("127.0.0.1", $Port)
        return $true
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

function Wait-Port {
    param([int]$Port, [int]$TimeoutSec = 40)
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-Port -Port $Port) { return $true }
        Start-Sleep -Milliseconds 700
    }
    return $false
}

Write-Host "=== BIGBoss Trading Organization OS launcher ===" -ForegroundColor Yellow

# 1) Ollama
if (Test-Port -Port 11434) {
    Write-Host "[ok]   Ollama already running on 11434." -ForegroundColor Green
} else {
    Write-Host "[start] Ollama (ollama serve)..." -ForegroundColor Cyan
    $ollama = (Get-Command ollama -ErrorAction SilentlyContinue).Source
    if (-not $ollama) { $ollama = Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe" }
    if (Test-Path $ollama) {
        Start-Process -FilePath $ollama -ArgumentList "serve" -WindowStyle Minimized
    } else {
        Write-Host "[warn] Ollama not found; skipping (FCC will still work)." -ForegroundColor DarkYellow
    }
}

# 2) FCC proxy
if (Test-Port -Port 8082) {
    Write-Host "[ok]   FCC proxy already running on 8082." -ForegroundColor Green
} else {
    Write-Host "[start] FCC proxy (fcc-server)..." -ForegroundColor Cyan
    $fcc = (Get-Command fcc-server -ErrorAction SilentlyContinue).Source
    if (-not $fcc) { $fcc = Join-Path $env:USERPROFILE ".local\bin\fcc-server.exe" }
    if (Test-Path $fcc) {
        Start-Process -FilePath $fcc `
            -RedirectStandardOutput (Join-Path $logDir "fcc-server.out.log") `
            -RedirectStandardError (Join-Path $logDir "fcc-server.err.log") `
            -WindowStyle Minimized
        if (Wait-Port -Port 8082 -TimeoutSec 30) {
            Write-Host "[ok]   FCC proxy is up on 8082." -ForegroundColor Green
        } else {
            Write-Host "[warn] FCC did not report healthy in time; check $logDir." -ForegroundColor DarkYellow
        }
    } else {
        Write-Host "[warn] fcc-server not found; the cockpit will fall back to Ollama/mock." -ForegroundColor DarkYellow
    }
}

# 3) Cockpit (Vite dev server)
if (Test-Port -Port 5173) {
    Write-Host "[ok]   Cockpit already running on 5173." -ForegroundColor Green
} else {
    Write-Host "[start] Cockpit (npm run dev)..." -ForegroundColor Cyan
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm run dev" -WorkingDirectory $ProjectDir -WindowStyle Minimized
    if (Wait-Port -Port 5173 -TimeoutSec 60) {
        Write-Host "[ok]   Cockpit is up on 5173." -ForegroundColor Green
    } else {
        Write-Host "[warn] Cockpit did not come up in time; run 'npm install' then retry." -ForegroundColor DarkYellow
    }
}

# Open the dashboard
$dashboard = "http://127.0.0.1:5173/"
Write-Host "Opening $dashboard ..." -ForegroundColor Yellow
Start-Process $dashboard | Out-Null

Write-Host ""
Write-Host "All set. Dashboard: $dashboard   FCC admin: http://127.0.0.1:8082/admin" -ForegroundColor Green
Write-Host "(Close this window to leave services running; stop them from Task Manager or their own windows.)"
