#!/usr/bin/env node
/**
 * Simple script to copy selected Zod schema files into a generated folder.
 * This is a placeholder implementation – in a real project you would
 * parse the files and generate type definitions from the Zod schemas.
 */
const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copySchemas() {
  const srcDir = path.resolve('packages/contracts/src');
  const outDir = path.resolve('packages/contracts/src/generated');
  ensureDir(outDir);

  const files = [
    'geometry-helpers.ts',
    'geometry.ts',
    'project.ts',
    'layer.ts',
    'feature.ts',
    'error.ts',
    'validators.ts', // may not exist
  ];

  files.forEach((file) => {
    const srcPath = path.join(srcDir, file);
    if (fs.existsSync(srcPath)) {
      const destPath = path.join(outDir, file);
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied ${file} to generated folder`);
    } else {
      console.warn(`File ${file} not found – skipping`);
    }
  });
}

copySchemas();
