const MAX_KMZ_UNCOMPRESSED_BYTES = 500 * 1024 * 1024;
const MAX_KMZ_ENTRIES = 10000;
const MAX_IMPORT_FILE_BYTES = 50 * 1024 * 1024;
const MAX_XML_DEPTH = 100;
const MAX_XML_ELEMENTS = 500000;

export function validateAssetPath(path: string): boolean {
  if (path.startsWith("/") || path.endsWith("/")) return false;
  if (path.includes("\\") || path.includes("..")) return false;
  if (/[%?#:]/.test(path)) return false;
  const segments = path.split("/");
  return segments.every(
    (s) =>
      s.length > 0 &&
      s !== "." &&
      s !== ".." &&
      /^[A-Za-z0-9._@-]+$/.test(s),
  );
}

export function sanitizeExternalUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (parsed.hostname.includes("localhost") || parsed.hostname === "127.0.0.1") return null;
    if (parsed.hostname.endsWith(".local")) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function validateFileSize(sizeBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= MAX_IMPORT_FILE_BYTES;
}

export function validateXmlDepth(xml: string): boolean {
  const stack: string[] = [];
  const tagRegex = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s[^>]*)?)(\/?)>/g;
  let match: RegExpExecArray | null;
  let elementCount = 0;

  while ((match = tagRegex.exec(xml)) !== null) {
    elementCount++;
    if (elementCount > MAX_XML_ELEMENTS) return false;

    const isClosing = match[1] === "/";
    const tagName = match[2]!;
    const isSelfClosing = match[4] === "/";

    if (isClosing) {
      const top = stack.pop();
      if (top !== tagName) return false;
    } else if (!isSelfClosing) {
      stack.push(tagName);
      if (stack.length > MAX_XML_DEPTH) return false;
    }
  }

  return stack.length === 0;
}

export function detectXmlBillionLaughs(xml: string): boolean {
  if (/<!ENTITY/i.test(xml)) return true;
  if (/<!DOCTYPE[^>]*\[/i.test(xml) && /<!ENTITY/i.test(xml)) return true;
  return false;
}

export function validateChecksum(
  data: Uint8Array,
  expectedSha256: string,
): Promise<boolean> {
  const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  return crypto.subtle
    .digest("SHA-256", buffer)
    .then((digest) => {
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return hex === expectedSha256.toLowerCase();
    })
    .catch(() => false);
}

export function validatePmtilesHeader(header: Uint8Array): boolean {
  if (header.length < 4) return false;
  const magic = new TextDecoder().decode(header.subarray(0, 7));
  return magic === "PMTiles";
}

export function sanitizeUserInput(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/on\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/on\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/data\s*:\s*text\/html/gi, "");
}

export function detectZipBomb(
  compressedBytes: number,
  uncompressedBytes: number,
  entryCount: number,
): boolean {
  if (entryCount > MAX_KMZ_ENTRIES) return true;
  if (uncompressedBytes > MAX_KMZ_UNCOMPRESSED_BYTES) return true;
  if (compressedBytes > 0 && uncompressedBytes / compressedBytes > 1000) return true;
  return false;
}

export const SECURITY_LIMITS = {
  MAX_KMZ_UNCOMPRESSED_BYTES,
  MAX_KMZ_ENTRIES,
  MAX_IMPORT_FILE_BYTES,
  MAX_XML_DEPTH,
  MAX_XML_ELEMENTS,
} as const;
