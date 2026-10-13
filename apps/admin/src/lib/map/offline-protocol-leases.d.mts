export interface MapRequest { url: string; type?: string }
export interface OfflineMapProtocolResult { data: unknown }
export type ProtocolAction = (
  params: MapRequest,
  controller: AbortController,
) => Promise<OfflineMapProtocolResult>;
export interface OfflineProtocolLease {
  id: string;
  release(): void;
}
export declare function acquireOfflineProtocolLease(options: {
  addProtocol: (name: string, handler: ProtocolAction) => void;
  removeProtocol: (name: string) => void;
  createHandlers: (id: string) => {
    tile: ProtocolAction;
    asset: ProtocolAction;
  };
}): OfflineProtocolLease;
