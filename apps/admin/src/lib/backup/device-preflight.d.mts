export type DevicePreflightStatus = 'not-included' | 'empty' | 'unknown';
export interface DevicePreflightSection {
  id: 'local-engine' | 'meshes' | 'large-blobs' | 'offline-maps';
  label: string;
  status: DevicePreflightStatus;
  message: string;
}
export interface DevicePreflightReport {
  kind: 'markmap-backup-device-preflight-v1';
  fullBackup: false;
  sections: DevicePreflightSection[];
  missingSections: number;
  uncertainSections: number;
}
interface CoverageSnapshot {
  coverage: { status: string; recordCount: number | null; reason?: string };
}
export function summarizeDeviceBackupCoverage(
  outcomes: readonly PromiseSettledResult<CoverageSnapshot>[],
): DevicePreflightReport;
