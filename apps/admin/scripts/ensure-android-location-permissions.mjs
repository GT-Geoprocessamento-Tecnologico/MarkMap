#!/usr/bin/env node
/**
 * Declara as permissões de localização no manifesto Android do GeoNexo.
 *
 * Por que este script existe
 * --------------------------
 * O `@capacitor/geolocation` solicita `ACCESS_FINE_LOCATION` e
 * `ACCESS_COARSE_LOCATION` em tempo de execução, mas o pacote `@capacitor/
 * geolocation@8.2.2` publica um `AndroidManifest.xml` vazio: ele não declara
 * as permissões. O Android recusa uma solicitação de permissão que não esteja
 * declarada no manifesto, então sem estas linhas o WebView devolve
 * PERMISSION_DENIED (código 1) e o GPS não funciona no APK.
 *
 * `cap add android` regenera `android/app/src/main/AndroidManifest.xml`, então a
 * correção precisa ser reaplicada a cada geração. Este script faz isso de forma
 * idempotente e falha alto se o manifesto não for encontrado, em vez de deixar
 * o APK sair sem GPS silenciosamente.
 *
 * Uso: node scripts/ensure-android-location-permissions.mjs [caminho-do-manifesto]
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_PERMISSIONS = [
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_COARSE_LOCATION",
];

/**
 * O padrão é ancorado no diretório do próprio script (`apps/admin/scripts`), não
 * no diretório atual, para funcionar tanto em CI quanto em uma build local
 * chamada a partir da raiz do monorepo. Um caminho explícito é sempre resolvido
 * a partir do diretório atual.
 */
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(appRoot, "android/app/src/main/AndroidManifest.xml");

/** Constrói a linha XML de `<uses-permission>` com indentação de 4 espaços. */
const permissionLine = (permission) =>
  `    <uses-permission android:name="${permission}" />`;

const main = async () => {
  let manifest;
  try {
    manifest = await readFile(manifestPath, "utf8");
  } catch (cause) {
    throw new Error(
      `Manifesto Android não encontrado em ${manifestPath}. Rode "cap add android" antes deste script.`,
      { cause },
    );
  }

  // Permissions mentioned inside XML comments are not installed permissions.
  // Reject malformed manifests even when permission names happen to appear.
  const closing = manifest.lastIndexOf("</manifest>");
  if (closing === -1 || !/<manifest(?:\s|>)/.test(manifest))
    throw new Error(`Manifesto Android malformado em ${manifestPath}.`);
  const activeXml = manifest.replace(/<!--[\s\S]*?-->/g, "");
  const missing = REQUIRED_PERMISSIONS.filter((permission) =>
    !new RegExp(
      `<uses-permission\\s+[^>]*\\bandroid:name\\s*=\\s*["']${permission}["'][^>]*>`,
    ).test(activeXml),
  );
  if (missing.length === 0) return;

  const inserted = missing.map(permissionLine).join("\n");
  const updated = `${manifest.slice(0, closing)}${inserted}\n${manifest.slice(closing)}`;
  await writeFile(manifestPath, updated, "utf8");
};

await main();