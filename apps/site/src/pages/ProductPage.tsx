import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { Reveal } from "../components/Reveal";

export function ProductPage() {
  return (
    <>
      <Header />
      <main id="conteudo">
        <section className="page-hero page-hero--product">
          <div className="site-container page-hero__grid">
            <div>
              <p className="eyebrow eyebrow--inverse">Produto</p>
              <h1>Ferramentas geoespaciais para trabalhar, não para decorar a tela.</h1>
              <p>Mapa, camadas, feições, GPS, desenho e GeoPDF organizados em um fluxo único.</p>
              <a className="button button--primary" href="/baixar">Baixar app</a>
            </div>
            <div className="orbit-visual" aria-hidden="true">
              <span className="orbit orbit--1" />
              <span className="orbit orbit--2" />
              <span className="orbit orbit--3" />
              <i className="orbit-point orbit-point--1" />
              <i className="orbit-point orbit-point--2" />
              <i className="orbit-point orbit-point--3" />
              <strong>M</strong>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="site-container">
            <Reveal><p className="eyebrow">Fluxo principal</p><h2 className="section-title">Do mapa à coleta sem trocar de contexto.</h2></Reveal>
            <div className="feature-editorial">
              {[
                ["Mapa operacional", "Visualize o território, alterne camadas e mantenha a área de trabalho como protagonista."],
                ["Desenho em campo", "Registre pontos, linhas e polígonos diretamente no mapa com persistência local."],
                ["GeoPDF", "Use material cartográfico georreferenciado e fluxos de calibração suportados."],
                ["GPS", "Use a posição do dispositivo quando a permissão estiver disponível."],
              ].map(([title, text], index) => (
                <Reveal key={title} delay={index * 60}>
                  <article>
                    <span>0{index + 1}</span>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="section section--dark">
          <div className="site-container split">
            <Reveal>
              <p className="eyebrow eyebrow--inverse">Interface</p>
              <h2 className="section-title section-title--inverse">Menos chrome. Mais mapa.</h2>
            </Reveal>
            <Reveal delay={90}>
              <p className="section-lead section-lead--inverse">A experiência prioriza a superfície cartográfica e mantém controles secundários no lugar certo: perto da ação, sem competir com ela.</p>
            </Reveal>
          </div>
        </section>

        <section className="section section--muted">
          <div className="site-container product-principles">
            <Reveal><p className="eyebrow">Princípios</p><h2 className="section-title">Projetado para operação real.</h2></Reveal>
            <div>
              {[
                ["Local primeiro", "A operação principal continua no dispositivo."],
                ["Contexto preservado", "Projetos, mapas e dados permanecem no mesmo fluxo."],
                ["Recuperável", "Alterações aguardam a rede sem sumir do trabalho em andamento."],
              ].map(([title, text]) => (
                <article key={title}><h3>{title}</h3><p>{text}</p></article>
              ))}
            </div>
          </div>
        </section>

        <section className="download-band download-band--compact">
          <div className="site-container download-band__inner">
            <Reveal><h2>Pronto para levar o MarkMap a campo?</h2><a className="button button--primary" href="/baixar">Baixar app</a></Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
