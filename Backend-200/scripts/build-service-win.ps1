$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$repoRoot = Resolve-Path (Join-Path $projectRoot "..")
$distDir = Join-Path $repoRoot "dist"
$sourcePath = Join-Path $projectRoot "service-wrapper\ARTAX200Service.cs"
$mainExePath = Join-Path $distDir "core\artax core.exe"
$controlExePath = Join-Path $distDir "ARTAX-200.exe"
$controlIconPath = Join-Path $PSScriptRoot "icon-settings.ico"

if (-not (Test-Path $mainExePath)) {
    throw "Engine exe missing: $mainExePath. Run Backend-200\scripts\build-win.ps1 first."
}

if (-not (Test-Path $sourcePath)) {
    throw "Service wrapper source missing: $sourcePath"
}

if (-not (Test-Path $controlIconPath)) {
    throw "Control app icon missing: $controlIconPath"
}

Remove-Item -Path @(
    (Join-Path $distDir "ARTAX-200-Service.exe")
    (Join-Path $distDir "*-ARTAX200-Service.bat")
) -Force -ErrorAction SilentlyContinue

$cscCandidates = @(
    (Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"),
    (Join-Path $env:WINDIR "Microsoft.NET\Framework\v4.0.30319\csc.exe")
)

$csc = $cscCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $csc) {
    $globalCsc = Get-Command csc.exe -ErrorAction SilentlyContinue
    if ($globalCsc) {
        $csc = $globalCsc.Source
    }
}

if (-not $csc) {
    throw "C# compiler csc.exe was not found. Install .NET Framework developer tools or Visual Studio Build Tools."
}

& $csc `
    /nologo `
    /target:winexe `
    /platform:x64 `
    /optimize+ `
    /reference:System.Drawing.dll `
    /reference:System.Windows.Forms.dll `
    /win32icon:$controlIconPath `
    /out:$controlExePath `
    $sourcePath

if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Write-Host "Control app created: $controlExePath"
