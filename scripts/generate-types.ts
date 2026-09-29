#!/usr/bin/env node
/**
 * Script to generate shared Zod contract types.
 * Reads Zod schemas from packages/contracts/src/**/*.ts that export a Zod schema.
 * Outputs corresponding TypeScript files to packages/contracts/src/generated/.
 *
 * Usage: node scripts/generate-types.ts
 */

import fs from 'fs';
import path from 'path';

// Helper to ensure a directory exists
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Main generation function
async function generate(): Promise<void> {
  const contractsSrc = path.resolve('packages/contracts/src');
  const contractsGenerated = path.resolve('packages/contracts/src/generated');

  // Common patterns for exported schemas
  const schemaFiles = [
    'geometry-helpers.ts',
    'project.ts',
    'layer.ts',
    'feature.ts',
    'error.ts',
    'validators.ts', // optional
  ];

  for (const file of schemaFiles) {
    const filePath = path.join(contractsSrc, file);
    const outPath = path.join(contractsGenerated, file);
    if (fs.existsSync(filePath)) {
      // In real impl, we would extract the Zod schemas from the file.
      // For now, copy the file as‑is (or extract needed exports).
      // This is a placeholder – actual logic would parse the file for Zod schema exports.
      fs.copyFileSync(filePath, outPath);
      console.log(`Copied ${file} to generated folder`);
    } else {
      console.warn(`File ${file} not found – skipping`);
    }
  }

  // Ensure the folder exists even if no files were processed
  ensureDir(contractsGenerated);
}

generate()
  .catch((err) => {
    console.error('Generation failed:', err);
    process.exit(1);
  });