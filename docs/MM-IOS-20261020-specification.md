# MM-IOS-20261020 — Compatibilidade iPhone X e posteriores

## Contrato e baseline

- Pedido: analisar e corrigir a aplicação para iPhone X e modelos posteriores, preservando o front, dados locais e os fluxos existentes.
- O usuário esclareceu que "10" significa o modelo iPhone X, não iOS 10. O cenário antigo relevante é Safari/WebKit do iOS 16 no iPhone X, além dos navegadores atuais.
- Fonte canônica desta entrega: branch `work/prod-araguaina-20261019`, base `50c659d90c1ad8d24076802226b333b9517d2a85`, versão publicada `0.4.2` conferida em `/version.json`.
- Versão reservada pelo coordenador: `0.4.3`. Workers não alteram versões/changelog.
- O checkout original com trabalho pendente permanece preservado. Não usar MAESTRI; especialistas e revisão em subagentes Codex separados.

## Escopo, invariantes e aceitação

Revisar instalação/atualização, seleção/importação/exportação de arquivos, PDF/GeoPDF, mapa/GLB, busca/CEP, altitude/GPS e armazenamento/offline. Corrigir apenas mecanismos incompatíveis demonstrados por código, documentação primária e/ou reprodução. Preservar identidade instalada, APIs, protocolos, schemas locais, pisos de compatibilidade e desenho visual. Não adicionar dependências nem substituir o motor de mapas sem decisão explícita.

A entrega exige regressões focadas que detectem os problemas corrigidos, typecheck/lint/build/guardas de versão, regressão dos módulos afetados, revisão independente e fluxos renderizados em WebKit móvel/iPad e Chrome. Emulação atual e remoção controlada de APIs novas não equivalem a testar fisicamente Safari 16 no iPhone X. Publicar somente o candidato validado, usando a autorização de push/deploy existente, e conferir versão/SHA no domínio oficial.

## Grafo e responsáveis

1. `IOS-AUDIT-*`: quatro análises independentes, somente leitura — importação/PDF; mapas/runtime; shell/armazenamento; QA WebKit.
2. `IOS-SPEC-DONE`: gate aceito pelo coordenador após auditoria independente. Contratos e conjuntos exclusivos de escrita definidos abaixo; implementação autorizada.
3. Builders por superfícies independentes, somente após `IOS-SPEC-DONE`. Testes que compartilham build/dist ou banco são serializados.
4. `IOS-VERIFY`: QA e revisão independentes, correções de bloqueadores, validação integrada do coordenador.
5. `IOS-RELEASE`: versão/changelog, commit/push/deploy, verificação publicada e evidência final externa.

## Riscos e condições de parada

Não confundir APIs ausentes do Safari antigo com indisponibilidade de rede ou limitação do Playwright. Não prometer base nacional de CEP offline ou execução em todas as versões históricas de iOS. Aceleração gráfica, espaço disponível e permissões do usuário continuam necessários. Se uma correção exigir migração destrutiva, troca de engine, dependência nova, assinatura nativa ou dispositivo não disponível, registrar a limitação e não contornar os controles de release.

Artefatos de QA, fixtures sintéticas, screenshots e logs ficam fora do repositório em `%TEMP%/markmap-ios-qa-20261020`.

## Especificação de correções aceita

