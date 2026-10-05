import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { HeroVisual } from "../components/HeroVisual";
import { Reveal } from "../components/Reveal";
import { siteConfig } from "../site-config";

const features = [
  ["Offline-first", "Trabalhe sem conexão", "O dispositivo continua sendo a base operacional quando o sinal some."],
  ["GPS", "Localização em campo", "Use a geolocalização do dispositivo quando a permissão estiver disponível."],
  ["GeoPDF", "Referência cartográfica", "Trabalhe com GeoPDF georreferenciado e fluxos de calibração suportados."],
  ["GIS", "Mapas, camadas e feições", "Organize o trabalho geoespacial sem sair do mesmo fluxo."],
  ["Sincronização", "Rede na hora certa", "Envie alterações e receba atualizações quando a conectividade voltar."],
  ["Multiplataforma", "Web, PWA e mobile", "O mesmo núcleo web atende PWA e empacotamento Android/iOS."],
] as const;

const platforms = [
  ["Web / PWA", "Acesso pelo navegador e experiência instalável quando a distribuição web estiver liberada.", siteConfig.distribution.web && Boolean(siteConfig.appWebUrl), siteConfig.appWebUrl],
  ["Android", "Empacotamento Android preparado para distribuição depois das validações e assinatura finais.", siteConfig.distribution.android && Boolean(siteConfig.androidDownloadUrl), siteConfig.androidDownloadUrl],
  ["iOS", "Empacotamento iOS preparado para distribuição depois de signing, provisioning e validações finais.", siteConfig.distribution.ios && Boolean(siteConfig.iosStoreUrl), siteConfig.iosStoreUrl],
] as const;

