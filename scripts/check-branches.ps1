# Script para verificar e limpar ramos Git
# Verificar status de ramos e PRs

Write-Host "=== Git Branch Cleanup ===" -ForegroundColor Cyan

# 1. Listar todos os ramos locais
Write-Host "`n1. Local branches:" -ForegroundColor Yellow
git branch -vv

# 2. Listar todos os ramos remotos
Write-Host "`n2. Remote branches:" -ForegroundColor Yellow
git branch -r

# 3. Verificar ramos merged
Write-Host "`n3. Merged branches:" -ForegroundColor Yellow
git branch --merged main

# 4. Verificar ramos não merged
Write-Host "`n4. Unmerged branches:" -ForegroundColor Yellow
git branch --no-merged main

# 5. Fetch e prune ramos remotos deletados
Write-Host "`n5. Fetching and pruning..." -ForegroundColor Yellow
git fetch --prune

# 6. Mostrar status atual
Write-Host "`n6. Current status:" -ForegroundColor Yellow
git status

Write-Host "`n=== Analysis Complete ===" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "- To delete a local branch: git branch -d <branch-name>"
Write-Host "- To force delete: git branch -D <branch-name>"
Write-Host "- To delete remote branch: git push origin --delete <branch-name>"
Write-Host "- To close PR: Use GitHub web interface or gh CLI"