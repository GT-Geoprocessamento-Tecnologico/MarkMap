import type { ReactNode } from "react";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { HeroVisual } from "../components/HeroVisual";
import { Reveal } from "../components/Reveal";

type IconName = "map" | "cloud" | "shield" | "team" | "pin" | "layers" | "note" | "sync" | "wifi" | "target" | "phone";

function Icon({ name }: { name: IconName }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<IconName, ReactNode> = {
    map: <><path d="m3 6 5-2 8 2 5-2v14l-5 2-8-2-5 2Z"/><path d="M8 4v14M16 6v14"/></>,
    cloud: <path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 8.5 4.5 4.5 0 0 0 7 18Z"/>,
    shield: <><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6Z"/><path d="m9.5 12 1.7 1.7 3.6-4"/></>,
    team: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 19c.7-3.6 2.8-5.5 6-5.5s5.3 1.9 6 5.5M14.5 14.5c2.8.2 4.6 1.7 5.5 4.5"/></>,
    pin: <><path d="M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></>,
    layers: <><path d="m12 3 8 4-8 4-8-4Z"/><path d="m4 12 8 4 8-4M4 17l8 4 8-4"/></>,
    note: <><path d="M6 3h9l3 3v15H6Z"/><path d="M15 3v4h4M9 11h6M9 15h6"/></>,
    sync: <><path d="M20 7h-5V2"/><path d="M4 17h5v5"/><path d="M19 12a7 7 0 0 0-12-5L4 10M5 12a7 7 0 0 0 12 5l3-3"/></>,
    wifi: <><path d="M3 8c5-4 13-4 18 0M6 12c3.4-2.7 8.6-2.7 12 0M9 16c1.7-1.3 4.3-1.3 6 0"/><path d="M4 4l16 16"/></>,
    target: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M22 12h-3M12 22v-3M2 12h3"/></>,
    phone: <><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M10 5h4M11 19h2"/></>,
  };
  return <svg {...common} aria-hidden="true">{paths[name]}</svg>;
}

const benefits: Array<[IconName, string, string]> = [
  ["map", "Coleta em campo", "Registre pontos, rotas, áreas e anotações com precisão."],
  ["cloud", "Trabalha offline", "Seus dados seguros, mesmo sem internet."],
  ["shield", "Mais produtividade", "Planeje, execute e entregue mais."],
  ["team", "Para equipes de campo", "Ideal para obras, meio ambiente, patrimônio e gestão territorial."],
];

const productFeatures: Array<[IconName, string, string]> = [
  ["pin", "Pontos, rotas e áreas", "Registre e organize seus dados com precisão."],
  ["layers", "Mapas e camadas", "Visualize informações no mapa, inclusive offline."],
  ["note", "Fotos e anotações", "Enriqueça seus registros com imagens e observações."],
  ["cloud", "Sincronização segura", "Seus dados ficam disponíveis quando a rede voltar."],
];