1. **IOS-PDF — especialista de importação/PDF.** Os imports modernos do PDF.js 6.3.289 chamam `Promise.withResolvers` (Safari 17.4+) e `Promise.try`/base64 (Safari 18.2+). Criar um runtime PDF compartilhado usando os builds `legacy` já instalados, mantendo main e worker na mesma versão. O legacy ainda necessita de `Promise.withResolvers`: fornecer fallback mínimo conforme o contrato ECMAScript, somente quando ausente, executado antes da biblioteca tanto na página quanto no worker. Não substituir implementações nativas, não alterar dependências. Ambos os leitores passam pelo runtime único. Demonstrar leitura/render de PDF/GeoPDF com APIs modernas removidas; verificar worker real e overlay georreferenciado.
2. **IOS-TERRAIN — especialista de mapas.** Preservar decodificação numérica de tiles Terrarium, limites PNG/dimensões/bytes e cache existente. Quando ImageBitmap estiver ausente ou sua decodificação falhar, usar imagem/canvas DOM com URL temporária, limpeza em sucesso/erro, dimensões validadas e erro explícito. Não converter cores ou inventar elevação. Cobrir falha/ausência da API, cálculo esperado independente e caminho moderno. Não alterar motor, pacotes offline ou schemas.
3. **IOS-SHELL — especialista de instalação/armazenamento.** Reconhecer Safari iPadOS em modo desktop (`MacIntel` e múltiplos pontos de toque), preservando distinção de macOS e outros browsers. Cobrir instruções de instalação e standalone. Corrigir documentação que trata a Storage API como garantida antes de Safari 17; manter os fallbacks atuais. Não alterar identidade do app nem permissões/targets nativos por hipótese.
4. **IOS-EXPORT — coordenador.** Manter botões/nomes/bytes. Corrigir revogação imediata de URLs Blob com helper de download que anexa o link ao DOM e libera a URL após janela de consumo. O uso de Web Share, se necessário, exige preservar gesto/cancelamento e regressões; não introduzir automaticamente sem evidência. Verificar exportação real GeoJSON/KML em WebKit. Tratar rejeições de exportação na UI em português, sem prometer conclusão antes do navegador.
5. **IOS-QA — especialista independente.** Fixtures sintéticas de formatos, iPhone X (375×812), iPad e desktop Chrome; identidade, renderização, erros do console, seleção/importação, lista e overlay, download, busca/CEP, navegação, instalação e persistência. Testar matriz com APIs de Safari posteriores ao 16 removidas em página e worker. Não confundir isso com hardware físico.
6. **IOS-PDF-STORAGE — correção adicional aprovada após reprodução.** O teste WebKit real falhou em `originals.add` com `UnknownError: Error preparing Blob/File data to be stored in object store`; PDF não chegou ao leitor. Gravar o ArrayBuffer já lido e validado por SHA-256 em `originalBytes`, no mesmo registro/store, sem migração, remoção ou alteração de versão do banco. Get/list reconstituem o Blob público e continuam lendo registros antigos com Blob. Preservar limites, hash, nomes, isolamento por workspace e idempotência/conflitos. O coordenador possui `local-repositories/index.ts`, seus testes e o suporte de clone de ArrayBuffer no banco em memória. Revisor independente avalia esse delta; repetir PDF real/worker/overlay e a suíte após a correção. Não mascarar quota ou repetir transações com estado ambíguo.

### Exclusividade de escrita

- PDF: `src/lib/pdf/pdf-preview.tsx`, `geopdf-overlay.ts`, novos `pdf-runtime*`/compat e worker PDF, testes PDF relacionados.
- Terreno: `src/lib/elevation/terrain-client.ts` e seus testes.
- Shell: `src/lib/pwa-install.ts`, testes de instalação e comentários em `device-storage-profile.ts`.
- Coordenador: helper de download, dataset-store/ImportsPage e testes de exportação, build target se comprovadamente necessário, versão/changelog/especificação/documentação de compatibilidade.
- QA/revisor: somente scripts e artefatos externos, sem fontes produtivas.

### Limites de suporte documentados

O piso desta validação é iPhone X atualizado na linha iOS 16.7 e modelos posteriores com sistema atualizado. KMZ usa Compression Streams, presente a partir do Safari 16.4; não acrescentar unzip ou compatibilidade para todos os sistemas históricos do mesmo aparelho. O motor exige WebGL2; ausência ou perda do contexto deve ter fallback de erro existente, não engine alternativa. A hipótese de memória em PDF grande e a evicção de armazenamento sob pressão exigem teste físico; não foram tratadas como defeitos reproduzidos.

Fontes primárias: [WebKit 17.4](https://webkit.org/blog/15063/webkit-features-in-safari-17-4/), [WebKit 18.2](https://webkit.org/blog/16301/webkit-features-in-safari-18-2/), [Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/), [iOS 16: aparelhos compatíveis](https://support.apple.com/en-ie/103267).
