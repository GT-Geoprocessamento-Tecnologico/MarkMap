#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files", "-z"], {
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);

const allowedEnv = new Set([
  ".env.example",
  ".env.sample",
  ".env.template",
]);

const textExtensions = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".sql",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const patterns = [
  {
    label: "private key",
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
  },
  {
    label: "AWS access key",
    regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  },
  {
    label: "GitHub token",
    regex: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/,
  },
  {
    label: "Stripe live secret",
    regex: /\bsk_live_[A-Za-z0-9]{16,}\b/,
  },
];

const extensionOf = (path) => {
  const slash = path.lastIndexOf("/");
  const dot = path.lastIndexOf(".");
  return dot > slash ? path.slice(dot) : "";
};

const findings = [];

for (const path of tracked) {
  const baseName = path.split("/").at(-1) ?? path;
  if (
    baseName.startsWith(".env") &&
    !allowedEnv.has(baseName) &&
    !baseName.endsWith(".example") &&
    !baseName.endsWith(".sample") &&
    !baseName.endsWith(".template")
  ) {
    findings.push({ path, label: "tracked environment file" });
    continue;
  }

  if (!textExtensions.has(extensionOf(path)) && !baseName.startsWith(".env"))
    continue;

  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    continue;
  }

  for (const pattern of patterns) {
    if (pattern.regex.test(text))
      findings.push({ path, label: pattern.label });
  }
}

if (findings.length > 0) {
  process.stderr.write("Potential secrets detected in tracked files:\n");
  for (const finding of findings)
    process.stderr.write(`- ${finding.path}: ${finding.label}\n`);
  process.exit(1);
}

process.stdout.write(
  `Secret scan passed: ${tracked.length} tracked files inspected.\n`,
);
