# Script completo para limpar ramos e PRs
# Execute este script para verificar e limpar o repositório

Write-Host "=== Complete Git Cleanup Script ===" -ForegroundColor Cyan

# 1. Verificar ramo atual
Write-Host "`n1. Current branch:" -ForegroundColor Yellow
$currentBranch = git branch --show-current
Write-Host "You are on: $currentBranch" -ForegroundColor Green

# 2. Listar TODOS os ramos (local e remoto)
Write-Host "`n2. All branches (local and remote):" -ForegroundColor Yellow
git branch -a

# 3. Fetch do remoto e limpar referências antigas
Write-Host "`n3. Fetching from remote and pruning..." -ForegroundColor Yellow
git fetch --all --prune

# 4. Verificar ramos já merged no main
Write-Host "`n4. Branches already merged into main:" -ForegroundColor Yellow
$mergedBranches = git branch --merged main | Where-Object { $_ -notmatch '\*' -and $_ -notmatch 'main' }
if ($mergedBranches) {
    $mergedBranches
} else {
    Write-Host "No merged branches to clean up" -ForegroundColor Green
}

# 5. Perguntar se quer deletar ramos merged
if ($mergedBranches) {
    Write-Host "`n5. Delete merged branches? (y/n)" -ForegroundColor Yellow
    $response = Read-Host
    if ($response -eq 'y') {
        foreach ($branch in $mergedBranches) {
            $cleanBranch = $branch.Trim()
            Write-Host "Deleting local branch: $cleanBranch" -ForegroundColor Red
            git branch -d $cleanBranch
        }
    }
}

# 6. Listar PRs abertos (requer gh CLI)
Write-Host "`n6. Checking for open PRs (requires gh CLI)..." -ForegroundColor Yellow
$ghInstalled = Get-Command gh -ErrorAction SilentlyContinue
if ($ghInstalled) {
    gh pr list
} else {
    Write-Host "GitHub CLI (gh) not installed. Install from: https://cli.github.com/" -ForegroundColor Yellow
    Write-Host "Alternatively, check PRs at: https://github.com/mmatteuus/MarkMap/pulls" -ForegroundColor Cyan
}

# 7. Status final
Write-Host "`n7. Final status:" -ForegroundColor Yellow
git status

Write-Host "`n=== Cleanup Complete ===" -ForegroundColor Green
Write-Host "`nManual steps if needed:" -ForegroundColor Cyan
Write-Host "- Close PRs: gh pr close <number> or use GitHub web"
Write-Host "- Delete remote branch: git push origin --delete <branch-name>"
Write-Host "- View PRs: https://github.com/mmatteuus/MarkMap/pulls"