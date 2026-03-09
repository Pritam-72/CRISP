$frontendPath = Join-Path $PSScriptRoot "disasteriq-frontend"
Set-Location $frontendPath
$env:NODE_NO_WARNINGS = 1
& "$frontendPath\node_modules\.bin\next.cmd" dev
Read-Host "Press Enter to exit"
