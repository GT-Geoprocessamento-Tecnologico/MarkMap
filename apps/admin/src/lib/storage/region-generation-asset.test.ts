import { describe, expect, it } from "vitest";

import { readActiveGenerationAsset } from "./region-generation-asset.mjs";

function database(rows: Record<string, Record<string, unknown>>): IDBDatabase {
  return {
    transaction() {
      return {
        objectStore(name: string) {
          return {
            get(key: string) {
              const request: { result?: unknown; onsuccess?: () => void } = {};
              queueMicrotask(() => {
                request.result = rows[name]?.[key];
                request.onsuccess?.();
              });
              return request;
            },
          };
        },
      };
    },
  } as unknown as IDBDatabase;
}

describe("active generation asset reader", () => {
  it("normalizes legacy ArrayBuffer records and preserves Blob records", async () => {
    const legacy = await readActiveGenerationAsset(
      database({
        packages: {
          "aragua:old": {
            packageId: "aragua",
            generation: "old",
            state: "active",
          },
        },
        assets: {
          "old:style.json": {
            packageId: "old",
            path: "style.json",
            bytes: new Uint8Array([1, 2]).buffer,
          },
        },
      }),
      "aragua",
      "style.json",
      "old",
    );
    expect(legacy).toBeInstanceOf(Blob);
    expect(legacy!.size).toBe(2);

    const blob = new Blob(["ok"]);
    const current = await readActiveGenerationAsset(
      database({
        packages: {
          "aragua:new": {
            packageId: "aragua",
            generation: "new",
            state: "active",
          },
        },
        assets: {
          "new:style.json": {
            packageId: "new",
            path: "style.json",
            bytes: blob,
          },
        },
      }),
      "aragua",
      "style.json",
      "new",
    );
    expect(current).toBe(blob);
  });

  it("fails closed for a stale generation marker", async () => {
    await expect(
      readActiveGenerationAsset(
        database({
          packages: {
            "aragua:new": {
              packageId: "aragua",
              generation: "new",
              state: "active",
            },
          },
          assets: {
            "old:style.json": {
              packageId: "old",
              path: "style.json",
              bytes: new Blob(["old"]),
            },
          },
        }),
        "aragua",
        "style.json",
        "old",
      ),
    ).resolves.toBeNull();
  });
});
