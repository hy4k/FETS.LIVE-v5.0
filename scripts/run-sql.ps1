Param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Query,
  [string]$ProjectRef = "qqewusetilxxfvfkmsed",
  [switch]$Raw
)

$ErrorActionPreference = "Stop"

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Error "Environment variable SUPABASE_ACCESS_TOKEN is not set."
  exit 1
}

$headers = @{
  Authorization = "Bearer $($env:SUPABASE_ACCESS_TOKEN)"
  apikey        = "$($env:SUPABASE_ACCESS_TOKEN)"
  'Content-Type' = 'application/json'
  Accept        = 'application/json'
}

$body = @{ query = $Query } | ConvertTo-Json -Compress

try {
  $url = "https://api.supabase.com/v1/projects/$ProjectRef/database/query"
  $resp = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body
  if ($Raw) {
    $resp | ConvertTo-Json -Depth 8
  }
  else {
    if ($resp.value) {
      $resp.value | ConvertTo-Json -Depth 8
    }
    else {
      $resp | ConvertTo-Json -Depth 8
    }
  }
}
catch {
  Write-Error $_.Exception.Message
  exit 1
}

