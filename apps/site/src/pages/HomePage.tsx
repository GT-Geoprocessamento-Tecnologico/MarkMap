import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { HeroVisual } from "../components/HeroVisual";
import { Reveal } from "../components/Reveal";

export function HomePage() {
  return (
    <>
      <Header />
      <main id="conteudo">
        <section className="hero">
          <HeroVisual />
          <div className="site-container hero__inner">
            <div className="hero__copy">
              <p className="eyebrow hero-enter hero-enter--1"><span />Mapeamento em campo</p>
              <h1 className="hero-enter hero-enter--2">
                <strong>MarkMap</strong>
                <span>Mapeamento que continua quando a rede para.</span>
              </h1>
              <p className="hero__lead hero-enter hero-enter--3">
                Planeje, colete, desenhe e consulte dados geoespaciais no próprio dispositivo. A conexão volta a ser necessária apenas quando for hora de sincronizar.
              </p>
              <div className="hero__actions hero-enter hero-enter--4">
                <a className="button button--primary" href="/baixar">Baixar app <span aria-hidden="true">↘</span></a>
                <a className="button button--ghost" href="/produto">Conhecer o produto</a>
              </div>
              <p className="hero__compat hero-enter hero-enter--5">Compatível com Android e iOS</p>
            </div>
          </div>
          <div className="hero__scroll" aria-hidden="true"><span />Role para explorar</div>
        </section>

        <section className="section section--statement">
          <div className="site-container statement-grid">
            <Reveal>
              <p className="eyebrow">Feito para o terreno</p>
              <h2 className="display-title">A internet não deveria decidir se o trabalho continua.</h2>
            </Reveal>
            <Reveal delay={100}>
              <p className="statement-copy">
                O MarkMap mantém projeto, mapa, camadas e coleta acessíveis localmente. Você trabalha primeiro; a sincronização acontece depois.
              </p>
              <a className="text-link" href="/offline">Entender o modo offline ↘</a>
            </Reveal>
          </div>
        </section>

        <section className="product-stage">
          <div className="site-container">
            <Reveal>
              <div className="product-stage__head">
                <div>
                  <p className="eyebrow eyebrow--inverse">O produto</p>
                  <h2>Um espaço de trabalho geoespacial, sem distração.</h2>
                </div>
                <a className="text-link text-link--inverse" href="/produto">Ver detalhes ↘</a>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div className="product-shell" aria-label="Prévia da interface do MarkMap">
                <div className="product-shell__rail">
                  <span className="product-shell__logo">M</span>
                  <i /><i /><i className="is-active" /><i /><i />
                </div>
                <div className="product-shell__canvas">
                  <div className="product-shell__map">
                    <svg viewBox="0 0 900 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                      <g fill="none" stroke="rgba(102,180,182,.2)" strokeWidth="1.3">
                        <path d="M-20 120C120 40 230 190 365 110S610 30 760 155 910 175 980 115"/>
                        <path d="M-20 220C120 130 245 285 390 195S625 120 780 248 925 250 980 210"/>
                        <path d="M-20 360C130 270 260 430 405 340S640 265 795 390 925 410 980 355"/>
                      </g>
                      <path d="M410 110L650 95 770 248 690 410 440 440 332 270Z" fill="rgba(0,214,219,.10)" stroke="#4ee9eb" strokeWidth="2"/>
                      <path d="M180 490C290 390 315 350 390 318S515 245 570 210 690 165 790 105" fill="none" stroke="#55d8ff" strokeWidth="4" strokeLinecap="round"/>
                      <circle cx="570" cy="210" r="9" fill="#07131f" stroke="#55f0ee" strokeWidth="2"/>
                    </svg>
                    <div className="product-shell__status"><span /> Offline · alterações salvas localmente</div>
                  </div>
                  <aside className="product-shell__panel">
                    <small>CAMADAS</small>
                    <strong>Conteúdo do mapa</strong>
                    <div className="mock-layer is-active"><span />Talhões 2026<small>42 feições</small></div>
                    <div className="mock-layer"><span />Pontos de inspeção<small>18 feições</small></div>
                    <div className="mock-layer"><span />Rotas de acesso<small>7 feições</small></div>
                  </aside>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="section">
          <div className="site-container capability-list">
            {[
              ["01", "Mapeie", "Mapas, camadas e feições no mesmo contexto operacional."],
              ["02", "Colete", "GPS e desenho geoespacial para registrar o que acontece no terreno."],
              ["03", "Consulte", "GeoPDF e dados locais disponíveis mesmo quando a conexão desaparece."],
              ["04", "Sincronize", "Alterações pendentes seguem para a rede quando ela estiver disponível."],
            ].map(([n, title, text], index) => (
              <Reveal key={title} delay={index * 70}>
                <article className="capability-row">
                  <span>{n}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="download-band">
          <div className="site-container download-band__inner">
            <Reveal>
              <p className="eyebrow eyebrow--inverse">MarkMap no seu dispositivo</p>
              <h2>Leve o mapa com você.</h2>
              <p>Um único app, preparado para acompanhar o trabalho em campo.</p>
              <div className="download-band__actions">
                <a className="button button--primary" href="/baixar">Baixar app</a>
                <span>Compatível com Android e iOS</span>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
