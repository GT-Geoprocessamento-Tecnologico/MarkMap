# MM-GPS-A67 — consentimento local e GPS atual na abertura

Data: 2026-10-13. Base auditada: `main@9137006d510c2f2882630c49cb248b219135a431`. Nenhum PR aberto.

## Objetivo

Após a pessoa permitir o GPS uma vez, cada abertura do mapa deve consultar o consentimento salvo no IndexedDB **e** a autorização real do sistema, obter posição **atual** do dispositivo e centralizar no GPS, sem solicitar consentimento de novo quando o SO já o concedeu.

## Contexto confirmado

- FUNCIONA: `@capacitor/geolocation` consulta/solicita permissão nativa; `GeolocateControl` e GPS manual no mapa; `offlineDB` possui coleção `permissions`.
- PARCIAL: Configurações já grava `permissions:gps` com `status:granted` e **coordenadas**, mas o mapa não lê esse registro. O botão de mapa não grava consentimento.
- QUEBRADO (fluxo pedido): ao abrir mapa, usa coordenadas padrão/centro de pacote offline; não tenta obter GPS novo quando permissão previamente concedida.
- NÃO IMPLEMENTADO: auto-localização no mapa com prevenção de reprompt e de deslocamento depois de interação/seleção explícita.

## Decisões e regras

1. IndexedDB salva **preferência** `permissions:gps = {status:"granted", autoCenter:true}`, sem coordenadas, token ou dados de GPS. Aceitar registro legado com `status:"granted"`.
2. O registro local **não substitui** a permissão de Android, iOS ou navegador. Reconsultar a autorização do dispositivo; somente auto-localizar quando esta for `granted`. Sem permissão ou API disponível, não provocar popup automático e permitir operação do mapa.
3. GPS com `maximumAge:0`, alta precisão e timeout definido. Não usar coordenada antiga como se fosse atual; sem GPS, manter a visualização vigente.
4. Centralização só enquanto a pessoa não moveu o mapa e não abriu GeoPDF/feição selecionada; não abandonar a região de tiles offline se localização estiver fora dos limites instalados.
5. Clique em Minha localização e Configurações continuam capazes de solicitar permissão pelo gesto do usuário; sucesso grava preferência; revogação pelo sistema prevalece.
6. Sem backend, sem migration remota, sem duplicar banco local, sem rastreamento de localização em background. O mapa segue MapLibre; a posição vem do GPS do aparelho.

## Arquivos previstos

`apps/admin/src/lib/device-location-permission.ts`, módulo mínimo de preferência/GPS em `apps/admin/src/lib`, `apps/admin/src/pages/workspace/CommandCenterPage.tsx`, `apps/admin/src/pages/settings/SettingsPage.tsx`, testes de permissão/GPS, Handoff, Checklist Mestre, AGENTS/CI apenas se necessários.

## Fora do escopo

Alterar tema escolhido, domínio PWA, install popup, banco Neon, servidor Hono, sync/outbox, tiles MapLibre, pacotes offline, rastreamento contínuo, geocodificação remota e publicação/release.

## Segurança

Não guardar histórico nem publicar coordenadas em logs/sync; nunca tratar cache como permissão do SO. Permissão negada/revogada, sensores desligados, operação offline e perda de IndexedDB não podem quebrar o mapa. Evitar sobrepor a visão do usuário depois de pan/zoom, ou a posição de projeto/documento explícito.

## Critérios de aceite

- Primeira entrada sem permissão: mapa abre normalmente sem chamada automática de `getCurrentPosition` nem popup Web.
- Permissão já concedida: nova entrada obtém coordenada fresca e recentraliza o mapa/indicador do dispositivo; nenhuma caixa de autorização extra.
- Sucesso em Minha localização ou Configurações: estado `autoCenter` salvo no IndexedDB (sem coordenadas).
- Revogação/erro/sem GPS: nenhum bypass nem crash, sem centro falsamente atualizado.
- Rota com GeoPDF/seleção, interação manual ou posição fora de pacote offline: preserve foco e tiles.
- Android Capacitor e PWA desktop mantêm funcionamento de permissão adequado às plataformas.

## QA, Git, rollback e handoff

Executar lint, typecheck, testes Vitest (granted/denied/prompt, erro, locais), build Web e, quando possível, Playwright emulado GPS/sem GPS/sem permissão; relatar PASS/FALHOU/NÃO EXECUTADO. CI impedido anteriormente por cobrança. Revalidar HEAD/diff antes do commit na main, sem force push nem exclusão de branches. Rollback normal via revert dos commits A67. Resultado final com SHA, fatos validados, limitações de permissão SO e indicação de QA físico pendente.
