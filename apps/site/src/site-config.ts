// Desenvolvido por MtsFerreira. Único endereço de instalação: origem do app, não do site.
// Trocas de domínio devem manter o contrato docs/site-app-boundaries.md.
export const siteConfig = {
  appDownloadUrl: "https://appmarkmap.mtsferreira.dev/?install=1" as string,
  compatibility: ["Android", "iOS"] as const,
  distribution: {
    app: true,
  },
};
