import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { Reveal } from "../components/Reveal";

export function OfflinePage() {
  return (
    <>
      <Header />
      <main id="conteudo">
        <section className="page-hero page-hero--offline">
          <div className="site-container page-hero__grid">
            <div>
              <p className="eyebrow eyebrow--inverse">Offline-first</p>
              <h1>Sem sinal não significa sem trabalho.</h1>
              <p>
                O dispositivo continua sendo a base operacional. A rede entra
                depois, para sincronizar.
              </p>
            </div>
            <div className="signal-visual" aria-hidden="true">
              <span className="signal-ring signal-ring--1" />
              <span className="signal-ring signal-ring--2" />
              <span className="signal-ring signal-ring--3" />
              <i />
              <small>OFFLINE</small>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="site-container offline-flow">
            <Reveal>
              <p className="eyebrow">Como funciona</p>
              <h2 className="section-title">
                Você trabalha primeiro. A rede resolve depois.
              </h2>
            </Reveal>
            <div className="offline-flow__steps">
              {[
                [
                  "01",
                  "Prepare",
                  "Carregue o projeto e os materiais necessários antes de sair.",
                ],
                [
                  "02",
                  "Trabalhe",
                  "Crie e edite dados localmente, inclusive sem conexão.",
                ],
                [
                  "03",
                  "Reconecte",
                  "Quando a internet voltar, a fila local fica pronta para sincronizar.",
                ],
                [
                  "04",
                  "Sincronize",
                  "O app envia e recebe alterações preservando o fluxo operacional.",
                ],
              ].map(([n, title, text], index) => (
                <Reveal key={title} delay={index * 60}>
                  <article>
                    <span>{n}</span>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="section section--dark">
          <div className="site-container resilience-grid">
            <Reveal>
              <p className="eyebrow eyebrow--inverse">Resiliência</p>
              <h2 className="section-title section-title--inverse">
                A conexão deixa de ser um ponto único de falha.
              </h2>
            </Reveal>
            <Reveal delay={100}>
              <ul>
                <li>Dados de trabalho permanecem localmente no dispositivo.</li>
                <li>Alterações pendentes aguardam conectividade.</li>
                <li>Conflitos de sincronização são tratados explicitamente.</li>
                <li>
                  O fluxo remoto passa por API, sem credenciais privilegiadas do
                  banco no navegador.
                </li>
              </ul>
            </Reveal>
          </div>
        </section>

        <section className="download-band download-band--compact">
          <div className="site-container download-band__inner">
            <Reveal>
              <h2>O terreno muda. O fluxo continua.</h2>
              <p>Compatível com Android e iOS.</p>
              <a className="button button--primary" href="/baixar">
                Baixar app
              </a>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
