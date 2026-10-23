#!/usr/bin/env node
/**
 * Declara o uso de localização no `Info.plist` do projeto iOS.
 *
 * Sem `NSLocationWhenInUseUsageDescription` o iOS **encerra o aplicativo** no
 * instante em que a localização é pedida: não é um aviso, é um crash. E o
 * `cap add ios` pode regenerar o `Info.plist`, então a correção precisa ser
 * reaplicada a cada geração e também persistir mudanças em chaves existentes.
 *
 * A região também é fixada em pt-BR porque o aplicativo é em português; sem
 * isso o iOS pode exibir metadados de idioma inadequados para português.
 *
 * Uso: node scripts/ensure-ios-location-usage.mjs [caminho-do-plist]
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LOCATION_USAGE = [
  "NSLocationWhenInUseUsageDescription",
  "A MarkMap usa a sua localização para posicionar no mapa o ponto onde você está, coletar feições em campo e alinhar plantas georreferenciadas.",
];

const REGION_USAGE = ["CFBundleDevelopmentRegion", "pt_BR"];

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const plistPath = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(appRoot, "ios/App/App/Info.plist");

/** Monta o par chave/valor com a indentação usada pelo plist gerado. */
const entry = ([key, value]) =>
  `\t<key>${key}</key>\n\t<string>${value}</string>`;

/** Atualiza uma chave string existente sem duplicá-la; falha em chaves malformadas. */
const upsertString = (plist, key, value) => {
  const pattern = new RegExp(
    `(<key>\\s*${key}\\s*</key>\\s*<string>)([^<]*)(</string>)`,
    "g",
  );
  let matches = 0;
  const updated = plist.replace(pattern, (_match, open, _previous, close) => {
    matches += 1;
    return `${open}${value}${close}`;
  });
  if (matches > 1) throw new Error(`Info.plist possui chave duplicada: ${key}`);
  if (matches === 1) return updated;
  if (new RegExp(`<key>\\s*${key}\\s*</key>`).test(plist))
    throw new Error(`Info.plist contém tipo inválido para ${key}`);
  return null;
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

  const closing = plist.lastIndexOf("</dict>");
  if (closing === -1 || !plist.includes("<dict>"))
    throw new Error(`Info.plist malformado em ${plistPath}.`);

  let changed = false;
  const missing = [];
  for (const [key, value] of [LOCATION_USAGE, REGION_USAGE]) {
    const replaced = upsertString(plist, key, value);
    if (replaced !== null) {
      changed ||= replaced !== plist;
      plist = replaced;
    } else missing.push(entry([key, value]));
  }
  if (missing.length) {
    // Existing replacements may have changed string lengths since validation.
    const insertion = plist.lastIndexOf("</dict>");
    plist = `${plist.slice(0, insertion)}${missing.join("\n")}\n${plist.slice(insertion)}`;
    changed = true;
  }
  if (changed) await writeFile(plistPath, plist, "utf8");
};

await main();
