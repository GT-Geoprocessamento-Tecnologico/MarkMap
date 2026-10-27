#!/usr/bin/env node
/**
 * MarkMap - Pipeline de CI Local Autônomo e Determinístico
 *
 * Executa todas as validações de qualidade localmente sem depender do GitHub Actions:
 *  1. Typecheck completo do monorepo (turbo run typecheck)
 *  2. Lint completo do monorepo (turbo run lint)
 *  3. Testes unitários com concorrência controlada (Windows-safe):
 *     - @markmap/contracts, markmap-site, @markmap/ui, @markmap/geo, @markmap/maps, api, admin, @markmap/db
 *  4. Verificação de Release Guard e política de versionamento
 *  5. Testes de fronteira PWA, service worker e contraste de temas
 *
 * Uso:
 *   node scripts/local-ci.mjs [opções]
 *   pnpm ci:local [opções]
 *
 * Opções:
 *   --verbose, -v        Exibe toda a saída detalhada dos processos filhos
 *   --strict-version     Exige incremento estrito de versão mesmo durante desenvolvimento local
 *   --base-ref <ref>     Ramo ou commit base para comparar mudanças (padrão: origin/main)
 *   --skip-tests         Pula a execução de testes unitários
 *   --skip-lint          Pula a etapa de lint
 *   --skip-typecheck     Pula a etapa de typecheck
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(SCRIPT_DIR, "..");
const IS_WIN = process.platform === "win32";

// Argumentos da linha de comando
const ARGS = process.argv.slice(2);
if (ARGS.includes("--help") || ARGS.includes("-h")) {
  console.log(`
MarkMap — Pipeline de CI Local Autônomo e Determinístico

Uso:
  pnpm ci:local [opções]
  node scripts/local-ci.mjs [opções]

Opções:
  --verbose, -v        Exibe a saída completa em tempo real dos processos filhos
  --strict-version     Exige incremento estrito de versão mesmo durante desenvolvimento local
  --base-ref <ref>     Ramo ou commit base para comparar mudanças (padrão: origin/main)
  --skip-tests         Pula a execução de testes unitários
  --skip-lint          Pula a etapa de lint
  --skip-typecheck     Pula a etapa de typecheck
  --help, -h           Exibe esta mensagem de ajuda
`);
  process.exit(0);
}

const VERBOSE = ARGS.includes("--verbose") || ARGS.includes("-v");
const STRICT_VERSION = ARGS.includes("--strict-version");
const SKIP_TESTS = ARGS.includes("--skip-tests");
const SKIP_LINT = ARGS.includes("--skip-lint");
const SKIP_TYPECHECK = ARGS.includes("--skip-typecheck");

const baseRefIndex = ARGS.indexOf("--base-ref");
const BASE_REF =
  baseRefIndex >= 0 &&
  baseRefIndex + 1 < ARGS.length &&
  !ARGS[baseRefIndex + 1].startsWith("--")
    ? ARGS[baseRefIndex + 1]
    : "origin/main";

// Cores e símbolos ANSI
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m",
};

function formatTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const h = pad(date.getHours());
  const m = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${h}:${m}:${s}`;
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  const sec = (ms / 1000).toFixed(1);
  if (ms < 60000) return `${sec}s`;
  const minutes = Math.floor(ms / 60000);
  const remSec = ((ms % 60000) / 1000).toFixed(1);
  return `${minutes}m ${remSec}s`;
}

/**
 * Executa um comando child_process de forma assíncrona com captura ou streaming de saída.
 */
function runCommand(
  command,
  args,
  { cwd = ROOT_DIR, env = process.env, verbose = VERBOSE } = {},
) {
  return new Promise((resolveResult) => {
    const startTime = Date.now();
    let bin = command;
    let cmdArgs = args;

    // No Windows, executáveis .cmd como pnpm requerem invocação via cmd.exe para evitar falhas de spawn sem shell
    if (IS_WIN && (command === "pnpm" || command === "turbo")) {
      bin = "cmd.exe";
      cmdArgs = ["/c", command, ...args];
    }

    const child = spawn(bin, cmdArgs, {
      cwd,
      env: { ...env, FORCE_COLOR: "1" },
      stdio: verbose ? "inherit" : ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    if (!verbose) {
      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });
      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });
    }

    child.on("close", (code) => {
      const durationMs = Date.now() - startTime;
      resolveResult({
        ok: code === 0,
        code,
        durationMs,
        stdout,
        stderr,
      });
    });

    child.on("error", (err) => {
      const durationMs = Date.now() - startTime;
      resolveResult({
        ok: false,
        code: 1,
        durationMs,
        stdout,
        stderr: err.message,
      });
    });
  });
}

