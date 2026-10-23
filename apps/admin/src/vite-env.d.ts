/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the GeoNexo API (defaults to `/api/v1`). */
  readonly VITE_API_URL?: string;
  /** `mock` (default) uses the in-memory demo API, `live` hits the real API. */
  readonly VITE_API_MODE?: "mock" | "live";
}
