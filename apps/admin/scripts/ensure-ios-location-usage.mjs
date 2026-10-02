#!/usr/bin/env node
/**
 * Declara o uso de localização no `Info.plist` do projeto iOS.
 *
 * Sem `NSLocationWhenInUseUsageDescription` o iOS **encerra o aplicativo** no
 * instante em que a localização é pedida: não é um aviso, é um crash. E o
 * `cap add ios` regenera o `Info.plist`, então a correção precisa ser reaplicada
 * a cada geração.
 *
 * A região também é fixada em pt-BR porque o aplicativo é em português; sem
 * isso o iOS mostra "GeoNexo" como aplicativo estrangeiro no menu de idioma.
 *
 * Uso: node scripts/ensure-ios-location-usage.mjs [caminho-do-plist]
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LOCATION_USAGE = [
  "NSLocationWhenInUseUsageDescription",
  "O GeoNexo usa a sua localização para posicionar no mapa o ponto onde você está, coletar feições em campo e alinhar plantas georreferenciadas.",
];

const REGION_USAGE = ["CFBundleDevelopmentRegion", "pt_BR"];

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const plistPath = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(appRoot, "ios/App/App/Info.plist");

/** Monta o par chave/valor com a indentação usada pelo plist gerado. */
const entry = ([key, value]) => `\t<key>${key}</key>\n\t<string>${value}</string>`;

/** Substitui o valor de uma chave existente, preservando o resto do arquivo. */
const upsertString = (plist, key, value) => {
  const pattern = new RegExp(`(\\t<key>${key}</key>\\s*\\n\\s*<string>)[^<]*(</string>)`);
  return pattern.test(plist)
    ? plist.replace(pattern, `$1${value}$2`)
    : null;
};

const main = async () => {
  let plist;
  try {
    plist = await readFile(plistPath, "utf8");
  } catch (cause) {
    throw new Error(
      `Info.plist não encontrado em ${plistPath}. Rode "cap add ios" antes deste script.`,
      { cause },
    );
  }

  const missing = [];
  for (const [key, value] of [LOCATION_USAGE, REGION_USAGE]) {
    const replaced = upsertString(plist, key, value);
    if (replaced) {
      plist = replaced;
      continue;
    }
    missing.push(entry([key, value]));
  }

  if (missing.length === 0) return;

  const closing = plist.lastIndexOf("</dict>");
  if (closing === -1) {
    throw new Error(`Info.plist malformado: "</dict>" ausente em ${plistPath}.`);
  }

  await writeFile(
    plistPath,
    `${plist.slice(0, closing)}${missing.join("\n")}\n${plist.slice(closing)}`,
    "utf8",
  );
};

await main();