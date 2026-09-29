/**
 * Footer obrigatorio em toda pagina normal (20-FRONTEND-PRD-HANDOFF.md:22,259-271).
 * Um unico componente compartilhado - o markup nao deve ser duplicado em paginas.
 */
export default function AppFooter() {
  return (
    <footer className="border-t border-border bg-surface px-4 py-3 text-center text-sm text-text-secondary">
      Desenvolvido por MtsFerreira{' '}
      <a
        href="https://mtsferreira.dev"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-primary underline underline-offset-2 hover:text-text-primary"
      >
        https://mtsferreira.dev
      </a>
    </footer>
  );
}
