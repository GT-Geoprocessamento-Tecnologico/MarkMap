# GeoNexo - PRD Seguranca Visionario

## Track

REVISAO DE MUDANCA

## Missao

Garantir que a fundacao do GeoNexo nasca sem divida critica de seguranca, mesmo antes de existir autenticacao. O objetivo desta fase e proteger banco, API, uploads, segredos, dependencias e pipeline local sem atrasar o MVP.

## FATO

- Aplicacao web sem login nesta fase.
- Backend separado.
- Banco Neon PostgreSQL/PostGIS.
- Deploy Vercel somente no futuro.
- Repositorio GitHub.
- GIS trabalhara com uploads e URLs externas no futuro.

## Principio

Sem auth nao significa sem seguranca.

Nesta fase o sistema e de desenvolvimento local e deve assumir que qualquer input externo e hostil.

## Threat model inicial

### Ator: navegador local malicioso

Vetores:
- payload gigante;
- GeoJSON invalido;
- SQL injection;
- prototype pollution via JSON;
- XSS em properties exibidas no mapa.

Mitigacoes:
- Zod;
- query parametrizada;
- escape/render seguro;
- tamanho maximo de body;
- nunca usar `dangerouslySetInnerHTML` para propriedades de feature.

### Ator: arquivo importado malicioso

Vetores:
- zip bomb;
- arquivo disfaracado;
- shapefile corrompido;
- path traversal em ZIP;
- quantidade absurda de features.

Mitigacoes:
- limite de upload;
- limite de arquivos internos;
- limite de descompressao;
- validar paths;
- MIME + magic bytes quando pratico;
- processar fora de public;
- timeout e cancelamento.

### Ator: URL externa maliciosa

Vetores:
- SSRF futuro em WMS/WFS/style URL;
- acesso a localhost/metadados internos;
- redirect para rede privada.

Mitigacoes:
- nenhuma URL arbitraria server-side nesta fase;
- quando implementar, parser URL + allowlist/protocolo + bloqueio RFC1918/link-local;
- limite de redirects;
- timeout.

### Ator: dependencia comprometida

Mitigacoes:
- lockfile versionado;
- dependabot ou renovate futuro;
- audit automatizado;
- evitar pacotes pequenos desnecessarios;
- preferir projetos maduros e ativos.

## Secrets

Obrigatorio:

```text
.env
.env.local
.env.*.local
```

no `.gitignore`.

`.env.example` contem apenas nomes:

```text
DATABASE_URL=
API_PORT=
ADMIN_ORIGIN=
VITE_API_URL=
```

Nunca incluir URL real do Neon em frontend.

Apenas `VITE_*` pode chegar ao browser e nunca deve conter segredo.

## Neon

### Regras

- DATABASE_URL server-side apenas;
- role de desenvolvimento com privilegio minimo pratico;
- migration usa role apropriada separada no futuro;
- conexao TLS;
- evitar expor Data API publicamente nesta fase;
- PostGIS habilitado via migration controlada;
- snapshots/branches antes de alteracoes arriscadas futuras.

Nao habilitar Neon Auth agora.

## API local

Padrao:
- bind `127.0.0.1` em dev quando possivel;
- CORS somente origem do admin local;
- sem wildcard em producao futura;
- limite de payload;
- request timeout;
- headers seguros;
- requestId.

## Headers

Planejar:

```text
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: DENY
Permissions-Policy
Content-Security-Policy
```

CSP deve considerar Web Workers/WebGL do MapLibre. Testar antes de bloquear `worker-src` necessario.

## XSS em dados GIS

Properties de feature podem conter texto controlado por usuario/importacao.

Regras:
- popup usa React text nodes;
- nao interpretar HTML importado;
- links externos somente com URL validada;
- `target=_blank` sempre `rel=noopener noreferrer`;
- labels e legendas tratadas como texto.

## Geocoding

Nominatim publico deve ser chamado via backend, nao diretamente pelo browser quando implementado.

Motivos:
- controle de rate limit;
- cache;
- provider substituivel;
- identificacao consistente;
- evitar abuso distribuido.

Politica atual exige maximo absoluto de 1 req/s e identificacao valida.

## OSM tiles

Nao depender de `tile.openstreetmap.org` para uso de producao pesado.

OpenFreeMap pode ser provider de desenvolvimento, mas deve existir adapter para troca de fonte.

## Uploads

Nao implementar upload sem estas guardas:

- tamanho maximo configuravel;
- extensoes permitidas;
- content type;
- nome original nunca vira path;
- gerar nome interno UUID;
- ZIP traversal bloqueado;
- contagem e tamanho descompactado limitados;
- erro sanitizado;
- arquivo temporario removido em sucesso/erro.

## Logs

Nunca logar:
- DATABASE_URL;
- token;
- cookie futuro;
- arquivo inteiro;
- payload binario;
- properties potencialmente sensiveis sem necessidade.

Logar:
- requestId;
- route;
- status;
- duration;
- entity ID;
- error code interno seguro.

## Audit trail

Mesmo sem auth:
- entity_type;
- entity_id;
- action;
- request_id;
- timestamps;
- before/after seletivo.

Quando auth chegar, adicionar actor_id sem mudar modelo basico.

## Dependencias

Executar:

```text
pnpm audit
```

Nao corrigir automaticamente breaking change sem revisar changelog.

Secret scanning:
- GitHub secret scanning se disponivel;
- scan local antes de merge;
- nunca commitar `.env`.

## Supply chain

- lockfile obrigatorio;
- evitar instalar pacote apenas por uma funcao trivial;
- nao executar scripts desconhecidos fora de dependencia confiavel;
- revisar licenca de bibliotecas copiadas;
- registrar componentes de terceiros usados diretamente.

## Licencas

Antes de copiar codigo, confirmar LICENSE no commit/tag utilizado.

Preferir permissivas:
- MIT;
- BSD;
- Apache-2.0;
- ISC.

Projetos GPL/AGPL podem ser referencia de arquitetura, mas copiar codigo exige decisao juridica/licenciamento explicita.

## LGPD - preparacao

Nesta fase ainda nao ha usuario final, mas o projeto futuramente pode armazenar:
- coordenadas de fiscais;
- fotos;
- dados de autuados;
- evidencias;
- assinatura;
- historico de localizacao.

Portanto:
- separar evidencia de metadata;
- preparar politica de retencao;
- evitar logs de PII;
- trilha de auditoria;
- controle de acesso deve entrar antes de dados reais de fiscalizacao.

## P0 antes de qualquer deploy externo futuro

Nao publicar na internet enquanto nao existir:
- auth;
- autorizacao;
- rate limit;
- CORS de producao;
- CSP validada;
- politica de secrets;
- banco sem credencial exposta;
- endpoints mutaveis protegidos.

## Checklist do agente

- [ ] `.gitignore` seguro
- [ ] `.env.example` sem valor real
- [ ] nenhum secret no browser
- [ ] CORS restrito
- [ ] body limit
- [ ] Zod em entradas
- [ ] SQL parametrizado
- [ ] popup sem HTML nao confiavel
- [ ] upload spec segura
- [ ] SSRF documentado
- [ ] audit event
- [ ] dependency audit
- [ ] secret scan
- [ ] licencas verificadas antes de copiar

## Definition of Done

- nenhum P0 conhecido;
- nenhuma credencial commitada;
- threat model documentado;
- configuracao local segura;
- regras de upload prontas antes do upload entrar;
- headers planejados/testados;
- dependencias revisadas;
- seguranca nao bloqueia desenvolvimento normal.
