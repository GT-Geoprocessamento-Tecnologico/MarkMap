# Política de Código e Dependências de Terceiros — GeoNexo

## Regra

Não adicionar biblioteca ou copiar código externo sem necessidade comprovada.

Antes de adotar:
1. identificar origem;
2. versão/tag/commit;
3. licença;
4. compatibilidade com distribuição pretendida;
5. risco de segurança/manutenção;
6. impacto de bundle/performance;
7. alternativa já existente no projeto.

## Licenças

Preferência:
- MIT;
- BSD;
- Apache-2.0;
- ISC;
- outras permissivas compatíveis.

GPL/AGPL ou licença desconhecida:
- referência conceitual apenas, salvo decisão explícita aceitando obrigações.

## Código adaptado

Quando houver código substancial adaptado:
- registrar upstream;
- indicar arquivo/função de origem quando conhecido;
- registrar modificações relevantes;
- manter notices/licença exigidos;
- incluir teste independente.

## Assets

Fontes, imagens, ícones, mapas e fixtures também entram no inventário quando redistribuídos.

## Inventário

Usar `docs/THIRD_PARTY_COMPONENTS.md` como inventário resumido e `THIRD_PARTY_NOTICES.md` para notices/licenças necessários.

## Atualização

Ao trocar versão:
- revisar changelog/breaking changes;
- executar testes afetados;
- revisar licença se necessário;
- atualizar inventário/notices.

## Segurança

Dependência comprometida, abandonada ou desnecessária deve ser removida/substituída com plano de compatibilidade.
