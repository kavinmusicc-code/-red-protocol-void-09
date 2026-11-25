param(
    [string]$TargetDir = "$HOME\Desktop\red-protocol-void-09",
    [string]$RepoUrl = "https://github.com/kavinmusicc-code/-red-protocol-void-09.git"
)

if ($env:OS -ne "Windows_NT") {
    Write-Host "Yeh installer sirf Windows Desktop ke liye hai." -ForegroundColor Red
    exit 1
}

Write-Host "=== VOID-09 DESKTOP INSTALLER (WINDOWS) ===" -ForegroundColor Red

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Git nahi mila. Pehle Git install karein." -ForegroundColor Yellow
    exit 1
}

if (Test-Path (Join-Path $TargetDir ".git")) {
    Write-Host "Existing repo mila. Latest updates pull kar raha hoon..." -ForegroundColor Cyan
    git -C $TargetDir pull origin main
} else {
    Write-Host "Repository download (clone) kar raha hoon..." -ForegroundColor Cyan
    git clone $RepoUrl $TargetDir
}

$binDir = Join-Path $HOME ".void09"
if (-not (Test-Path $binDir)) {
    New-Item -ItemType Directory -Path $binDir -Force | Out-Null
}

$runnerPath = Join-Path $binDir "void09.ps1"
@"
Set-Location "$TargetDir"
git pull origin main
Write-Host "VOID-09 updated at $TargetDir" -ForegroundColor Green
"@ | Set-Content -Path $runnerPath -Encoding UTF8

if (-not (Test-Path $PROFILE)) {
    New-Item -ItemType File -Path $PROFILE -Force | Out-Null
}
$aliasLine = "Set-Alias -Name void09 -Value `"$runnerPath`""
if (-not (Select-String -Path $PROFILE -Pattern "Set-Alias -Name void09" -Quiet)) {
    Add-Content -Path $PROFILE -Value $aliasLine
}

Write-Host "Windows Desktop installation complete! Naye PowerShell mein 'void09' likh kar update kar sakte hain." -ForegroundColor Green