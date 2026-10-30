export function assertGeoPdfProjectIds(value: unknown): string[];
export function assignedProjectGeoPdf<T extends {blobId:string; mediaType:string; projectGeoPdfIds?:string[]}>(records:readonly T[], projectId:string):T|null;
export function reassignProjectGeoPdf<T extends {blobId:string; mediaType:string; projectGeoPdfIds?:string[]}>(records:readonly T[], projectId:string, blobId:string|null):T[];
