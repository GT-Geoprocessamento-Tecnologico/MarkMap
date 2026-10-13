// Desenvolvido por MtsFerreira — assinatura e versão única do aplicativo.
import { version } from "../../package.json";

export const appCredits = {
  author: "MtsFerreira",
  website: "https://mtsferreira.dev",
  // No rodapé, ocultar apenas o sufixo interno de desenvolvimento.
  version: `v${version.split(/[+-]/, 1)[0]}`,
} as const;
