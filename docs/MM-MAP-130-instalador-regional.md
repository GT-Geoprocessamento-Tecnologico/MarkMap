# MM-MAP-130 — Download regional verificável (parcial)

**Status (2026-10-09): PARCIAL.** O instalador anterior rejeitava toda transferência, após auditoria revelar download simulado.

## Fluxo implementado neste incremento

1. Manifest estrito com `archivePath` apenas transitório e `baseUrl` HTTPS do catálogo.
2. Verificação de identidade, paths, checksums e tamanhos; orçamento de espaço e limite temporário de rede 64 MiB.
3. `verified-range-download.mjs`: baixa chunks por Range, valida 206/Content-Range ou 200 completo, grava chunks em `MarkMapRegionalDownloads` antes de notificar progresso.
4. Após queda de rede, `checkResume` identifica chunks locais; novos `startInstall` reutilizam bytes para o mesmo checksum/assinatura da versão.
5. SHA-256 final e `validateOfflinePackage`. Só então `OfflineMapStore.install` faz staging/ativação. Falhas não atingem o pacote ativo.
6. Com `forceValidate` autorizado, descarta chunks de versão anterior. Sem autorização, retorna erro.

Testes Node executados: 4/4 (resume, checksum corrompido, 200 fallback e Content-Range/abort). TypeScript verificado com stubs temporários para dependências externas; **não equivale a typecheck no monorepo**. Browser IndexedDB headless: tentativa expirou, **sem aprovação**.

**Pendente antes de concluir:** catálogo de URLs reais/CORS, publicação de catálogo e UX de atualização de regiões, leitura por faixa/streaming do arquivo grande no pacote final, E2E com persistência IndexedDB e teste de PBF real. Não prometer download de regiões grandes nem conclusão MM-MAP-130.

**Uso:** `new ResumableInstaller().startInstall({ packageId, manifest: { ...manifest, archivePath: 'package.pmtiles' }, baseUrl: 'https://.../region/', forceValidate: false })`. A fonte deve servir todos os arquivos referenciados no manifest. O método não ativa nada se um checksum falhar.
