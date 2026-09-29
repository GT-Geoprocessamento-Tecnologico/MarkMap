/**
 * Footer obrigatorio em toda pagina normal (20-FRONTEND-PRD-HANDOFF.md:22,259-271).
 * Um unico componente compartilhado - o markup nao deve ser duplicado em paginas.
 */
export default function AppFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#0b0f19] px-4 py-3 text-center text-sm text-slate-400">
      Desenvolvido por MtsFerreira{' '}
      <a
        href="https://mtsferreira.dev"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-cyan-400 underline underline-offset-2 hover:text-cyan-300 transition-colors"
      >
        https://mtsferreira.dev
      </a>
    </footer>
  );
}