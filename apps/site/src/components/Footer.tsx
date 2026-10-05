import { Brand } from "./Brand";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-container site-footer__grid">
        <div><Brand /><p>Mapeamento de campo offline-first.</p></div>
        <nav aria-label="Rodapé">
          <a href="/#recursos">Recursos</a>
          <a href="/#plataformas">Plataformas</a>
          <a href="/privacidade">Privacidade</a>
        </nav>
      </div>
      <div className="site-container site-footer__bottom">
        <span>MarkMap — Planejamento Inteligente.</span>
        <span>Desenvolvido por <a href="https://mtsferreira.dev" target="_blank" rel="noopener noreferrer">MtsFerreira</a></span>
      </div>
    </footer>
  );
}
