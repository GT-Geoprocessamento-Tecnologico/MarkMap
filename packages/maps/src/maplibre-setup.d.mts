export declare function configureMapWithRollback<M extends { remove(): void }, T>(
  map: M, configure: () => T,
): T;
