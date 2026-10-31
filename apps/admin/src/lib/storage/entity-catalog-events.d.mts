export type EntityCatalogChange = {
  kind: "project" | "layer";
  id: string;
  action: "deleted";
};
export declare function notifyEntityCatalogChanged(message: EntityCatalogChange): boolean;
export declare function subscribeEntityCatalogChanges(callback: (change: EntityCatalogChange) => void): () => void;
