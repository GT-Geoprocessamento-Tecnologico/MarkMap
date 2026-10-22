# MM-VERSION-20261020 — versão obrigatória por atualização publicada

Status: **SPECIFICATION GATE — DONE.** Root pode implementar os guards e a primeira correção de release.

## Objetivo

Toda atualização publicada do app deve reservar e declarar um número `MAJOR.MINOR.PATCH` maior que a versão publicada anterior. SHA, horário de build, sufixo `-dev` ou mudança de conteúdo do shell não substituem incremento numérico. A primeira versão estável que identifica o conjunto de funcionalidades já publicado como `0.2.0-dev.0` é `0.3.0`, conforme decisão do Root.

## Fonte e superfícies obrigatórias

- Fonte canônica: `apps/admin/package.json`, campo `version`.
- Para release, o valor deve ser exatamente semver estável `MAJOR.MINOR.PATCH`; versões de desenvolvimento continuam permitidas em builds locais.
- Cada release deve adicionar em `CHANGELOG.md` uma entrada com versão, data, mudanças e evidência de testes/build.
- O mesmo `MAJOR.MINOR.PATCH` deve aparecer no rodapé/Settings derivado do pacote, no `dist/version.json` e nos metadados de distribuição. `buildSha`, `buildTime` e hash do shell continuam metadados auxiliares.
- `apps/site` permanece produto separado; a regra se aplica ao app publicado e não autoriza copiar assets, cache, IndexedDB ou identidade PWA.

## Guard de release

O Root deve adicionar uma guarda compartilhada no `vite build`/plugin e no fluxo de publicação. Ela deve:

1. Ler `apps/admin/package.json` e rejeitar ausência, formato inválido, pré-release ou valor não numérico no build de distribuição. O `buildStart` do plugin deve executar essa checagem em qualquer `vite build`; `vite dev` não é publicação.
2. No fluxo real de publicação via API do Vercel, buscar o `/version.json` oficial publicado, com deadline de 10 segundos e limite de resposta de 64 KiB. Exigir JSON válido e versão numérica; `0.2.0-dev.0` pode ser interpretado como baseline legado `0.2.0`.
3. Comparar semver: a versão estável candidata precisa ser maior que a baseline oficial. O primeiro release desta linha deve usar `0.3.0` contra a baseline `0.2.0`.
4. Permitir uma ref local explícita (`--base-ref`/equivalente) apenas para revisão e CI offline. Se a baseline oficial estiver ausente, inválida, indisponível ou a ref explícita não resolver, o fluxo de produção falha fechado; não usar SHA, data ou valor padrão.
5. Permitir redeploy técnico do mesmo SHA com a mesma versão já publicada. Isso é retry idempotente, não uma nova atualização; versão igual com SHA diferente falha.
6. Verificar que `dist/version.json.appVersion`, pacote e superfície de créditos/manifest de distribuição concordam após o build, e exigir a entrada correspondente em `CHANGELOG.md` com versão, data, mudanças e evidência.

O coordenador reserva a versão uma vez por release antes de delegar. Workers paralelos não alteram a versão nem criam versões concorrentes; mudanças posteriores ao valor reservado exigem nova decisão do coordenador.

## Critérios de aceitação

1. Uma publicação com `0.3.0` contra baseline oficial `0.2.0` passa; `0.2.0`, `0.2.0-dev.1`, versão ausente ou SHA diferente com a mesma versão falham.
2. Baseline oficial ausente, ilegível, excedendo 64 KiB ou indisponível após 10 segundos falha fechado no fluxo de produção.
3. Um build local direto exige versão estável atual e entrada exata no `CHANGELOG.md`; não exige bump adicional quando o HEAD já corresponde ao release reservado. Preview/dev não executam publicação.
4. Pacote, rodapé/Settings, `version.json` e manifest de distribuição expõem o mesmo número estável.
5. O changelog registra `0.3.0`, data, alterações do release e comandos/evidências reais.
6. O teste cobre comparação major/minor/patch, pré-release, baseline oficial ausente/timeout/64 KiB, retry do mesmo SHA, contexto local e concordância pós-build.

## Tarefas e dependências

| ID | Responsável | Entrega | Dependência |
|---|---|---|---|
| VER-01 | Root | Guard de versão e comparação com base no CI, fail closed somente em release. | esta especificação |
| VER-02 | Root | Reservar `0.3.0`, atualizar pacote e superfícies geradas sem editar workers paralelos. | VER-01 |
| VER-03 | Root | Entrada `CHANGELOG.md` com evidências verificáveis. | VER-02 |
| VER-04 | QA independente | Testar guard, build e concordância de artefatos no SHA final. | VER-01–03 |

## Riscos e parada

Parar se não houver uma base publicada identificável, se qualquer superfície divergir, se a versão candidata for pré-release no job de produção, ou se a entrada do changelog não puder apontar para testes executados. Não aceitar uma solução que derive a versão de SHA, relógio, hash do shell ou texto de build.
