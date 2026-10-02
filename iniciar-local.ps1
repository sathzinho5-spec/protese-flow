$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Host 'Docker Desktop nao foi encontrado. Instale e abra o Docker Desktop e tente novamente.' -ForegroundColor Red
  exit 1
}

try {
  docker info *> $null
  if ($LASTEXITCODE -ne 0) { throw 'Docker parado' }
} catch {
  Write-Host 'Abra o Docker Desktop, aguarde aparecer como iniciado e execute este arquivo novamente.' -ForegroundColor Yellow
  exit 1
}

if (-not (Test-Path (Join-Path $ProjectRoot 'backend\.env'))) {
  Copy-Item (Join-Path $ProjectRoot 'backend\.env.example') (Join-Path $ProjectRoot 'backend\.env')
  Write-Host 'Arquivo backend\.env criado com configuracao local de desenvolvimento.' -ForegroundColor Cyan
}

if (-not (Test-Path (Join-Path $ProjectRoot 'backend\node_modules'))) {
  Write-Host 'Instalando dependencias do backend...'
  Push-Location (Join-Path $ProjectRoot 'backend')
  npm install
  if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }
  Pop-Location
}

if (-not (Test-Path (Join-Path $ProjectRoot 'frontend\node_modules'))) {
  Write-Host 'Instalando dependencias do painel...'
  Push-Location (Join-Path $ProjectRoot 'frontend')
  npm install
  if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }
  Pop-Location
}

Push-Location $ProjectRoot
$existingEvolution = $false
try {
  $null = Invoke-WebRequest -Uri 'http://localhost:8080' -TimeoutSec 3 -UseBasicParsing
  $existingEvolution = $true
} catch {
  if ($_.Exception.Response) { $existingEvolution = $true }
}

if ($existingEvolution) {
  Write-Host 'Evolution API ja esta respondendo em localhost:8080; vou reutilizar essa instancia.' -ForegroundColor Cyan
  Write-Host 'Confirme que EVOLUTION_API_KEY em backend\.env e a mesma chave configurada nessa Evolution.' -ForegroundColor Yellow
} else {
  docker compose --env-file (Join-Path $ProjectRoot 'backend\.env') up -d
  if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }
}
Pop-Location

$BackendDir = Join-Path $ProjectRoot 'backend'
$FrontendDir = Join-Path $ProjectRoot 'frontend'
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$BackendDir'; npm run dev"
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$FrontendDir'; npm run dev -- --host 127.0.0.1"

Start-Sleep -Seconds 2
Start-Process 'http://localhost:5173'
Write-Host 'Painel: http://localhost:5173 | Evolution API: http://localhost:8080' -ForegroundColor Green
Write-Host 'Para desligar a Evolution, execute: docker compose down' -ForegroundColor DarkGray
