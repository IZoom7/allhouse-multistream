<#
  Allhouse local alpha launcher.
  Builds the interface (TypeScript check + Vite) and starts the Electron desktop app.

    powershell -ExecutionPolicy Bypass -File scripts\start.ps1            # build, then run
    powershell -ExecutionPolicy Bypass -File scripts\start.ps1 -SkipBuild # run the existing dist\
    powershell -ExecutionPolicy Bypass -File scripts\start.ps1 -Test      # run automated tests only
    powershell -ExecutionPolicy Bypass -File scripts\start.ps1 -BuildOnly

  Node.js is looked up on PATH first, then in common install locations.
  Set ALLHOUSE_NODE to a node.exe path to override. No packages are downloaded.
#>
param([switch]$SkipBuild, [switch]$BuildOnly, [switch]$Test)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Find-Node {
    if ($env:ALLHOUSE_NODE -and (Test-Path $env:ALLHOUSE_NODE)) { return $env:ALLHOUSE_NODE }
    $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $candidates = @(
        "$env:ProgramFiles\nodejs\node.exe",
        "${env:ProgramFiles(x86)}\nodejs\node.exe",
        "$env:LOCALAPPDATA\Programs\nodejs\node.exe",
        "$env:ProgramFiles\Adobe\Adobe Creative Cloud Experience\libs\node.exe"
    )
    foreach ($c in $candidates) { if ($c -and (Test-Path $c)) { return $c } }
    throw 'Node.js was not found. Install Node.js 20+ or set ALLHOUSE_NODE to the full path of node.exe.'
}

if (-not (Test-Path (Join-Path $root 'node_modules\electron\dist\electron.exe'))) {
    throw 'Dependencies are missing (node_modules\electron). Run "pnpm install" (or npm install) once with network access.'
}
$node = Find-Node
Write-Host "Using Node: $node"

function Run([string[]]$argv) {
    & $node @argv
    if ($LASTEXITCODE -ne 0) { throw "Command failed ($LASTEXITCODE): node $($argv -join ' ')" }
}

if ($Test) {
    Run @('--test', 'tests/*.test.cjs')
    return
}
if (-not $SkipBuild) {
    Write-Host 'Type-checking...'
    Run @('node_modules/typescript/bin/tsc', '-b')
    Write-Host 'Building interface...'
    Run @('node_modules/vite/bin/vite.js', 'build')
}
if ($BuildOnly) { return }
Write-Host 'Starting Allhouse...'
& (Join-Path $root 'node_modules\electron\dist\electron.exe') $root
