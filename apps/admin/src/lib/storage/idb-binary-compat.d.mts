export function isBlobPreparationError(error: unknown): boolean;
export function waitForTransactionAbort(tx: IDBTransaction, getRequestError?: () => DOMException | null): Promise<void>;
export function copyBytes(bytes: Uint8Array): ArrayBuffer;
