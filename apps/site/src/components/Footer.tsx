import { Brand } from "./Brand";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-container site-footer__grid">
        <div>
          <Brand inverse />
          <p>Mapeamento de campo que continua quando a rede para.</p>
        </div>
        <nav aria-label="Rodapé">
          <a href="/produto">Produto</a>
          <a href="/offline">Offline</a>
          <a href="/baixar">Baixar app</a>
          <a href="/privacidade">Privacidade</a>
        </nav>
      </div>
      <div className="site-container site-footer__bottom">
        <span>© {new Date().getFullYear()} MarkMap.</span>
        <span>Desenvolvido por <a href="https://mtsferreira.dev" target="_blank" rel="noopener noreferrer">MtsFerreira</a></span>
      </div>
    </footer>
  );
}
