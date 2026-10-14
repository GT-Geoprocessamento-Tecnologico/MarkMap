/** The installed-app Settings button delegates activation to UpdatePrompt's safety gates. */
export type AppUpdateResult =
  | { status: "updating" | "current" | "pending" | "offline" | "unavailable" }
  | { status: "error"; message: string };

export interface AppUpdateRequest {
  respond: (result: AppUpdateResult) => void;
}

export const PWA_UPDATE_REQUEST = "markmap:pwa-update-request";

export function requestAppUpdate(): Promise<AppUpdateResult> {
  if (typeof window === "undefined") return Promise.resolve({ status: "unavailable" });
  return new Promise((resolve) => {
    const event = new CustomEvent<AppUpdateRequest>(PWA_UPDATE_REQUEST, {
      cancelable: true,
      detail: { respond: resolve },
    });
    window.dispatchEvent(event);
    if (!event.defaultPrevented) resolve({ status: "unavailable" });
  });
}
