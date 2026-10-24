/** Conservative SemVer ordering for immutable offline region packages. */
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([A-Za-z0-9.-]+))?$/;
function parse(value: string): { nums: number[]; prerelease: string[] } | null {
  const match = SEMVER.exec(value);
  if (!match) return null;
  const nums = match.slice(1, 4).map(Number);
  if (nums.some(v => !Number.isSafeInteger(v))) return null;
  const prerelease = match[4] ? match[4].split('.') : [];
  if (prerelease.some(s => !s || /^\d+$/.test(s) && s.length > 1 && s.startsWith('0'))) return null;
  return { nums, prerelease };
}
/** Returns null when either version is not comparable. */
export function compareRegionVersions(next: string, current: string): number | null {
  const a = parse(next), b = parse(current);
  if (!a || !b) return null;
  for (let i = 0; i < 3; i++) {
    if (a.nums[i] !== b.nums[i]) return Math.sign(a.nums[i]! - b.nums[i]!);
  }
  if (!a.prerelease.length && b.prerelease.length) return 1;
  if (a.prerelease.length && !b.prerelease.length) return -1;
  for (let i = 0; i < Math.max(a.prerelease.length, b.prerelease.length); i++) {
    const x = a.prerelease[i], y = b.prerelease[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    const xi = /^\d+$/.test(x), yi = /^\d+$/.test(y);
    if (xi && yi) {
      const left = BigInt(x), right = BigInt(y);
      return left === right ? 0 : left < right ? -1 : 1;
    }
    if (xi !== yi) return xi ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return 0;
}
