import { appCredits } from "../lib/app-credits";

export default function AppFooter() {
  return (
    <footer className="border-t border-outline-variant bg-background px-4 py-3 text-center text-sm text-on-surface-variant">
      Desenvolvido por{" "}
      <a href={appCredits.website} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline underline-offset-2 hover:opacity-80">
        {appCredits.author}
      </a>{" · "}<span aria-label="Versão do aplicativo">{appCredits.version}</span>
    </footer>
  );
}
