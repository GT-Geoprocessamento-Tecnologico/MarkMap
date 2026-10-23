// Desenvolvido por MtsFerreira. Save only consent, never GPS coordinates.
import { offlineDB } from "./offline-db";

const KEY = "auto-region-download";

export async function getAutomaticRegionDownload(): Promise<boolean> {
  const saved = await offlineDB.get("permissions", KEY);
  return Boolean(
    saved &&
    typeof saved === "object" &&
    "enabled" in saved &&
    saved.enabled === true,
  );
}

export async function setAutomaticRegionDownload(
  enabled: boolean,
): Promise<void> {
  await offlineDB.save("permissions", KEY, { enabled });
}
