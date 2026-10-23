export const MAX_GLB_BYTES = 25 * 1024 * 1024;
const MAX_CHUNKS = 256;
const MAX_ACCESSORS = 100_000;
const MAX_BUFFER_VIEWS = 100_000;
const MAX_BUFFER_BYTES = 128 * 1024 * 1024;
const MAX_ELEMENTS = 10_000_000;
const MAX_JSON_DEPTH = 64;

export class MeshValidationError extends Error {
  readonly code = "INVALID_MESH";

  constructor(message: string) {
    super(message);
    this.name = "MeshValidationError";
  }
}

export interface ValidatedGlb {
  json: Record<string, unknown>;
  bin: Uint8Array;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new MeshValidationError(`${label} inválido.`);
  }
  return value as Record<string, unknown>;
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new MeshValidationError(`${label} inválido.`);
  }
  return value;
}

function inspectNoExternalUris(value: unknown, depth = 0): void {
  if (depth > MAX_JSON_DEPTH)
    throw new MeshValidationError("JSON GLB excessivamente profundo.");
  if (Array.isArray(value)) {
    value.forEach((child) => inspectNoExternalUris(child, depth + 1));
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [key, child] of Object.entries(value)) {
    if (key === "uri" && typeof child === "string") {
      throw new MeshValidationError("GLB com recurso externo não é suportado.");
    }
    inspectNoExternalUris(child, depth + 1);
  }
}

