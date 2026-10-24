export function isBlobPreparationError(error: unknown): boolean;
export const SMALL_PACKAGE_BINARY_LIMIT: number;
export function shouldMaterializeSmallPackage(totalBytes: number): boolean;
export function waitForTransactionAbort(tx: IDBTransaction, getRequestError?: () => DOMException | null): Promise<void>;
export function settleTransaction(tx: IDBTransaction, getRequestError?: () => DOMException | null, rollbackTimeoutMs?: number): Promise<void>;
export function copyBytes(bytes: Uint8Array): ArrayBuffer;
