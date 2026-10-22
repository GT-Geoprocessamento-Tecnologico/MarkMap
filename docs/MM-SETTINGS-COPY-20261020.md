# MM-SETTINGS-COPY-20261020

Especificação aprovada: **DONE**. Versão reservada pelo coordenador: **0.3.2** (PATCH), sobre `32215c607a1991f293fcfa752f233c26017945bc` / versão publicada `0.3.1`.

Objetivo: retirar a frase “Aberto como aplicativo instalado.” de Configurações → Aplicativo no dispositivo.

Contrato: renderizar o parágrafo de orientação somente quando `installState.installed` for falso. Preservar os dois textos de instalação no navegador, título, versão, botão, estados e handlers. Não deixar parágrafo vazio nem alterar instalação, atualização, dados locais, identidade, protocolos ou schemas. O checkout original com alterações em andamento permanece preservado.

Grafo: revisão independente da especificação → edição pontual pelo coordenador → TypeScript, teste existente de configurações, verificações de fronteira e build/guard → revisão independente do diff e QA no navegador → commit/push/deploy autorizado → versão/SHA no domínio e conferência no aplicativo Windows real.

Aceitação: frase ausente na instalação; botão de atualizar e versão presentes; orientação e botão de instalar preservados no navegador. Não publicar se guard, build, revisão ou QA falharem, se houver divergência da linha publicada ou mudança fora do escopo.

Risco baixo: apresentação condicional de um parágrafo. QA usa contextos isolados no navegador e leitura da instalação existente, sem limpeza ou migração de dados. A evidência final será registrada no changelog e no relatório externo desta entrega.
