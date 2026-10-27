# Script para commit das correções do Boundary Guard v0.5.12
# Execute quando o classificador gemini estiver disponível

Write-Host "=== Boundary Guard Fixes Commit Script ===" -ForegroundColor Cyan

# 1. Verificar status atual
Write-Host "`n1. Checking Git status..." -ForegroundColor Yellow
git status

# 2. Adicionar todos os arquivos modificados
Write-Host "`n2. Staging modified files..." -ForegroundColor Yellow
git add packages/maps/vitest.config.ts
git add packages/maps/tests/fixtures/test-polygons.ts
git add packages/maps/tests/geofencing/boundary-guard-stress.test.ts

# 3. Adicionar arquivos de teste não rastreados
Write-Host "`n3. Staging new test files..." -ForegroundColor Yellow
git add packages/maps/tests/debug-polygon.mjs
git add packages/maps/tests/manual-test.mjs
git add apps/admin/src/hooks/useBoundaryGuard.stress.test.ts

# 4. Remover arquivos de debug temporários
Write-Host "`n4. Removing temporary debug files..." -ForegroundColor Yellow
if (Test-Path "packages/maps/tests/debug-polygon.mjs") {
    Remove-Item "packages/maps/tests/debug-polygon.mjs"
}
if (Test-Path "packages/maps/tests/manual-test.mjs") {
    Remove-Item "packages/maps/tests/manual-test.mjs"
}

# 5. Commit das correções
Write-Host "`n5. Committing changes..." -ForegroundColor Yellow
git commit -m @'
feat(boundary-guard): fix polygon generators and add test coverage v0.5.12

- Fix createHorseshoePolygon and createMultiHoleFarm to properly center polygons
- Extract reusable polygon generators to test-polygons.ts fixtures
- Add V8 code coverage configuration to vitest.config.ts
- Translate Portuguese comments to English in stress tests
- Add stress test for complex geometries with multiple holes
- Ensure all 11 boundary guard stress tests pass

Co-Authored-By: Claude Code <noreply@anthropic.com>
'@

# 6. Push para main
Write-Host "`n6. Pushing to main..." -ForegroundColor Yellow
git push origin main

# 7. Verificar resultado
Write-Host "`n7. Verifying result..." -ForegroundColor Yellow
git log --oneline -3

Write-Host "`n=== Script complete! ===" -ForegroundColor Green