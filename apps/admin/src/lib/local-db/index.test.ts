import { afterEach, describe, expect, it, vi } from "vitest";
import { IndexedLocalDb } from "./index";

afterEach(() => vi.unstubAllGlobals());

describe("IndexedLocalDb transaction errors", () => {
  it.each(["request", "transaction"] as const)(
    "rejeita com o erro original de %s e aborta a transação",
    async (errorSource) => {
      const failure = new DOMException("Falha sintética de gravação", "ConstraintError");
      const abort = vi.fn();
      const transaction = {
        error: errorSource === "transaction" ? failure : null,
        onerror: null as ((event: Event) => void) | null,
        onabort: null,
        oncomplete: null,
        abort,
        objectStore: () => ({
          put: () => {
            const request = { error: errorSource === "request" ? failure : null };
            queueMicrotask(() => {
              const event = new Event("error");
              Object.defineProperty(event, "target", { value: request });
              transaction.onerror?.(event);
            });
          },
        }),
      };
      const database = { transaction: () => transaction, close: vi.fn(), onversionchange: null };
      const openRequest = { result: database, onsuccess: null as (() => void) | null };
      vi.stubGlobal("indexedDB", {
        open: () => {
          queueMicrotask(() => openRequest.onsuccess?.());
          return openRequest;
        },
      });
      const db = new IndexedLocalDb();
      await expect(db.transact(["meta"], "readwrite", (tx) => {
        tx.store("meta").put({ key: "exemplo", value: "sintético" });
      })).rejects.toMatchObject({
        name: "ConstraintError",
        message: "Falha sintética de gravação",
      });
      expect(abort).toHaveBeenCalledOnce();
      db.close();
    },
  );
});
