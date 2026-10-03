import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("service worker registration bootstrap", () => {
  const source = readFileSync(resolve(process.cwd(), "src/index.tsx"), "utf8");

  it("uses the Vite production flag in browser code", () => {
    expect(source).toContain("import.meta.env.PROD");
    expect(source).not.toContain("process.env.NODE_ENV");
  });

  it("keeps the production service worker entrypoint explicit", () => {
    expect(source).toContain('navigator.serviceWorker.register("/sw.js")');
  });
});
