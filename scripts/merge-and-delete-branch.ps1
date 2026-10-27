# Script para verificar e mesclar o ramo remoto fix/backup-restore-outbox-conflicts-20261027
# e depois deletá-lo

Write-Host "=== Merge and Delete Remote Branch ===" -ForegroundColor Cyan

$remoteBranch = "fix/backup-restore-outbox-conflicts-20261027"

# 1. Garantir que estamos no main
Write-Host "`n1. Ensuring we are on main branch..." -ForegroundColor Yellow
git checkout main
git pull origin main

# 2. Verificar diferenças entre main e o ramo remoto
Write-Host "`n2. Checking differences between main and $remoteBranch..." -ForegroundColor Yellow
Write-Host "Commits in remote branch not in main:" -ForegroundColor Cyan
git log main..origin/$remoteBranch --oneline

$commitCount = (git rev-list main..origin/$remoteBranch --count)
Write-Host "`nTotal commits ahead: $commitCount" -ForegroundColor $(if ($commitCount -eq "0") {"Green"} else {"Yellow"})

if ($commitCount -eq "0") {
    Write-Host "`nNo new commits in $remoteBranch. Safe to delete." -ForegroundColor Green

    # 3. Deletar o ramo remoto
    Write-Host "`n3. Delete remote branch? (y/n)" -ForegroundColor Yellow
    $response = Read-Host
    if ($response -eq 'y') {
        Write-Host "Deleting remote branch: origin/$remoteBranch" -ForegroundColor Red
        git push origin --delete $remoteBranch
        Write-Host "Remote branch deleted successfully!" -ForegroundColor Green
    }
} else {
    Write-Host "`n$remoteBranch has $commitCount commit(s) not in main." -ForegroundColor Yellow
    Write-Host "`nOptions:" -ForegroundColor Cyan
    Write-Host "1. Merge the branch into main (recommended if changes are needed)"
    Write-Host "2. Delete anyway (discard changes)"
    Write-Host "3. Cancel (keep branch)"

    $choice = Read-Host "`nEnter choice (1/2/3)"

    switch ($choice) {
        "1" {
            Write-Host "`nFetching and merging $remoteBranch into main..." -ForegroundColor Yellow
            git fetch origin $remoteBranch
            git merge origin/$remoteBranch --no-ff -m "Merge $remoteBranch into main

Co-Authored-By: Claude Code <noreply@anthropic.com>"

            Write-Host "`nMerge complete! Pushing to origin..." -ForegroundColor Green
            git push origin main

            Write-Host "`nNow deleting remote branch..." -ForegroundColor Yellow
            git push origin --delete $remoteBranch
            Write-Host "Remote branch deleted!" -ForegroundColor Green
        }
        "2" {
            Write-Host "`nDeleting remote branch (discarding changes)..." -ForegroundColor Red
            git push origin --delete $remoteBranch
            Write-Host "Remote branch deleted!" -ForegroundColor Green
        }
        "3" {
            Write-Host "`nCancelled. Branch kept." -ForegroundColor Yellow
        }
    }
}

# 4. Status final
Write-Host "`n4. Final branch status:" -ForegroundColor Yellow
git branch -a

Write-Host "`n=== Complete ===" -ForegroundColor Green