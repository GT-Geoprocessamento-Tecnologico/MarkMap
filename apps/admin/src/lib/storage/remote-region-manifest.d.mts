/** Fetches a bounded HTTPS manifest. Validate the returned value with Zod. */
export function fetchRemoteRegionManifest(
  manifestUrl: string,
  fetcher?: typeof fetch,
  signal?: AbortSignal,
): Promise<{
  manifest: unknown;
  baseUrl: string;
}>;
