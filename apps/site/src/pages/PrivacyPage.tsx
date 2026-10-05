import { Footer } from "../components/Footer";
import { Header } from "../components/Header";

export function PrivacyPage() {
  return (
    <>
      <Header />
      <main id="conteudo" className="legal site-container">
        <p className="eyebrow">Privacidade</p>
        <h1>Privacidade na MarkMap</h1>
        <p className="legal__lead">A política pública de privacidade da MarkMap está em preparação e depende da definição dos dados jurídicos e operacionais necessários antes da distribuição pública.</p>
        <div className="legal__notice" role="note"><strong>Antes da publicação:</strong> esta página não substitui a política jurídica final e não deve ser tratada como aprovação para distribuição pública.</div>
        <h2>Estado técnico atual</h2>
        <ul>
          <li>operação principal local-first;</li>
          <li>localização/GPS pode ser utilizada mediante permissão do dispositivo;</li>
          <li>projetos, mapas, camadas, feições e arquivos geoespaciais podem ser processados no fluxo da aplicação;</li>
          <li>sincronização remota pode ocorrer quando houver rede e configuração correspondente;</li>
          <li>credenciais privilegiadas do banco não são expostas diretamente ao navegador.</li>
        </ul>
        <h2>Antes da publicação pública</h2>
        <p>A versão pública desta política deverá incluir controlador, canal de contato, finalidades, bases legais, retenção e exclusão, provedores efetivos, regiões de processamento, procedimentos para solicitações do titular e revisão jurídica.</p>
      </main>
      <Footer />
    </>
  );
}
