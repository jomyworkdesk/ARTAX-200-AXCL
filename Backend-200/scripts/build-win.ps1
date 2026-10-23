$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$distDir = [System.IO.Path]::GetFullPath((Join-Path $projectRoot "..\dist"))
$coreDir = Join-Path $distDir "core"
$exeName = "artax core.exe"
$exePath = Join-Path $coreDir $exeName
$bcryptTargetDir = Join-Path $coreDir "prebuilds\win32-x64"
$bcryptSource = Join-Path $projectRoot "node_modules\bcrypt\prebuilds\win32-x64\bcrypt.node"
$bcryptTarget = Join-Path $bcryptTargetDir "bcrypt.node"

function Reset-DistDirectory {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Path
    )

    if (Test-Path $Path) {
        try {
            Remove-Item -LiteralPath $Path -Recurse -Force
        } catch {
            throw "Build output folder could not be cleaned: $Path. Close any running exe, close Explorer preview/details panes, or wait for antivirus scanning to finish, then run the build again."
        }
    }

    New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

Push-Location $projectRoot
try {
    Reset-DistDirectory -Path $distDir

    New-Item -ItemType Directory -Force -Path $coreDir | Out-Null

    pkg . --targets node18-win-x64 --output $exePath
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }

    New-Item -ItemType Directory -Force -Path $bcryptTargetDir | Out-Null
    Copy-Item -Force $bcryptSource $bcryptTarget

    & (Join-Path $PSScriptRoot "build-service-win.ps1")
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }

    Write-Host "Build created: $exePath"
} finally {
    Pop-Location
}
