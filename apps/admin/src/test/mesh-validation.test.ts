import { describe, expect, it } from "vitest";
import { MAX_GLB_BYTES, MeshValidationError, validateGlbBytes, validateGlbFile } from "../lib/mesh/validation";

function fixture(overrides: Record<string, unknown> = {}): Uint8Array {
  const json = { asset: { version: "2.0" }, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [1, 1, 1] }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }], buffers: [{ byteLength: 36 }], ...overrides };
  const text = new TextEncoder().encode(JSON.stringify(json)); const jsonLength = Math.ceil(text.byteLength / 4) * 4; const bin = new Uint8Array(36); const total = 12 + 8 + jsonLength + 8 + bin.byteLength; const output = new Uint8Array(total); const view = new DataView(output.buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, total, true); view.setUint32(12, jsonLength, true); view.setUint32(16, 0x4e4f534a, true); output.set(text, 20); output.fill(0x20, 20 + text.byteLength, 20 + jsonLength); const binOffset = 20 + jsonLength; view.setUint32(binOffset, bin.byteLength, true); view.setUint32(binOffset + 4, 0x004e4942, true); output.set(bin, binOffset + 8); return output;
}

describe("GLB validation", () => {
  it("accepts a bounded self-contained GLB", () => expect(validateGlbBytes(fixture()).bin.byteLength).toBe(36));
  it("rejects external resources and compressed extensions", () => {
    expect(() => validateGlbBytes(fixture({ images: [{ uri: "https://example.test/a.png" }] }))).toThrow(MeshValidationError);
    expect(() => validateGlbBytes(fixture({ extensionsUsed: ["KHR_draco_mesh_compression"] }))).toThrow(MeshValidationError);
  });
  it("rejects malformed headers and out-of-range views", () => {
    const malformed = fixture(); malformed[0] = 0; expect(() => validateGlbBytes(malformed)).toThrow(MeshValidationError);
    expect(() => validateGlbBytes(fixture({ bufferViews: [{ buffer: 0, byteOffset: 32, byteLength: 36 }] }))).toThrow(MeshValidationError);
  });
  it("rejects oversized files before reading their bytes", async () => {
    const file = new File([new Uint8Array([1])], "large.glb");
    Object.defineProperty(file, "size", { value: MAX_GLB_BYTES + 1 });
    const read = vi.fn();
    Object.defineProperty(file, "arrayBuffer", { value: read });
    await expect(validateGlbFile(file)).rejects.toThrow(MeshValidationError);
    expect(read).not.toHaveBeenCalled();
  });
  it('rejects non-finite actual vertices despite finite declared bounds', () => {
    const bytes = fixture();
    new DataView(bytes.buffer).setFloat32(bytes.byteLength - 36, Number.NaN, true);
    expect(() => validateGlbBytes(bytes)).toThrow('não finitas');
  });
});
