import { Footer } from "../components/Footer";
import { Header } from "../components/Header";

export function PrivacyPage() {
  return (
    <>
      <Header />
      <main id="conteudo" className="legal site-container">
        <p className="eyebrow">Privacidade</p>
        <h1>Privacidade na MarkMap</h1>
        <h2>Estado técnico atual</h2>
        <ul>
          <li>operação principal local-first;</li>
          <li>localização/GPS pode ser utilizada mediante permissão do dispositivo;</li>
          <li>projetos, mapas, camadas, feições e arquivos geoespaciais podem ser processados no fluxo da aplicação;</li>
          <li>sincronização remota pode ocorrer quando houver rede e configuração correspondente;</li>
          <li>credenciais privilegiadas do banco não são expostas diretamente ao navegador.</li>
        </ul>
      </main>
      <Footer />
    </>
  );
}
