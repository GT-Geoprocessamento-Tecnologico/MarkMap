# Script simples para push do main
# Apenas sincroniza o main local com o remoto

Write-Host "=== Push Main Branch ===" -ForegroundColor Cyan

# 1. Verificar ramo atual
Write-Host "`n1. Current branch:" -ForegroundColor Yellow
$currentBranch = git branch --show-current
Write-Host "You are on: $currentBranch" -ForegroundColor Green

if ($currentBranch -ne "main") {
    Write-Host "Switching to main..." -ForegroundColor Yellow
    git checkout main
}

# 2. Verificar status
Write-Host "`n2. Checking status..." -ForegroundColor Yellow
git status

# 3. Pull do remoto (garantir que está atualizado)
Write-Host "`n3. Pulling latest changes from origin/main..." -ForegroundColor Yellow
git pull origin main

# 4. Push para o remoto
Write-Host "`n4. Pushing to origin/main..." -ForegroundColor Yellow
git push origin main

# 5. Verificar resultado
Write-Host "`n5. Verification:" -ForegroundColor Yellow
git log --oneline -3
git status

Write-Host "`n=== Push Complete ===" -ForegroundColor Green