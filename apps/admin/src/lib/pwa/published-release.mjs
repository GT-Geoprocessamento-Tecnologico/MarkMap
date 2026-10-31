/** Advisory only: network version metadata never authorizes shell activation. */
const VERSION_PATTERN = /^\d{1,6}\.\d{1,6}\.\d{1,6}$/;

export function newerPublishedVersion(manifest, installedVersion) {
  const remote = manifest?.appVersion;
  const installed = typeof installedVersion === 'string'
    ? installedVersion.replace(/^v/, '') : null;
  if (typeof remote !== 'string' || !VERSION_PATTERN.test(remote) ||
      typeof installed !== 'string' || !VERSION_PATTERN.test(installed)) return null;
  const current = installed.split('.').map(Number);
  const incoming = remote.split('.').map(Number);
  for (let index = 0; index < incoming.length; index++) {
    if (incoming[index] > current[index]) return remote;
    if (incoming[index] < current[index]) return null;
  }
  return null;
}