export function HomePage() {
  return (
    <>
      <Header />
      <main id="conteudo">
        <section className="hero" id="inicio">
          <HeroVisual />
          <div className="site-container hero__inner">
            <div className="hero__copy">
              <p className="eyebrow hero-enter hero-enter--1"><span />Mapeamento offline-first</p>
              <h1 className="hero-enter hero-enter--2"><strong>MarkMap</strong><span>Planejamento inteligente, até onde a internet não chega.</span></h1>
              <p className="hero__lead hero-enter hero-enter--3">Mapeie, colete informações em campo e continue trabalhando sem conexão. Quando a rede voltar, sincronize o que ficou pendente.</p>
              <div className="hero__actions hero-enter hero-enter--4">
                <a className="button button--primary" href="#recursos">Explorar recursos <span aria-hidden="true">↘</span></a>
                <a className="button button--ghost" href="#como-funciona">Como funciona</a>
              </div>
              <div className="hero__signals hero-enter hero-enter--5">
                {['Offline-first','GPS','GeoPDF','Sync posterior'].map((item) => <span key={item}>{item}</span>)}
              </div>
            </div>
          </div>
        </section>

        <section className="section section--light">
          <div className="site-container split">
            <Reveal>
              <p className="eyebrow">Campo real</p>
              <h2 className="display-title">O sinal pode parar.<span>O trabalho não.</span></h2>
              <p className="section-lead">A MarkMap foi pensada para equipes que precisam produzir em campo sem transformar internet em requisito operacional.</p>
            </Reveal>
            <ol className="number-list">
              {[
                ["01", "Opera no dispositivo", "O trabalho principal continua localmente, mesmo quando a conectividade some."],
                ["02", "Mantém o contexto de campo", "Projetos, mapas, camadas e feições permanecem organizados no mesmo fluxo."],
                ["03", "Sincroniza depois", "A rede volta a ser importante no momento certo: para enviar, receber e reconciliar dados."],
              ].map(([n,title,text], index) => <li key={n}><Reveal delay={index*80}><span>{n}</span><div><h3>{title}</h3><p>{text}</p></div></Reveal></li>)}
            </ol>
          </div>
        </section>

        <section className="section" id="recursos">
          <div className="site-container">
            <Reveal><p className="eyebrow">Recursos</p><h2 className="section-title">Menos fricção entre o planejamento e o terreno.</h2><p className="section-lead">O mapa e o dado de campo ficam no centro. O restante existe para manter o fluxo simples, previsível e recuperável.</p></Reveal>
            <div className="feature-list">
              {features.map(([tag,title,text], index) => <Reveal key={title} delay={(index%3)*60}><article className="feature-row"><span className="feature-index">{String(index+1).padStart(2,'0')}</span><span className="feature-tag">{tag}</span><h3>{title}</h3><p>{text}</p></article></Reveal>)}
            </div>
          </div>
        </section>

        <section className="section section--dark" id="como-funciona">
          <div className="site-container">
            <Reveal><p className="eyebrow eyebrow--inverse">Como funciona</p><h2 className="section-title section-title--inverse">Do escritório ao campo, sem quebrar o fluxo.</h2><p className="section-lead section-lead--inverse">Três momentos claros. Nenhuma dependência de conexão para manter a atividade principal andando.</p></Reveal>
            <ol className="steps">
              {[
                ["01","Prepare","Organize projeto, mapas, camadas e materiais necessários para a atividade."],
                ["02","Vá a campo","Use mapas, GPS e ferramentas geoespaciais com ou sem conectividade contínua."],
                ["03","Sincronize","Quando a rede voltar, processe as alterações pendentes e receba atualizações remotas."],
              ].map(([n,title,text], index) => <li key={n}><Reveal delay={index*90}><span>{n}</span><h3>{title}</h3><p>{text}</p></Reveal></li>)}
            </ol>
          </div>
        </section>

        <section className="section section--muted">
          <div className="site-container split split--bottom">
            <Reveal><p className="eyebrow">Arquitetura offline-first</p><h2 className="section-title">A nuvem ajuda. O campo não espera por ela.</h2><p className="section-lead">O dispositivo é a base operacional. Sincronização, backup e consultas remotas entram quando há conectividade.</p></Reveal>
            <div className="pipeline" aria-label="Fluxo offline-first">
              {['Operação local','Outbox durável','Reconexão','Sync e conflitos'].map((item,index)=><div key={item}><span>0{index+1}</span><strong>{item}</strong></div>)}
            </div>
          </div>
        </section>

        <section className="section" id="plataformas">
          <div className="site-container">
            <Reveal><p className="eyebrow">Plataformas</p><h2 className="section-title">A MarkMap vai aonde o trabalho acontece.</h2><p className="section-lead">Os canais de distribuição permanecem fechados até que cada release esteja realmente pronta.</p></Reveal>
            <div className="platform-grid">
              {platforms.map(([title,text,enabled,url]) => <article key={title} className="platform"><div className="platform__status"><span>{enabled ? 'Disponível' : 'Em preparação'}</span></div><h3>{title}</h3><p>{text}</p>{enabled && url ? <a href={url} target="_blank" rel="noopener noreferrer" className="button button--dark">Abrir</a> : <button type="button" disabled>Disponibilização em preparação</button>}</article>)}
            </div>
          </div>
        </section>

        <section className="section section--muted" id="seguranca">
          <div className="site-container split">
            <Reveal><p className="eyebrow">Segurança</p><h2 className="section-title">Dados de campo pedem uma base técnica responsável.</h2><p className="section-lead">A arquitetura separa a operação local do acesso remoto e evita expor credenciais privilegiadas do banco no navegador.</p><a className="text-link" href="/privacidade">Privacidade ↘</a></Reveal>
            <div className="security-list">
              {[
                ["Local-first","O dispositivo permanece como base operacional durante a atividade em campo."],
                ["Acesso remoto mediado por API","O navegador não recebe credenciais privilegiadas do banco para acessar dados diretamente."],
                ["Sincronização controlada","O fluxo remoto usa isolamento por workspace e mecanismos próprios de sincronização."],
              ].map(([title,text])=><article key={title}><h3>{title}</h3><p>{text}</p></article>)}
            </div>
          </div>
        </section>

        <section className="section" id="faq">
          <div className="site-container split">
            <Reveal><p className="eyebrow">FAQ</p><h2 className="section-title">Perguntas frequentes</h2></Reveal>
            <div className="faq">
              {[
                ["A MarkMap funciona sem internet?","A operação principal foi projetada para funcionar localmente no dispositivo. Recursos remotos aguardam conectividade para sincronizar."],
                ["Posso usar GPS em campo?","Sim, quando o dispositivo oferece geolocalização e a permissão correspondente é concedida."],
                ["A MarkMap trabalha com GeoPDF?","Sim. O produto possui suporte a GeoPDF georreferenciado e recursos de calibração para os cenários suportados."],
                ["A MarkMap já está disponível nas lojas?","A distribuição pública para Android e iOS depende de assinatura, validações finais e publicação autorizada."],
              ].map(([question,answer])=><details key={question}><summary>{question}<span>⌄</span></summary><p>{answer}</p></details>)}
            </div>
          </div>
        </section>

        <section className="section section--dark final-cta">
          <div className="site-container"><Reveal><p className="eyebrow eyebrow--inverse">MarkMap</p><h2>Leve o planejamento para o campo.</h2><p>Uma plataforma geoespacial desenhada para continuar útil quando conectividade deixa de ser garantida.</p><a className="button button--primary" href="#plataformas">Ver plataformas ↘</a></Reveal></div>
        </section>
      </main>
      <Footer />
    </>
  );
}
