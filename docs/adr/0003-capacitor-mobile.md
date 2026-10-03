# ADR-0003 — Capacitor para Android/iOS

**Status:** Accepted

## Contexto

O produto precisa de experiência instalável e acesso a capacidades nativas sem manter aplicações paralelas.

## Decisão

Reutilizar React/Vite e empacotar com Capacitor. Plugins nativos são adicionados somente quando necessários.

## Consequências

- o núcleo funcional permanece web;
- Android e iOS devem usar os mesmos contratos e armazenamento lógico;
- GPS é integrado por Capacitor onde necessário;
- CI gera builds debug;
- signing/publicação permanecem etapas separadas e explicitamente autorizadas.