export function HomePage() {
  return (
    <>
      <Header />
      <main id="conteudo" className="landing-home">
        <section className="landing-hero">
          <HeroVisual />
          <div className="site-container landing-hero__inner">
            <div className="landing-hero__copy">
              <p className="landing-kicker hero-enter hero-enter--1">Planejamento inteligente</p>
              <h1 className="hero-enter hero-enter--2">
                Mapeamento que continua <span>quando a rede para.</span>
              </h1>
              <p className="landing-hero__lead hero-enter hero-enter--3">
                Colete, visualize e gerencie dados geoespaciais em campo com confiabilidade, mesmo sem internet.
                O MarkMap mantém o trabalho no dispositivo e sincroniza quando a rede voltar.
              </p>
              <div className="landing-hero__actions hero-enter hero-enter--4">
                <a className="button button--primary landing-download" href="/baixar">
                  <span className="download-icon" aria-hidden="true">↓</span>
                  Baixar app
                </a>
              </div>
              <p className="landing-hero__compat hero-enter hero-enter--5">Compatível com Android e iOS</p>
            </div>

            <aside className="landing-hero__features" aria-label="Destaques do MarkMap">
              <div><Icon name="wifi" /><span><strong>Funciona offline</strong><small>Colete dados sem internet</small></span></div>
              <div><Icon name="sync" /><span><strong>Rotas e trilhas</strong><small>Navegação precisa</small></span></div>
              <div><Icon name="layers" /><span><strong>Dados geoespaciais</strong><small>Organize e compartilhe</small></span></div>
            </aside>
          </div>
        </section>

        <section className="landing-benefits" aria-label="Benefícios">
          <div className="site-container landing-benefits__grid">
            {benefits.map(([icon, title, text], index) => (
              <Reveal key={title} delay={index * 60}>
                <article className="landing-benefit">
                  <Icon name={icon} />
                  <div><h2>{title}</h2><p>{text}</p></div>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="landing-product" id="recursos">
          <div className="site-container landing-product__grid">
            <Reveal>
              <div className="landing-product__copy">
                <p className="landing-kicker">Produto</p>
                <h2>Tudo o que você precisa para o trabalho em campo.</h2>
                <p className="landing-copy">
                  O MarkMap reúne ferramentas para coleta, visualização e gestão de dados geoespaciais em uma experiência simples e intuitiva.
                </p>
                <div className="landing-feature-list">
                  {productFeatures.map(([icon, title, text]) => (
                    <div key={title} className="landing-feature">
                      <Icon name={icon} />
                      <div><strong>{title}</strong><span>{text}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div className="landing-laptop" aria-label="Prévia da interface do MarkMap">
                <div className="landing-laptop__screen">
                  <div className="landing-appbar"><span className="landing-appbar__brand">MarkMap</span><span>Buscar local ou coordenada...</span></div>
                  <div className="landing-map">
                    <svg viewBox="0 0 880 510" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                      <defs>
                        <linearGradient id="map-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#22452f"/><stop offset=".5" stopColor="#4d6e37"/><stop offset="1" stopColor="#173638"/></linearGradient>
                        <filter id="map-noise"><feTurbulence type="fractalNoise" baseFrequency=".025 .05" numOctaves="3" seed="4"/><feBlend in="SourceGraphic" mode="overlay"/></filter>
                      </defs>
                      <rect width="880" height="510" fill="url(#map-bg)" filter="url(#map-noise)"/>
                      <g fill="none" stroke="rgba(242,226,191,.45)" strokeWidth="2"><path d="M50 10C90 130 200 130 230 230s-10 190 90 270"/><path d="M410 0C430 110 540 130 565 230s-30 170 80 270"/><path d="M710 0C740 100 845 130 860 230"/></g>
                      <path d="M330 120L520 88 660 208 590 360 380 382 278 242Z" fill="rgba(31,206,97,.38)" stroke="#63f0a2" strokeWidth="3"/>
                      <path d="M190 430C300 335 326 300 400 270S520 206 570 170 690 132 790 80" fill="none" stroke="#20a6ff" strokeWidth="5" strokeLinecap="round"/>
                      {[ [400,270],[570,170],[690,132] ].map(([x,y]) => <circle key={String(x)} cx={x} cy={y} r="7" fill="#fff" stroke="#0e97ff" strokeWidth="4"/>)}
                    </svg>
                    <div className="landing-map__sidebar">
                      <strong>Camadas</strong>
                      <label><input type="checkbox" defaultChecked /> Limites da propriedade</label>
                      <label><input type="checkbox" defaultChecked /> Nascentes</label>
                      <label><input type="checkbox" defaultChecked /> Área de preservação</label>
                      <label><input type="checkbox" /> Estradas e acessos</label>
                    </div>
                    <div className="landing-map__badge">Área de preservação<br/><strong>12,5 hectares</strong></div>
                  </div>
                </div>
                <div className="landing-laptop__base" />
              </div>
            </Reveal>
          </div>
        </section>

        <section className="landing-offline">
          <div className="site-container landing-offline__grid">
            <Reveal>
              <div>
                <p className="landing-kicker">Offline-first</p>
                <h2>Confiança em qualquer lugar.</h2>
                <p className="landing-copy">
                  O MarkMap foi pensado para a realidade de campo. Colete e consulte dados sem internet e sincronize depois, quando a rede voltar.
                </p>
              </div>
            </Reveal>
            <div className="landing-offline__steps">
              {[
                ["wifi", "1. Colete offline", "Registre pontos, rotas, áreas, fotos e anotações sem precisar de internet."],
                ["sync", "2. Sincronize depois", "Quando a rede voltar, seus dados ficam prontos para sincronização."],
                ["shield", "3. Trabalhe sem limites", "Mais segurança, autonomia e produtividade para sua equipe."],
              ].map(([icon, title, text], index) => (
                <Reveal key={title} delay={index * 70}>
                  <article>
                    <div className="landing-offline__icon"><Icon name={icon as IconName} /></div>
                    <strong>{title}</strong>
                    <p>{text}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-final" id="contato">
          <div className="site-container landing-final__grid">
            <Reveal>
              <div className="landing-final__copy">
                <p className="landing-kicker landing-kicker--inverse">Baixar app</p>
                <h2>Leve o MarkMap para o campo.</h2>
                <p>Um único app, preparado para acompanhar o trabalho em qualquer lugar. Compatível com Android e iOS.</p>
                <a className="button button--primary landing-download" href="/baixar">
                  <span className="download-icon" aria-hidden="true">↓</span>
                  Baixar app
                </a>
              </div>
            </Reveal>

            <Reveal delay={90}>
              <div className="landing-phone" aria-label="Ilustração do MarkMap em dispositivo móvel">
                <div className="landing-phone__speaker" />
                <div className="landing-phone__screen">
                  <div className="landing-phone__mark">M</div>
                  <strong>MARKMAP</strong>
                  <small>PLANEJAMENTO INTELIGENTE</small>
                  <svg viewBox="0 0 300 360" aria-hidden="true"><g fill="none" stroke="rgba(0,214,219,.28)" strokeWidth="1.2"><path d="M-10 110C55 50 95 140 150 100s100-30 165 15"/><path d="M-10 180C55 120 95 210 150 170s100-30 165 15"/><path d="M-10 250C55 190 95 280 150 240s100-30 165 15"/></g></svg>
                </div>
              </div>
            </Reveal>

            <Reveal delay={150}>
              <div className="landing-final__bullets">
                <div><Icon name="wifi" /><span>Trabalha offline</span></div>
                <div><Icon name="target" /><span>Coleta dados com precisão</span></div>
                <div><Icon name="phone" /><span>Fácil de usar</span></div>
                <div><Icon name="team" /><span>Ideal para equipes de campo</span></div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
