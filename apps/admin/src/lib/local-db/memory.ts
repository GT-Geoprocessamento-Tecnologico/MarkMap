import type { LocalDb, LocalDbStores, LocalDbTransaction } from "./types";

type Row = Record<string, unknown>;
type RequestLike<T> = IDBRequest<T>;

function clone<T>(value: T): T {
  if (value instanceof Blob) return value;
  if (Array.isArray(value)) return value.map((item) => clone(item)) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)])) as T;
  return value;
}

class Request<T> {
  result!: T;
  error: DOMException | null = null;
  onsuccess: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  constructor(value: T) {
    this.result = value;
    queueMicrotask(() => this.onsuccess?.(new Event("success")));
  }
}

class MemoryStore {
  constructor(private readonly rows: Map<string, Row>) {}
  get(key: string): RequestLike<Row | undefined> { return new Request(this.rows.get(key)) as unknown as RequestLike<Row | undefined>; }
  put(value: Row): void { this.rows.set(String(value.key), clone(value)); }
  add(value: Row): void {
    const key = String(value.key);
    if (this.rows.has(key)) throw new DOMException("Duplicate key", "ConstraintError");
    this.rows.set(key, clone(value));
  }
  index(name: string): { getAll(value: string): RequestLike<Row[]> } {
    return { getAll: (value) => new Request([...this.rows.values()].filter((row) => name === "workspace" ? row.workspaceId === value : true).map((row) => clone(row))) as unknown as RequestLike<Row[]> };
  }
}

export class MemoryLocalDb implements LocalDb {
  private readonly tables = new Map<LocalDbStores, Map<string, Row>>();
  private id?: string;
  quotaBytes?: number;
  failNextTransaction = false;
  constructor() { for (const name of ["meta", "entities", "originals", "outbox", "conflicts", "acks"] as const) this.tables.set(name, new Map()); }
  async workspaceId(): Promise<string> {
    if (!this.id) this.id = crypto.randomUUID();
    return this.id;
  }
  async transact<T>(stores: LocalDbStores[], _mode: IDBTransactionMode, work: (tx: LocalDbTransaction) => Promise<T> | T): Promise<T> {
    if (this.failNextTransaction) { this.failNextTransaction = false; throw new Error("Transação local abortada."); }
    const copies = new Map<LocalDbStores, Map<string, Row>>();
    for (const name of stores) copies.set(name, new Map([...this.tables.get(name)!.entries()].map(([key, value]) => [key, clone(value)])));
    const tx: LocalDbTransaction = { store: (name) => new MemoryStore(copies.get(name)!) as unknown as IDBObjectStore };
    const result = await work(tx);
    if (this.quotaBytes !== undefined && JSON.stringify([...copies.values()].map((table) => [...table.values()])).length > this.quotaBytes) throw new DOMException("Quota exceeded", "QuotaExceededError");
    for (const [name, table] of copies) this.tables.set(name, table);
    return result;
  }
  close(): void {}
}
