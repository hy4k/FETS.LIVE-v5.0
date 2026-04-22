$ErrorActionPreference = 'Stop'

$taskName = 'FETS-Paragon-Ingest-Hourly'
$repoRoot = 'C:\Dev\FETS.LIVE\5.0\FETS.LIVE-v5.0'
$logDir = Join-Path $repoRoot 'output\playwright'
$logFile = Join-Path $logDir 'paragon-ingest-hourly.log'

if (!(Test-Path $logDir)) {
  New-Item -ItemType Directory -Path $logDir | Out-Null
}

# Run from repo root so package.json script `paragon:ingest` resolves correctly.
$taskCommand = "cmd /c cd /d `"$repoRoot`" && npm run paragon:ingest >> `"$logFile`" 2>&1"

$createArgs = @(
  '/Create',
  '/TN', $taskName,
  '/SC', 'HOURLY',
  '/MO', '1',
  '/TR', $taskCommand,
  '/F'
)

Write-Host "Creating/updating task: $taskName"
schtasks @createArgs | Out-Host

Write-Host ''
Write-Host "Task status:"
schtasks /Query /TN $taskName /V /FO LIST | Out-Host

Write-Host ''
Write-Host "Manual trigger command:"
Write-Host "  schtasks /Run /TN `"$taskName`""
