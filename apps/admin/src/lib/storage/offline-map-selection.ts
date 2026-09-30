const SELECTED_PACKAGE_KEY = "geonexo:selected-offline-map-package";
const PACKAGE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/;

export function getSelectedOfflineMapId(): string | null {
  try {
    const value = localStorage.getItem(SELECTED_PACKAGE_KEY);
    return value && PACKAGE_ID_PATTERN.test(value) ? value : null;
  } catch {
    return null;
  }
}

export function setSelectedOfflineMapId(packageId: string | null): void {
  if (packageId !== null && !PACKAGE_ID_PATTERN.test(packageId)) {
    throw new Error("Identificador do pacote offline inválido.");
  }
  if (packageId === null) localStorage.removeItem(SELECTED_PACKAGE_KEY);
  else localStorage.setItem(SELECTED_PACKAGE_KEY, packageId);
}
