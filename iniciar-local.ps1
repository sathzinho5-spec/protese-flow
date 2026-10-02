$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendEnv = Join-Path $ProjectRoot 'backend\.env'
$VercelUrl = 'https://protese-flow.vercel.app'

if (-not (Test-Path $BackendEnv)) {
  Copy-Item (Join-Path $ProjectRoot 'backend\.env.example') $BackendEnv
  Write-Host 'Arquivo backend\.env criado com configuracao local de desenvolvimento.' -ForegroundColor Cyan
}

$envText = Get-Content -LiteralPath $BackendEnv -Raw
if ($envText -match '(?m)^FRONTEND_URL=http://localhost:5173\s*$') {
  $envText = [regex]::Replace($envText, '(?m)^FRONTEND_URL=.*$', "FRONTEND_URL=$VercelUrl")
  [IO.File]::WriteAllText($BackendEnv, $envText, [Text.UTF8Encoding]::new($false))
}

if (-not (Test-Path (Join-Path $ProjectRoot 'backend\node_modules'))) {
  Write-Host 'Instalando dependencias do backend...'
  Push-Location (Join-Path $ProjectRoot 'backend')
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
  $envText = Get-Content -LiteralPath $BackendEnv -Raw
  if ($envText -match '(?m)^EVOLUTION_API_KEY=dev-evolution-key-change-me\s*$') {
    $secureKey = Read-Host 'Informe a chave da Evolution (entrada oculta; ela fica somente em backend\.env)' -AsSecureString
    $keyPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
    try { $evolutionKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPtr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPtr) }
    $envText = [regex]::Replace($envText, '(?m)^EVOLUTION_API_KEY=.*$', ('EVOLUTION_API_KEY=' + $evolutionKey))
    [IO.File]::WriteAllText($BackendEnv, $envText, [Text.UTF8Encoding]::new($false))
    $evolutionKey = $null
  }
  Write-Host 'A chave EVOLUTION_API_KEY precisa ser a mesma configurada nessa Evolution.' -ForegroundColor Yellow
} else {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Pop-Location
    Write-Host 'Docker Desktop nao foi encontrado e nao ha Evolution em localhost:8080.' -ForegroundColor Red
    exit 1
  }
  try {
    docker info *> $null
    if ($LASTEXITCODE -ne 0) { throw 'Docker parado' }
  } catch {
    Pop-Location
    Write-Host 'Abra o Docker Desktop, aguarde iniciar e tente novamente.' -ForegroundColor Yellow
    exit 1
  }
  docker compose --env-file (Join-Path $ProjectRoot 'backend\.env') up -d
  if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }
}
Pop-Location

$BackendDir = Join-Path $ProjectRoot 'backend'
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$BackendDir'; npm run dev"

Start-Sleep -Seconds 2
Start-Process $VercelUrl
Write-Host "Painel Vercel: $VercelUrl | API local: http://localhost:3001 | Evolution API: http://localhost:8080" -ForegroundColor Green
Write-Host 'Para desligar a Evolution, execute: docker compose down' -ForegroundColor DarkGray