export function validateGlbBytes(bytes: Uint8Array): ValidatedGlb {
  if (bytes.byteLength > MAX_GLB_BYTES) {
    throw new MeshValidationError("O GLB excede o limite de 25 MiB.");
  }
  if (bytes.byteLength < 20) {
    throw new MeshValidationError("Arquivo GLB incompleto.");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) {
    throw new MeshValidationError("O arquivo precisa ser um GLB válido.");
  }
  if (view.getUint32(4, true) !== 2) {
    throw new MeshValidationError("Somente GLB versão 2 é suportado.");
  }
  const declaredLength = view.getUint32(8, true);
  if (declaredLength !== bytes.byteLength) {
    throw new MeshValidationError("O tamanho declarado do GLB não confere.");
  }

  let offset = 12;
  let json: Record<string, unknown> | undefined;
  let bin = new Uint8Array();
  let chunkCount = 0;
  while (offset < declaredLength) {
    if (offset + 8 > declaredLength || ++chunkCount > MAX_CHUNKS) {
      throw new MeshValidationError("Chunks GLB inválidos ou excessivos.");
    }
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    offset += 8;
    if (chunkLength > declaredLength - offset) {
      throw new MeshValidationError("Chunk GLB ultrapassa o arquivo.");
    }
    const chunk = bytes.subarray(offset, offset + chunkLength);
    offset += chunkLength;
    if (chunkType === 0x4e4f534a) {
      if (json !== undefined)
        throw new MeshValidationError("GLB possui JSON duplicado.");
      try {
        const text = new TextDecoder()
          .decode(chunk)
          .replace(/\u0000+$/g, "")
          .trim();
        json = asRecord(JSON.parse(text), "JSON GLB");
      } catch (error) {
        if (error instanceof MeshValidationError) throw error;
        throw new MeshValidationError("JSON GLB inválido.");
      }
    } else if (chunkType === 0x004e4942) {
      if (bin.byteLength > 0)
        throw new MeshValidationError("GLB possui BIN duplicado.");
      bin = new Uint8Array(chunk);
    }
  }
  if (!json) throw new MeshValidationError("GLB sem chunk JSON.");
  inspectNoExternalUris(json);

  const extensions = json.extensionsUsed;
  if (
    Array.isArray(extensions) &&
    extensions.some(
      (item) =>
        item === "KHR_draco_mesh_compression" ||
        item === "KHR_texture_basisu" ||
        item === "EXT_meshopt_compression",
    )
  ) {
    throw new MeshValidationError("GLB comprimido não é suportado.");
  }
  if (Array.isArray(json.images) && json.images.length > 0) {
    throw new MeshValidationError(
      "GLB com texturas embutidas não é suportado nesta versão.",
    );
  }

  const buffers = Array.isArray(json.buffers) ? json.buffers : [];
  if (buffers.length > 0) {
    if (buffers.length !== 1)
      throw new MeshValidationError("O GLB deve possuir um único buffer.");
    const length = nonNegativeInteger(
      asRecord(buffers[0], "buffer").byteLength,
      "buffer.byteLength",
    );
    if (length > MAX_BUFFER_BYTES || length > bin.byteLength) {
      throw new MeshValidationError("Buffer GLB excede os limites declarados.");
    }
  }
  const accessors = Array.isArray(json.accessors) ? json.accessors : [];
  const views = Array.isArray(json.bufferViews) ? json.bufferViews : [];
  if (accessors.length > MAX_ACCESSORS || views.length > MAX_BUFFER_VIEWS) {
    throw new MeshValidationError("GLB excede o orçamento de geometria.");
  }
  const nodes = Array.isArray(json.nodes) ? json.nodes : [];
  const scenes = Array.isArray(json.scenes) ? json.scenes : [];
  const meshes = Array.isArray(json.meshes) ? json.meshes : [];
  const nodeIndex = (value: unknown, label: string) => {
    const index = nonNegativeInteger(value, label);
    if (index >= nodes.length)
      throw new MeshValidationError(`${label} fora do GLB.`);
    return index;
  };
  for (const scene of scenes) {
    const roots = asRecord(scene, "scene").nodes;
    if (roots !== undefined) {
      if (!Array.isArray(roots))
        throw new MeshValidationError("Raízes de cena inválidas.");
      roots.forEach((value) => nodeIndex(value, "scene.node"));
    }
  }
  const visiting = new Set<number>();
  const visited = new Set<number>();
  const visitNode = (index: number) => {
    if (visiting.size > 64)
      throw new MeshValidationError("Hierarquia GLB muito profunda.");
    if (visiting.has(index))
      throw new MeshValidationError("Ciclo de nós GLB não é suportado.");
    if (visited.has(index)) return;
    visiting.add(index);
    const node = asRecord(nodes[index], "node");
    if (
      node.mesh !== undefined &&
      nonNegativeInteger(node.mesh, "node.mesh") >= meshes.length
    )
      throw new MeshValidationError("node.mesh fora do GLB.");
    if (node.children !== undefined) {
      if (!Array.isArray(node.children))
        throw new MeshValidationError("Filhos de nó inválidos.");
      node.children.forEach((child) =>
        visitNode(nodeIndex(child, "node.child")),
      );
    }
    visiting.delete(index);
    visited.add(index);
  };
  nodes.forEach((_node, index) => visitNode(index));
  for (const item of views) {
    const record = asRecord(item, "bufferView");
    const start = nonNegativeInteger(
      record.byteOffset ?? 0,
      "bufferView.byteOffset",
    );
    const length = nonNegativeInteger(
      record.byteLength,
      "bufferView.byteLength",
    );
    if (start + length > bin.byteLength)
      throw new MeshValidationError("bufferView fora do BIN.");
  }
  let primitiveCount = 0;
  for (const mesh of meshes) {
    const primitives = asRecord(mesh, "mesh").primitives;
    if (!Array.isArray(primitives))
      throw new MeshValidationError("Mesh sem primitives válidas.");
    for (const primitive of primitives) {
      primitiveCount += 1;
      const record = asRecord(primitive, "primitive");
      const attributes = asRecord(record.attributes, "primitive.attributes");
      const position = nonNegativeInteger(
        attributes.POSITION,
        "POSITION accessor",
      );
      if (position >= accessors.length)
        throw new MeshValidationError("POSITION accessor fora do GLB.");
      if (
        record.indices !== undefined &&
        nonNegativeInteger(record.indices, "indices accessor") >=
          accessors.length
      )
        throw new MeshValidationError("indices accessor fora do GLB.");
    }
  }
  if (primitiveCount === 0)
    throw new MeshValidationError("GLB sem geometria renderizável.");
  let totalElements = 0;
  for (const item of accessors) {
    const record = asRecord(item, "accessor");
    const count = nonNegativeInteger(record.count, "accessor.count");
    if (record.sparse !== undefined)
      throw new MeshValidationError("Sparse accessors não são suportados.");
    totalElements += count;
    if (totalElements > MAX_ELEMENTS)
      throw new MeshValidationError("GLB excede o orçamento de elementos.");
    if (record.bufferView !== undefined) {
      const bufferView = nonNegativeInteger(
        record.bufferView,
        "accessor.bufferView",
      );
      if (bufferView >= views.length)
        throw new MeshValidationError(
          "Accessor referencia bufferView inexistente.",
        );
    }
    if (record.min !== undefined || record.max !== undefined) {
      for (const values of [record.min, record.max]) {
        if (
          !Array.isArray(values) ||
          values.some(
            (value) => typeof value !== "number" || !Number.isFinite(value),
          )
        ) {
          throw new MeshValidationError(
            "Limites numéricos do accessor inválidos.",
          );
        }
      }
    }
  }
  const positions = new Set<number>();
  for (const mesh of meshes) {
    for (const primitive of asRecord(mesh, "mesh").primitives as unknown[]) {
      positions.add(
        nonNegativeInteger(
          asRecord(asRecord(primitive, "primitive").attributes, "attributes")
            .POSITION,
          "POSITION",
        ),
      );
    }
  }
  const binary = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  for (const index of positions) {
    const accessor = asRecord(accessors[index], "POSITION");
    if (
      accessor.type !== "VEC3" ||
      accessor.componentType !== 5126 ||
      accessor.count === 0
    )
      throw new MeshValidationError(
        "POSITION deve conter vetores Float32 não vazios.",
      );
    const bufferView = asRecord(
      views[nonNegativeInteger(accessor.bufferView, "POSITION.bufferView")],
      "POSITION.bufferView",
    );
    if (bufferView.buffer !== 0)
      throw new MeshValidationError("POSITION referencia buffer desconhecido.");
    const relativeStart = nonNegativeInteger(
      accessor.byteOffset ?? 0,
      "POSITION.byteOffset",
    );
    const stride = nonNegativeInteger(
      bufferView.byteStride ?? 12,
      "POSITION.byteStride",
    );
    const count = nonNegativeInteger(accessor.count, "POSITION.count");
    if (
      stride < 12 ||
      stride % 4 !== 0 ||
      relativeStart % 4 !== 0 ||
      relativeStart + (count - 1) * stride + 12 > Number(bufferView.byteLength)
    )
      throw new MeshValidationError("POSITION ultrapassa o buffer declarado.");
    const start = Number(bufferView.byteOffset ?? 0) + relativeStart;
    for (let vertex = 0; vertex < count; vertex++) {
      for (let axis = 0; axis < 3; axis++)
        if (
          !Number.isFinite(
            binary.getFloat32(start + vertex * stride + axis * 4, true),
          )
        )
          throw new MeshValidationError(
            "A geometria contém coordenadas não finitas.",
          );
    }
  }
  return { json, bin };
}

export async function validateGlbFile(file: File): Promise<ValidatedGlb> {
  if (file.size > MAX_GLB_BYTES) {
    throw new MeshValidationError("O GLB excede o limite de 25 MiB.");
  }
  if (!file.name.toLowerCase().endsWith(".glb")) {
    throw new MeshValidationError("Selecione um arquivo GLB.");
  }
  return validateGlbBytes(new Uint8Array(await file.arrayBuffer()));
}
