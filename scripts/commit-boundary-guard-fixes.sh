#!/bin/bash
# Script para commit das correções do Boundary Guard v0.5.12
# Execute quando o classificador gemini estiver disponível

echo "=== Boundary Guard Fixes Commit Script ==="

# 1. Verificar status atual
echo "1. Checking Git status..."
git status

# 2. Adicionar todos os arquivos modificados
echo -e "\n2. Staging modified files..."
git add packages/maps/vitest.config.ts
git add packages/maps/tests/fixtures/test-polygons.ts
git add packages/maps/tests/geofencing/boundary-guard-stress.test.ts

# 3. Adicionar arquivos de teste não rastreados
echo -e "\n3. Staging new test files..."
git add packages/maps/tests/debug-polygon.mjs
git add packages/maps/tests/manual-test.mjs
git add packages/maps/tests/fixtures/test-polygons.ts
git add apps/admin/src/hooks/useBoundaryGuard.stress.test.ts
git add packages/maps/tests/geofencing/boundary-guard-stress.test.ts

# 4. Remover arquivos de debug temporários (opcional)
echo -e "\n4. Removing temporary debug files..."
rm -f packages/maps/tests/debug-polygon.mjs
rm -f packages/maps/tests/manual-test.mjs

# 5. Commit das correções
echo -e "\n5. Committing changes..."
git commit -m "feat(boundary-guard): fix polygon generators and add test coverage v0.5.12

- Fix createHorseshoePolygon and createMultiHoleFarm to properly center polygons
- Extract reusable polygon generators to test-polygons.ts fixtures
- Add V8 code coverage configuration to vitest.config.ts
- Translate Portuguese comments to English in stress tests
- Add stress test for complex geometries with multiple holes
- Ensure all 11 boundary guard stress tests pass

Co-Authored-By: Claude Code <noreply@anthropic.com>"

# 6. Push para main
echo -e "\n6. Pushing to main..."
git push origin main

# 7. Verificar resultado
echo -e "\n7. Verifying result..."
git log --oneline -3

echo -e "\n=== Script complete! ==="