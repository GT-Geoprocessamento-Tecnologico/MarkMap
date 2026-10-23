import { describe, expect, it } from "vitest";

import { deleteKeyCursorEntry } from "./region-download-checkpoints";

describe("regional checkpoint key cursor cleanup", () => {
  it("deletes through the object store primary key because key cursors cannot delete()", () => {
    const deleted: IDBValidKey[] = [];
    const request = {} as IDBRequest;
    const store = {
      delete(key: IDBValidKey) {
        deleted.push(key);
        return request;
      },
    };
    const cursor = { primaryKey: "sha:0" };
    expect(deleteKeyCursorEntry(store, cursor)).toBe(request);
    expect(deleted).toEqual(["sha:0"]);
    expect("delete" in cursor).toBe(false);
  });
});
