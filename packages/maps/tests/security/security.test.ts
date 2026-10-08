import { describe, it, expect } from "vitest";
import {
  validateAssetPath,
  sanitizeExternalUrl,
  validateFileSize,
  validateXmlDepth,
  detectXmlBillionLaughs,
  sanitizeUserInput,
  detectZipBomb,
  validatePmtilesHeader,
  SECURITY_LIMITS,
} from "../../src/security/index.js";

describe("validateAssetPath", () => {
  it("accepts valid POSIX paths", () => {
    expect(validateAssetPath("style.json")).toBe(true);
    expect(validateAssetPath("glyphs/font.pbf")).toBe(true);
    expect(validateAssetPath("sprites/light@2x.png")).toBe(true);
  });

  it("rejects path traversal", () => {
    expect(validateAssetPath("../secret")).toBe(false);
    expect(validateAssetPath("a/../../b")).toBe(false);
    expect(validateAssetPath("..")).toBe(false);
  });

  it("rejects absolute paths", () => {
    expect(validateAssetPath("/etc/passwd")).toBe(false);
    expect(validateAssetPath("C:\\Windows")).toBe(false);
  });

  it("rejects special characters", () => {
    expect(validateAssetPath("file name")).toBe(false);
    expect(validateAssetPath("file%20name")).toBe(false);
    expect(validateAssetPath("file:name")).toBe(false);
    expect(validateAssetPath("file?query")).toBe(false);
  });
});

describe("sanitizeExternalUrl", () => {
  it("accepts valid https URLs", () => {
    expect(sanitizeExternalUrl("https://example.com/path")).toBe("https://example.com/path");
  });

  it("rejects javascript: URLs", () => {
    expect(sanitizeExternalUrl("javascript:alert(1)")).toBeNull();
  });

  it("rejects data: URLs", () => {
    expect(sanitizeExternalUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("rejects localhost", () => {
    expect(sanitizeExternalUrl("http://localhost:3000")).toBeNull();
    expect(sanitizeExternalUrl("http://127.0.0.1")).toBeNull();
  });
});

describe("validateFileSize", () => {
  it("accepts reasonable sizes", () => {
    expect(validateFileSize(1024)).toBe(true);
    expect(validateFileSize(10 * 1024 * 1024)).toBe(true);
  });

  it("rejects zero and negative", () => {
    expect(validateFileSize(0)).toBe(false);
    expect(validateFileSize(-1)).toBe(false);
  });

  it("rejects files over limit", () => {
    expect(validateFileSize(SECURITY_LIMITS.MAX_IMPORT_FILE_BYTES + 1)).toBe(false);
  });
});

describe("validateXmlDepth", () => {
  it("accepts shallow XML", () => {
    expect(validateXmlDepth("<a><b><c>text</c></b></a>")).toBe(true);
  });

  it("rejects deeply nested XML", () => {
    let xml = "";
    for (let i = 0; i < 200; i++) xml += `<d${i}>`;
    xml += "text";
    for (let i = 199; i >= 0; i--) xml += `</d${i}>`;
    expect(validateXmlDepth(xml)).toBe(false);
  });

  it("rejects unbalanced XML", () => {
    expect(validateXmlDepth("<a><b></a></b>")).toBe(false);
  });
});

describe("detectXmlBillionLaughs", () => {
  it("detects ENTITY declarations", () => {
    expect(detectXmlBillionLaughs('<!DOCTYPE foo [<!ENTITY x "y">]>')).toBe(true);
  });

  it("accepts normal XML", () => {
    expect(detectXmlBillionLaughs("<a><b>text</b></a>")).toBe(false);
  });
});

describe("sanitizeUserInput", () => {
  it("removes script tags", () => {
    expect(sanitizeUserInput('<script>alert(1)</script>')).not.toContain("<script>");
  });

  it("removes event handlers", () => {
    expect(sanitizeUserInput('<div onclick="alert(1)">x</div>')).not.toContain("onclick");
  });

  it("removes javascript: URLs", () => {
    expect(sanitizeUserInput("javascript:alert(1)")).not.toContain("javascript:");
  });

  it("preserves normal text", () => {
    expect(sanitizeUserInput("Hello World")).toBe("Hello World");
  });
});

describe("detectZipBomb", () => {
  it("detects high compression ratio", () => {
    expect(detectZipBomb(1024, 1024 * 1024 * 1024, 10)).toBe(true);
  });

  it("detects too many entries", () => {
    expect(detectZipBomb(1024, 2048, SECURITY_LIMITS.MAX_KMZ_ENTRIES + 1)).toBe(true);
  });

  it("accepts normal zip", () => {
    expect(detectZipBomb(1024 * 1024, 5 * 1024 * 1024, 100)).toBe(false);
  });
});

describe("validatePmtilesHeader", () => {
  it("accepts valid PMTiles header", () => {
    const header = new TextEncoder().encode("PMTiles\x03");
    expect(validatePmtilesHeader(header)).toBe(true);
  });

  it("rejects invalid header", () => {
    const header = new TextEncoder().encode("NOTILES");
    expect(validatePmtilesHeader(header)).toBe(false);
  });

  it("rejects short header", () => {
    expect(validatePmtilesHeader(new Uint8Array([80, 77]))).toBe(false);
  });
});
