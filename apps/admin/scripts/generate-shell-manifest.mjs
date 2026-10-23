import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HASHED_FILE =
  /(?:[-.])[a-z0-9_-]{8,}\.(?:js|mjs|css|woff2?|ttf|otf|png|jpg|jpeg|webp|svg)$/i;
const ALWAYS_SHELL = new Set([
  "index.html",
  "manifest.json",
  "version.json",
  "icons/icon-192x192.png",
  "icons/icon-512x512.png",
]);
const EXCLUDED_PREFIXES = ["map/", "maps/", "api/"];

function resolveGitSha() {
  try {
    const sha = execSync("git rev-parse HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return /^[0-9a-f]{40}$/i.test(sha) ? sha : "unavailable";
  } catch {
    return "unavailable";
  }
}

async function filesUnder(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await filesUnder(root, path)));
    else result.push(path);
  }
  return result;
}

export async function collectShellAssets(distDirectory) {
  const all = await filesUnder(distDirectory);
  const assets = new Set();
  for (const path of all) {
    const name = relative(distDirectory, path).split(sep).join("/");
    if (
      ALWAYS_SHELL.has(name) ||
      (name.startsWith("assets/") && HASHED_FILE.test(name)) ||
      (name.startsWith("fonts/") && /\.(?:woff2?|ttf|otf)$/i.test(name)) ||
      (name.startsWith("icons/") && /\.(?:png|svg|webp)$/i.test(name))
    ) {
      if (!EXCLUDED_PREFIXES.some((prefix) => name.startsWith(prefix)))
        assets.add(`/${name}`);
    }
  }
  return [...assets].sort();
}

export async function generateShellManifest(distDirectory) {
  const configFile = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "package.json",
  );
  let appVersion = "unknown";
  try {
    appVersion =
      JSON.parse(await readFile(configFile, "utf8")).version ?? "unknown";
  } catch {
    /* Standalone fixture can still build a shell, but has no release identity. */
  }
  const buildSha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    resolveGitSha();
  const epoch = process.env.SOURCE_DATE_EPOCH;
  const buildTime =
    epoch && Number.isFinite(Number(epoch))
      ? new Date(Number(epoch) * 1000).toISOString()
      : new Date().toISOString();
  await writeFile(
    join(distDirectory, "version.json"),
    JSON.stringify(
      {
        appVersion,
        buildSha,
        buildTime,
        shellProtocolVersion: 1,
        localSchemaVersion: 1,
        regionPackageSchemaVersion: 2,
        minimumCompatibleVersion: "0.2.0-dev.0",
        releaseNotes: "Melhorias de mapas offline e instalação do aplicativo.",
      },
      null,
      2,
    ) + "\n",
  );
  const assets = await collectShellAssets(distDirectory);
  if (!assets.includes("/index.html"))
    throw new Error("shell manifest requires index.html");
  // Hash real content, including non-fingerprinted index.html and manifest.json.
  const digest = createHash("sha256");
  for (const asset of assets) {
    digest.update(asset);
    digest.update("\0");
    digest.update(await readFile(join(distDirectory, asset.slice(1))));
    digest.update("\0");
  }
  const payload =
    JSON.stringify(
      { version: digest.digest("hex").slice(0, 16), assets },
      null,
      2,
    ) + "\n";
  await writeFile(join(distDirectory, "shell-manifest.json"), payload, "utf8");
  const workerPath = join(distDirectory, "sw.js");
  try {
    const worker = await readFile(workerPath, "utf8");
    await writeFile(
      workerPath,
      worker
        .replaceAll("__MARKMAP_SHELL_MANIFEST__", JSON.stringify(assets))
        .replaceAll(
          "__MARKMAP_SHELL_VERSION__",
          JSON.stringify(JSON.parse(payload).version),
        ),
      "utf8",
    );
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return { assets, version: JSON.parse(payload).version };
}

if (
  process.argv[1] &&
  process.argv[1].endsWith("generate-shell-manifest.mjs")
) {
  const distDirectory = process.argv[2] ?? join(process.cwd(), "dist");
  const result = await generateShellManifest(distDirectory);
  process.stdout.write(
    `Generated shell manifest ${result.version} (${result.assets.length} assets)\n`,
  );
}
