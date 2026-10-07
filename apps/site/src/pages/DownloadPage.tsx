import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { Reveal } from "../components/Reveal";
import { siteConfig } from "../site-config";

export function DownloadPage() {
  return (
    <>
      <Header />
      <main id="conteudo">
        <section className="download-page">
          <div className="site-container download-page__grid">
            <Reveal>
              <p className="eyebrow eyebrow--inverse">Baixar MarkMap</p>
              <h1>Seu mapa. No seu dispositivo.</h1>
              <p className="download-page__lead">Instale o app MarkMap no seu dispositivo para usar a experiência completa e manter o fluxo offline.</p>
              <div className="download-page__compat">
                <span><i>✓</i> Android</span>
                <span><i>✓</i> iOS</span>
              </div>
              {siteConfig.appDownloadUrl ? (
                <a className="button button--primary button--download" href={siteConfig.appDownloadUrl}>Instalar MarkMap</a>
              ) : (
                <button className="button button--primary button--download" type="button" disabled>Download em breve</button>
              )}
              <small>A instalação é concluída pelo navegador. Android e iOS usam os fluxos nativos de instalação do app.</small>
            </Reveal>

            <Reveal delay={120}>
              <div className="device-visual" aria-label="Ilustração do MarkMap em um dispositivo móvel">
                <div className="device-visual__phone">
                  <div className="device-visual__screen">
                    <svg viewBox="0 0 420 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                      <rect width="420" height="760" fill="#0b1b21" />
                      <g fill="none" stroke="rgba(109,181,180,.25)" strokeWidth="1.2">
                        <path d="M-40 160C80 60 160 200 270 125S430 88 510 180"/>
                        <path d="M-40 285C80 190 175 330 290 252S435 220 510 300"/>
                        <path d="M-40 440C95 330 190 500 300 410S440 390 510 458"/>
                      </g>
                      <path d="M55 620C115 548 148 475 205 430S265 325 338 252" fill="none" stroke="#52e6e8" strokeWidth="5" strokeLinecap="round"/>
                      <circle cx="205" cy="430" r="10" fill="#07131f" stroke="#52e6e8" strokeWidth="3"/>
                    </svg>
                    <div className="device-visual__badge"><span />Offline pronto</div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
