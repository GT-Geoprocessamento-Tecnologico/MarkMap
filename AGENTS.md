# GeoNexo - Agent Ownership

## Agent Ownership Mapping

### @backend-visionario
- services/api/ (API implementation)
- packages/db/ (Database utilities)
- packages/contracts/ (Backend contracts)
- docs/api/ (API documentation)
- docs/database/ (Database documentation)

### @frontend-visionario
- apps/admin/ (React admin application)
- packages/ui/ (Design system and UI components)
- packages/maps/ (MapLibre and Terra Draw integration)
- packages/geo/ (GIS utilities and spatial operations)
- packages/contracts/ (Frontend contracts)
- frontend/ (Frontend application code)

### @seguranca-visionario
- .github/security/ (Security configurations)
- docs/security/ (Security documentation)
- security headers/config (Security headers and configuration in shared files)
- scripts de scan (Security scanning scripts)

### @qualidade-visionario
- testes compartilhados (Shared tests)
- e2e/ (End-to-end tests)
- configs Vitest/Playwright (Test configuration files)
- .github/workflows/** (GitHub Actions workflows)
- docs/quality/ (Quality documentation)

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
