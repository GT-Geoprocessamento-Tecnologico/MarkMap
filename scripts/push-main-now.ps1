# Push main branch to origin
Write-Host "Pushing main branch to origin..." -ForegroundColor Cyan

git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Push completed successfully!" -ForegroundColor Green
} else {
    Write-Host "`n❌ Push failed!" -ForegroundColor Red
}

# Show current status
Write-Host "`nCurrent status:" -ForegroundColor Cyan
git status
