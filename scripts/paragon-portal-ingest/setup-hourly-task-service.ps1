$ErrorActionPreference = 'Stop'

$taskNameHourly = 'FETS-Paragon-Ingest-Hourly'
$taskNameStartup = 'FETS-Paragon-Ingest-Startup'
$repoRoot = 'C:\Dev\FETS.LIVE\5.0\FETS.LIVE-v5.0'
$logDir = Join-Path $repoRoot 'output\playwright'
$logFile = Join-Path $logDir 'paragon-ingest-hourly.log'
$browserCache = Join-Path $repoRoot '.playwright-browsers'
$nodeExe = 'c:\Users\mithu\AppData\Local\Programs\cursor\resources\app\resources\helpers\node.exe'

if (!(Test-Path $nodeExe)) {
  throw "Node executable not found at: $nodeExe"
}

if (!(Test-Path $logDir)) {
  New-Item -ItemType Directory -Path $logDir | Out-Null
}

if (!(Test-Path $browserCache)) {
  New-Item -ItemType Directory -Path $browserCache | Out-Null
}

# Install Chromium once into a machine-shared path so SYSTEM can reuse it.
Write-Host 'Installing Playwright Chromium into shared cache...'
$env:PLAYWRIGHT_BROWSERS_PATH = $browserCache
Push-Location (Join-Path $repoRoot 'scripts\paragon-portal-ingest')
try {
  & npm exec playwright install chromium
} finally {
  Pop-Location
}

$runnerCmd = Join-Path $repoRoot 'scripts\paragon-portal-ingest\run-hourly.cmd'
if (!(Test-Path $runnerCmd)) {
  throw "Task runner not found: $runnerCmd"
}
$taskCommand = "`"$runnerCmd`""

# Disable legacy interactive task if it exists.
schtasks /Change /TN $taskNameHourly /DISABLE 2>$null | Out-Null

Write-Host "Creating/updating SYSTEM hourly task: $taskNameHourly"
schtasks /Create /TN $taskNameHourly /SC HOURLY /MO 1 /TR $taskCommand /RU SYSTEM /F | Out-Host

Write-Host "Creating/updating SYSTEM startup task: $taskNameStartup"
schtasks /Create /TN $taskNameStartup /SC ONSTART /TR $taskCommand /RU SYSTEM /F | Out-Host

Write-Host ''
Write-Host 'Hourly task status:'
schtasks /Query /TN $taskNameHourly /V /FO LIST | Out-Host

Write-Host ''
Write-Host 'Startup task status:'
schtasks /Query /TN $taskNameStartup /V /FO LIST | Out-Host

Write-Host ''
Write-Host 'Manual trigger command:'
Write-Host "  schtasks /Run /TN `"$taskNameHourly`""
