# Política de versionamento do app

O app publicado usa `MAJOR.MINOR.PATCH` em `apps/admin/package.json`. Toda publicação incrementa esse número em relação à última versão publicada: `PATCH` corrige comportamento sem alterar contrato, `MINOR` adiciona capacidade compatível, e `MAJOR` quebra contrato ou exige migração incompatível. O coordenador também deve confirmar que o candidato contém o código da linha de release autorizada; um checkout antigo não pode publicar apenas por escolher um número maior.

Uma mudança de SHA, horário, hash do shell, sufixo de desenvolvimento ou conteúdo de build não é uma versão. O rodapé e Settings exibem a forma estável `vMAJOR.MINOR.PATCH`; o `version.json` e os metadados de distribuição devem concordar com o pacote candidato e podem carregar SHA/horário como campos auxiliares.

O coordenador do release reserva o número uma vez antes do trabalho paralelo. Workers não bumpam a versão individualmente. A entrada de `CHANGELOG.md` é obrigatória e contém versão, data, mudanças e evidência de testes/build.

O `vite build` executa a guarda de versão; `vite dev` e preview não são publicação. O build exige versão estável e entrada correspondente no `CHANGELOG.md`. No fluxo real via API do Vercel, a guarda busca o `/version.json` oficial publicado com limite de 64 KiB e deadline de 10 segundos, interpreta a versão numérica (a linha legada `0.2.0-dev.0` vale como baseline `0.2.0`) e exige que a candidata estável seja maior. Baseline ausente, inválida ou indisponível falha fechado. Uma ref local explícita pode ser usada para revisão/CI offline, sem substituir a verificação oficial de produção.

Redeploy do mesmo SHA com a mesma versão é retry técnico permitido; a mesma versão em SHA diferente falha. O build local exige versão estável e entrada exata no changelog, mas não exige bump adicional quando o HEAD já corresponde ao release reservado. Para a primeira publicação deste ciclo, a versão reservada é `0.3.0`, sucedendo a linha publicada `0.2.0`.
