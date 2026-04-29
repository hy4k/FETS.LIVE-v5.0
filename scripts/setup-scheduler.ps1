# Run this once as Administrator to register the daily scraper task.
# Right-click this file → "Run with PowerShell" (it will ask for admin if needed)

$taskName  = "FETS-CMA-Scraper"
$batFile   = Join-Path $PSScriptRoot "run-cma-scraper.bat"
$nodeExe   = (Get-Command node -ErrorAction SilentlyContinue)?.Source

if (-not $nodeExe) {
    Write-Host "ERROR: Node.js not found in PATH. Install it from https://nodejs.org" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Remove old task if it exists
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

$action   = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$batFile`""
$triggers = @(
    (New-ScheduledTaskTrigger -Daily -At "07:30AM"),   # morning
    (New-ScheduledTaskTrigger -Daily -At "01:00PM")    # afternoon (in case morning missed)
)
$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 5) `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -WakeToRun $false

$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Highest

try {
    Register-ScheduledTask `
        -TaskName    $taskName `
        -Action      $action `
        -Trigger     $triggers `
        -Settings    $settings `
        -Principal   $principal `
        -Description "Scrapes Prometric for CMA seat availability and updates FETS.live"

    Write-Host ""
    Write-Host "SUCCESS: Task '$taskName' registered." -ForegroundColor Green
    Write-Host "Runs at 7:30 AM and 1:00 PM daily (when this PC is on)." -ForegroundColor Green
    Write-Host ""
    Write-Host "Logs saved to: $PSScriptRoot\cma-scraper.log" -ForegroundColor Cyan
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
    Write-Host "Try running this script as Administrator." -ForegroundColor Yellow
}

Read-Host "Press Enter to close"
