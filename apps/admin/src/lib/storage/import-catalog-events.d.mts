export type ImportCatalogChange = {
  kind: 'original' | 'dataset';
  id: string;
  action: 'saved' | 'renamed' | 'deleted' | 'updated';
};
export function notifyImportCatalogChanged(message: ImportCatalogChange, Channel?: typeof BroadcastChannel): boolean;
export function subscribeImportCatalogChanges(callback: (change: ImportCatalogChange) => void, Channel?: typeof BroadcastChannel): () => void;
