# Documentação da Aplicação GeoNexo

Esta pasta contém a documentação completa da aplicação, tanto **técnica** quanto **não‑técnica**. O objetivo é oferecer um guia claro para desenvolvedores, usuários finais, e partes interessadas.

## Estrutura da pasta `docs`

```
/docs
├─ overview.md                 # Visão geral do produto (não‑técnica)
├─ architecture.md            # Diagrama e explicação da arquitetura (técnica)
├─ setup.md                    # Guia de configuração local (instalação, dependências)
├─ development.md              # Fluxo de desenvolvimento (branching, CI, testes)
├─ deployment.md               # Estratégia de deploy (web, Android, iOS)
├─ user‑guide.md               # Manual do usuário final (uso da app)
├─ api‑reference.md            # Documentação das APIs REST (se houver)
├─ data‑model.md               # Modelo de dados (Entidades, relacionamentos)
├─ sync‑flow.md                # Descrição detalhada do fluxo de sincronização offline‑first
├─ troubleshooting.md          # Guia de resolução de problemas comuns
└─ changelog.md                # Histórico de versões e alterações
```

---

## Conteúdo dos arquivos

### `overview.md`
- Descrição de alto nível da aplicação (objetivo, público‑alvo).
- Principais funcionalidades (mapas interativos, captura GPS, GeoPDF, offline‑first).
- Benefícios e casos de uso.

### `architecture.md`
- Diagrama da arquitetura (frontend, backend Neon, camada de sync, camada nativa).
- Detalhes das tecnologias (React, Vite, Capacitor, MapLibre, Neon).
- Explicação do fluxo de dados: UI → Store → Sync Engine → Neon.

### `setup.md`
- Pré‑requisitos (Node ≥ 18, pnpm, Android SDK, Xcode para iOS, Neon account).
- Passos para clonagem, instalação de dependências (`pnpm install`).
- Configuração de arquivos `.env` (variáveis de conexão Neon, chaves de API).

### `development.md`
- Estratégia de branch (`main` como produção, `feature/*` para novas funcionalidades).
- Uso do TurboRepo para cache de builds e testes.
- Como executar testes unitários, de integração e E2E.
- Como rodar o app no emulador Android ou simulador iOS.

### `deployment.md`
- Build da web (`pnpm build`).
- geração de APK Android (`pnpm exec cap add android && pnpm exec cap sync android && ./gradlew assembleDebug`).
- Build iOS (`pnpm exec cap add ios && pnpm exec cap sync ios && xcodebuild …`).
- Deploy no Vercel / Netlify (opcional) e no Google Play Store.

### `user‑guide.md`
- Passo‑a‑passo de uso da aplicação (login, seleção de projeto, captura de coordenadas, desenho de feições, sincronização).
- Capturas de tela e descrições de cada tela principal.
- Como lidar com permissões de localização e armazenamento.

### `api‑reference.md`
- Listagem de endpoints (se houver backend custom): `/api/projects`, `/api/layers`, `/api/features`, `/api/sync`.
- Exemplos de request/response (JSON).  
- Autenticação (Bearer token via Neon Auth).

### `data‑model.md`
- Diagrama ER (Entidades: `Project`, `Layer`, `Feature`, `User`, `SyncLog`).
- Campos principais, tipos e índices.
- Estratégia de versionamento e migration (Neon branching).

### `sync‑flow.md`
- **Fluxo offline‑first** detalhado:
  1. Usuário realiza ação (ex.: desenha polígono).
  2. Ação é armazenada no IndexedDB como “mutation”.
  3. React Query atualiza a UI otimisticamente.
  4. Quando o dispositivo volta online, o `SyncEngine` coleta todas as mutações pendentes.
  5. Envia um batch ao endpoint `/api/sync` (ou direta ao Neon via RPC).
  6. Recebe confirmação, resolve conflitos (última escrita vence ou política custom).
  7. Atualiza o cache local e limpa a fila.
- Diagrama de sequência (ilustração textual).

### `troubleshooting.md`
- Problemas comuns: permissão GPS negada, falha de sync, erros de build Android/iOS.
- Passos de diagnóstico (logs, `adb logcat`, `xcodebuild` output).
- Como reiniciar a fila de sync.

### `changelog.md`
- Formato padrão **Keep a Changelog**.
- Versionamento semântico (v1.0.0, v1.1.0, …).
- Entradas para cada release (features, bugs, breaking changes).

---

## Como gerar a documentação

1. **Markdown** – Todos os arquivos acima são Markdown, editáveis com qualquer editor.
2. **Gerador de site** (opcional) – Use `mkdocs` ou `docsite` para transformar a pasta `docs` em um site estático.
   ```bash
   pip install mkdocs mkdocs-material
   mkdocs serve   # visualiza em http://127.0.0.1:8000
   ```
3. **Publicação** – O diretório `docs` pode ser publicado no GitHub Pages (caminho `docs/` no repositório) ou integrado ao Vercel.

---

## Manutenção da documentação

- Atualize `changelog.md` a cada release.
- Sempre que uma nova feature for adicionada, inclua seu fluxo no `architecture.md` e descreva no `user‑guide.md`.
- Revisite o `troubleshooting.md` após incidentes de suporte.
- Use **pull‑request templates** para garantir que alterações de código venham acompanhadas de atualizações de documentação.

---

## Conclusão

Esta pasta `docs` fornece tudo que é necessário para que desenvolvedores, testadores e usuários finais entendam e utilizem a GeoNexo de forma eficaz. Mantenha‑a sincronizada com o código‑fonte e revisite regularmente para garantir que reflita o estado atual da aplicação.
# README\n\n> _Conteúdo está sendo desenvolvido._
