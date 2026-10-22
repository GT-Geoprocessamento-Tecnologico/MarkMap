# Changelog documental

Este arquivo registra mudanças relevantes e não substitui tags/releases oficiais.

O registro canônico de versões do aplicativo é [CHANGELOG.md](../CHANGELOG.md), seguindo a [política de versionamento](versioning.md). Este arquivo preserva o histórico documental anterior.

## 2026-10-03

### PWA e qualidade

- manifest, service worker, cold offline e upgrade IndexedDB validados;
- E2E de duas instalações estabilizado com transições reais offline→online;
- adicionados dependency audit, scanner de secrets e Lighthouse/a11y ao CI.

### GIS/GeoPDF

- adicionada auto-calibração offline por texto de grade geográfica ou SIRGAS/UTM;
- aceitação automática condicionada a R², residual, cobertura e confiança;
- transformação UTM validada para WGS84;
- fallback manual preservado quando o resultado automático não é confiável.

### Sync e segurança

- retry/idempotência/pull/conflito cobertos em dois contextos isolados;
- rate limit distribuído no PostgreSQL;
- storage presign exige capability e namespace por workspace;
- rotas diretas de domínio permanecem desabilitadas em production.

### Documentação

- comentários legados do cliente HTTP corrigidos;
- status/handoff/checklist alinhados ao estado real;
- adicionado runbook de release/rollback;
- política de privacidade documenta explicitamente os dados externos ainda necessários.
