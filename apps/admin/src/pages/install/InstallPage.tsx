import { useState, useSyncExternalStore } from "react";
import { MarkMapBrand } from "../../components/MarkMapBrand";
import { AppIcon } from "../../components/AppIcon";
import {
  getPwaInstallSnapshot,
  requestPwaInstall,
  subscribePwaInstall,
} from "../../lib/pwa-install";

export default function InstallPage() {
  const installState = useSyncExternalStore(
    subscribePwaInstall,
    getPwaInstallSnapshot,
    getPwaInstallSnapshot,
  );
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const install = async () => {
    if (!installState.available || busy) return;

    setBusy(true);
    try {
      const outcome = await requestPwaInstall();
      if (outcome === "dismissed") setDismissed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-[#06131a] text-white">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center border-b border-white/10 pb-5">
          <MarkMapBrand />
        </header>

        <section className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.05fr_.95fr] lg:py-16">
          <div className="max-w-2xl">
            <p className="mb-4 text-[11px] font-black uppercase tracking-[.24em] text-brand-cyan">
              Instalar MarkMap
            </p>
            <h1 className="max-w-3xl text-4xl font-black leading-[.96] tracking-[-.05em] sm:text-5xl lg:text-7xl">
              Leve o MarkMap para o campo.
            </h1>
            <p className="mt-6 max-w-xl text-sm leading-7 text-white/65 sm:text-base">
              Instale o PWA para abrir o MarkMap como aplicativo e manter o acesso ao fluxo offline no dispositivo.
            </p>

            <div className="mt-8">
              {installState.installed ? (
                <a
                  href="/"
                  className="inline-flex min-h-[52px] items-center gap-2 rounded-xl bg-gradient-to-r from-brand-blue to-brand-cyan px-6 py-3 text-sm font-black text-white shadow-lg shadow-brand-cyan/10 transition hover:brightness-110"
                >
                  <AppIcon name="map" size="md" />
                  Abrir MarkMap
                </a>
              ) : installState.available ? (
                <button
                  type="button"
                  onClick={() => void install()}
                  disabled={busy}
                  className="inline-flex min-h-[52px] items-center gap-2 rounded-xl bg-gradient-to-r from-brand-blue to-brand-cyan px-6 py-3 text-sm font-black text-white shadow-lg shadow-brand-cyan/10 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-65"
                >
                  <AppIcon name="download" size="md" />
                  {busy ? "Abrindo instalação…" : "Instalar MarkMap"}
                </button>
              ) : installState.iosSafari ? (
                <div className="rounded-2xl border border-brand-cyan/20 bg-brand-cyan/5 p-5">
                  <strong className="block text-sm text-white">Instalação no iPhone/iPad</strong>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[.035] p-5">
                  <strong className="block text-sm text-white">Preparando instalação</strong>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    Se o botão de instalação não aparecer, abra o menu do navegador e escolha “Instalar aplicativo”.
                  </p>
                </div>
              )}
            </div>

            {dismissed && (
              <p className="mt-4 text-xs leading-5 text-white/45">
                A instalação foi cancelada. Recarregue esta página ou use a opção “Instalar aplicativo” no menu do navegador.
              </p>
            )}

            <div className="mt-9 flex flex-wrap gap-3 text-xs text-white/55">
              <span className="rounded-full border border-white/10 px-3 py-2">✓ Android</span>
              <span className="rounded-full border border-white/10 px-3 py-2">✓ iOS</span>
              <span className="rounded-full border border-white/10 px-3 py-2">✓ Offline-first</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-8 rounded-full bg-brand-cyan/10 blur-3xl" aria-hidden="true" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a1b23] p-5 shadow-2xl shadow-black/35">
              <div className="rounded-[1.5rem] border border-white/10 bg-[#07131a] p-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-5">
                  <div>
                    <span className="block text-sm font-black">MARKMAP</span>
                    <span className="mt-1 block text-[8px] tracking-[.22em] text-white/35">PLANEJAMENTO INTELIGENTE</span>
                  </div>
                  <span className="h-2.5 w-2.5 rounded-full bg-brand-cyan shadow-[0_0_18px_rgba(0,214,219,.8)]" />
                </div>
                <div className="mt-6 grid gap-3">
                  {[
                    ["map", "Mapas e camadas", "Acesso ao trabalho de campo"],
                    ["location", "Coleta em campo", "Pontos, rotas e áreas"],
                    ["sync", "Offline-first", "Sincronize quando a rede voltar"],
                  ].map(([icon, title, text]) => (
                    <div key={title} className="flex items-center gap-4 rounded-2xl border border-white/8 bg-white/[.035] p-4">
                      <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-cyan/10 text-brand-cyan">
                        <AppIcon name={icon as "map" | "location" | "sync"} size="lg" />
                      </div>
                      <div>
                        <strong className="block text-sm">{title}</strong>
                        <span className="mt-1 block text-xs text-white/40">{text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/10 pt-5 text-xs text-white/45">
          Desenvolvido por{" "}
          <a
            href="https://mtsferreira.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-brand-cyan hover:underline"
          >
            MtsFerreira
          </a>
        </footer>
      </div>
    </main>
  );
}