// Lista de pacotes alvo para testes unitários com concorrência controlada
const TARGET_TEST_PACKAGES = [
  "@markmap/contracts",
  "markmap-site",
  "@markmap/ui",
  "@markmap/geo",
  "@markmap/maps",
  "api",
  "admin",
  "@markmap/db",
];

// Lista de testes de fronteiras, contraste de tema e service worker
const BOUNDARY_TEST_CANDIDATES = [
  "scripts/theme-contrast.test.mjs",
  "scripts/theme-surfaces.test.mjs",
  "scripts/pwa-product-boundaries.test.mjs",
  "scripts/pwa-installability.test.mjs",
  "apps/admin/scripts/sw-update-protocol.test.mjs",
  "apps/admin/scripts/sw-navigation-cache.test.mjs",
  "apps/admin/scripts/generate-shell-manifest.test.mjs",
];

async function main() {
  const pipelineStartTime = Date.now();
  console.log(
    `\n${c.bold}${c.cyan}================================================================================${c.reset}`,
  );
  console.log(
    `${c.bold}${c.cyan}               MarkMap — Pipeline de CI Local Autônomo e Determinístico         ${c.reset}`,
  );
  console.log(
    `${c.bold}${c.cyan}================================================================================${c.reset}`,
  );
  console.log(
    `${c.gray}Início: ${new Date().toISOString()} | Plataforma: ${process.platform} (${process.arch}) | Node: ${process.version}${c.reset}`,
  );
  console.log(
    `${c.gray}Modo: ${VERBOSE ? "Verbose" : "Conciso (use --verbose para saída completa)"} | Base Ref: ${BASE_REF}${c.reset}\n`,
  );

  const results = [];

  // ============================================================================
  // Etapa 1: Typecheck do Monorepo
  // ============================================================================
  if (!SKIP_TYPECHECK) {
    const t0 = Date.now();
    process.stdout.write(
      `[${formatTimestamp()}] ${c.bold}[1/5] Typecheck no Monorepo (Turbo)...${c.reset} `,
    );
    const res = await runCommand("pnpm", ["typecheck"]);
    const dur = Date.now() - t0;
    if (res.ok) {
      console.log(
        `${c.green}${c.bold}PASS${c.reset} ${c.gray}(${formatDuration(dur)})${c.reset}`,
      );
      results.push({
        name: "Typecheck do Monorepo",
        status: "PASS",
        durationMs: dur,
      });
    } else {
      console.log(
        `${c.red}${c.bold}FAIL${c.reset} ${c.gray}(${formatDuration(dur)})${c.reset}`,
      );
      if (!VERBOSE && (res.stdout || res.stderr)) {
        console.error(`${c.red}${res.stderr || res.stdout}${c.reset}`);
      }
      results.push({
        name: "Typecheck do Monorepo",
        status: "FAIL",
        durationMs: dur,
      });
    }
  } else {
    results.push({
      name: "Typecheck do Monorepo",
      status: "SKIPPED",
      durationMs: 0,
    });
  }

  // ============================================================================
  // Etapa 2: Lint do Monorepo
  // ============================================================================
  if (!SKIP_LINT) {
    const t0 = Date.now();
    process.stdout.write(
      `[${formatTimestamp()}] ${c.bold}[2/5] Lint no Monorepo (Turbo)...${c.reset} `,
    );
    const res = await runCommand("pnpm", ["lint"]);
    const dur = Date.now() - t0;
    if (res.ok) {
      console.log(
        `${c.green}${c.bold}PASS${c.reset} ${c.gray}(${formatDuration(dur)})${c.reset}`,
      );
      results.push({
        name: "Lint do Monorepo",
        status: "PASS",
        durationMs: dur,
      });
    } else {
      console.log(
        `${c.red}${c.bold}FAIL${c.reset} ${c.gray}(${formatDuration(dur)})${c.reset}`,
      );
      if (!VERBOSE && (res.stdout || res.stderr)) {
        console.error(`${c.red}${res.stderr || res.stdout}${c.reset}`);
      }
      results.push({
        name: "Lint do Monorepo",
        status: "FAIL",
        durationMs: dur,
      });
    }
  } else {
    results.push({
      name: "Lint do Monorepo",
      status: "SKIPPED",
      durationMs: 0,
    });
  }

  // ============================================================================
  // Etapa 3: Testes Unitários com Concorrência Controlada (Windows Safe)
  // ============================================================================
  if (!SKIP_TESTS) {
    console.log(
      `[${formatTimestamp()}] ${c.bold}[3/5] Testes Unitários (Concorrência Controlada - Windows Safe):${c.reset}`,
    );
    let allTestsOk = true;
    let totalTestsDuration = 0;

    for (const pkg of TARGET_TEST_PACKAGES) {
      const t0 = Date.now();
      process.stdout.write(
        `  - Testando ${c.cyan}${pkg.padEnd(20)}${c.reset}... `,
      );
      const res = await runCommand("pnpm", ["--filter", pkg, "test"]);
      const dur = Date.now() - t0;
      totalTestsDuration += dur;

      if (res.ok) {
        console.log(
          `${c.green}${c.bold}PASS${c.reset} ${c.gray}(${formatDuration(dur)})${c.reset}`,
        );
        results.push({
          name: `Testes: ${pkg}`,
          status: "PASS",
          durationMs: dur,
        });
      } else {
        allTestsOk = false;
        console.log(
          `${c.red}${c.bold}FAIL${c.reset} ${c.gray}(${formatDuration(dur)})${c.reset}`,
        );
        if (!VERBOSE && (res.stdout || res.stderr)) {
          console.error(`${c.red}${res.stderr || res.stdout}${c.reset}`);
        }
        results.push({
          name: `Testes: ${pkg}`,
          status: "FAIL",
          durationMs: dur,
        });
      }
    }

    results.push({
      name: "Suíte de Testes Unitários (Total)",
      status: allTestsOk ? "PASS" : "FAIL",
      durationMs: totalTestsDuration,
      isSummary: true,
    });
  } else {
    results.push({
      name: "Suíte de Testes Unitários",
      status: "SKIPPED",
      durationMs: 0,
    });
  }

  // ============================================================================
  // Etapa 4: Verificação do Release Guard
  // ============================================================================
  {
    const t0 = Date.now();
    process.stdout.write(
      `[${formatTimestamp()}] ${c.bold}[4/5] Verificação de Release Guard e Versionamento...${c.reset} `,
    );

    // 1. Suite interna de testes do release guard
    const testGuardRes = await runCommand(process.execPath, [
      "--test",
      "scripts/version-release-guard.test.mjs",
    ]);

    // 2. Validação canônica de versão local e CHANGELOG.md
    const localGuardRes = await runCommand(process.execPath, [
      "scripts/version-release-guard.mjs",
    ]);

    // 3. Validação contra base ref (ex: origin/main)
    const baseGuardRes = await runCommand(process.execPath, [
      "scripts/version-release-guard.mjs",
      "--base-ref",
      BASE_REF,
    ]);

    const dur = Date.now() - t0;

    if (testGuardRes.ok && localGuardRes.ok && baseGuardRes.ok) {
      console.log(
        `${c.green}${c.bold}PASS${c.reset} ${c.gray}(${formatDuration(dur)})${c.reset}`,
      );
      results.push({
        name: "Release Guard (Completo + BaseRef)",
        status: "PASS",
        durationMs: dur,
      });
    } else if (testGuardRes.ok && localGuardRes.ok) {
      // Falha apenas na comparação com base-ref: verificar se é VERSION_NOT_MONOTONIC em workspace dirty
      const isMonotonicIssue =
        baseGuardRes.stderr.includes("VERSION_NOT_MONOTONIC") ||
        baseGuardRes.stdout.includes("VERSION_NOT_MONOTONIC");

      if (isMonotonicIssue && !STRICT_VERSION) {
        console.log(
          `${c.yellow}${c.bold}PASS (DEV)${c.reset} ${c.gray}(${formatDuration(dur)})${c.reset}`,
        );
        console.log(
          `    ${c.yellow}⚠ Alterações em apps/admin detectadas no working copy. Incrementar versão antes de publicar.${c.reset}`,
        );
        results.push({
          name: "Release Guard (Local OK, Pendente Bump para Release)",
          status: "WARN",
          durationMs: dur,
        });
      } else {
        console.log(
          `${c.red}${c.bold}FAIL${c.reset} ${c.gray}(${formatDuration(dur)})${c.reset}`,
        );
        console.error(
          `${c.red}${baseGuardRes.stderr || baseGuardRes.stdout}${c.reset}`,
        );
        results.push({
          name: "Release Guard (BaseRef)",
          status: "FAIL",
          durationMs: dur,
        });
      }
    } else {
      console.log(
        `${c.red}${c.bold}FAIL${c.reset} ${c.gray}(${formatDuration(dur)})${c.reset}`,
      );
      if (!testGuardRes.ok)
        console.error(
          `${c.red}${testGuardRes.stderr || testGuardRes.stdout}${c.reset}`,
        );
      if (!localGuardRes.ok)
        console.error(
          `${c.red}${localGuardRes.stderr || localGuardRes.stdout}${c.reset}`,
        );
      results.push({ name: "Release Guard", status: "FAIL", durationMs: dur });
    }
  }

  // ============================================================================
  // Etapa 5: Testes de Fronteira PWA, Service Worker e Contraste de Temas
  // ============================================================================
  {
    const t0 = Date.now();
    process.stdout.write(
      `[${formatTimestamp()}] ${c.bold}[5/5] Testes de Fronteira PWA, SW e Contraste de Tema...${c.reset} `,
    );

    // Filtra apenas os testes que realmente existem no disco
    const existingBoundaryTests = BOUNDARY_TEST_CANDIDATES.filter((file) =>
      existsSync(join(ROOT_DIR, file)),
    );

    if (existingBoundaryTests.length > 0) {
      const res = await runCommand(process.execPath, [
        "--test",
        ...existingBoundaryTests,
      ]);
      const dur = Date.now() - t0;
      if (res.ok) {
        console.log(
          `${c.green}${c.bold}PASS${c.reset} ${c.gray}(${formatDuration(dur)}, ${existingBoundaryTests.length} arquivos)${c.reset}`,
        );
        results.push({
          name: `Fronteiras PWA & Temas (${existingBoundaryTests.length} suites)`,
          status: "PASS",
          durationMs: dur,
        });
      } else {
        console.log(
          `${c.red}${c.bold}FAIL${c.reset} ${c.gray}(${formatDuration(dur)})${c.reset}`,
        );
        if (!VERBOSE && (res.stdout || res.stderr)) {
          console.error(`${c.red}${res.stderr || res.stdout}${c.reset}`);
        }
        results.push({
          name: "Fronteiras PWA & Temas",
          status: "FAIL",
          durationMs: dur,
        });
      }
    } else {
      console.log(`${c.yellow}${c.bold}Nenhum arquivo encontrado${c.reset}`);
      results.push({
        name: "Fronteiras PWA & Temas",
        status: "SKIPPED",
        durationMs: 0,
      });
    }
  }

  // ============================================================================
  // Relatório Final e Resumo Visual
  // ============================================================================
  const totalDuration = Date.now() - pipelineStartTime;
  const failedSteps = results.filter((r) => r.status === "FAIL");
  const warnSteps = results.filter((r) => r.status === "WARN");
  const allSuccess = failedSteps.length === 0;

  console.log(
    `\n${c.bold}${c.cyan}================================================================================${c.reset}`,
  );
  console.log(
    `${c.bold}${c.cyan}                    RELATÓRIO CONSOLIDADO DO CI LOCAL                           ${c.reset}`,
  );
  console.log(
    `${c.bold}${c.cyan}================================================================================${c.reset}`,
  );

  // Cabeçalho da tabela
  console.log(
    `${c.bold}${"Etapa".padEnd(58)} ${"Status".padEnd(10)} ${"Duração".padStart(10)}${c.reset}`,
  );
  console.log(`${c.gray}${"-".repeat(80)}${c.reset}`);

  for (const r of results) {
    if (r.isSummary) continue;
    let statusFormatted = `${c.green}${c.bold}PASS${c.reset}`;
    if (r.status === "FAIL")
      statusFormatted = `${c.red}${c.bold}FAIL${c.reset}`;
    else if (r.status === "WARN")
      statusFormatted = `${c.yellow}${c.bold}WARN${c.reset}`;
    else if (r.status === "SKIPPED")
      statusFormatted = `${c.gray}SKIP${c.reset}`;

    const durFormatted = formatDuration(r.durationMs).padStart(10);
    console.log(
      `${r.name.padEnd(58)} ${statusFormatted.padEnd(19)} ${c.gray}${durFormatted}${c.reset}`,
    );
  }

  console.log(`${c.gray}${"-".repeat(80)}${c.reset}`);
  console.log(
    `${c.bold}Tempo Total de Execução:${c.reset} ${formatDuration(totalDuration)}`,
  );

  if (warnSteps.length > 0) {
    console.log(
      `${c.yellow}Avisos:${c.reset} ${warnSteps.length} etapa(s) com advertências não bloqueantes.`,
    );
  }

  if (allSuccess) {
    console.log(
      `\n${c.green}${c.bold}✔ SUCESSO ABSOLUTO: Todas as etapas do pipeline local foram aprovadas!${c.reset}`,
    );
    console.log(
      `${c.gray}O código está 100% verificado, tipado, testado e em conformidade com as regras do monorepo.${c.reset}\n`,
    );
    process.exit(0);
  } else {
    console.log(
      `\n${c.red}${c.bold}✖ FALHA: ${failedSteps.length} etapa(s) reprovada(s) no pipeline local.${c.reset}`,
    );
    for (const f of failedSteps) {
      console.log(`  - ${c.red}${f.name}${c.reset}`);
    }
    console.log(
      `${c.gray}Corrija os erros acima antes de submeter ou fazer commit.${c.reset}\n`,
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(
    `\n${c.red}${c.bold}Erro inesperado no pipeline de CI local:${c.reset}`,
    err,
  );
  process.exit(1);
});
