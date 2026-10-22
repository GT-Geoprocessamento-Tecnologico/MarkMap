import type { GpxImport, KmlProperties, TrackPoint } from "./gpx-types.js";

const MAX_XML_BYTES = 25 * 1024 * 1024;
const MAX_DEPTH = 100;
const MAX_NODES = 100_000;
const MAX_POSITIONS = 100_000;
const MAX_PROPERTIES = 128;
const MAX_PROPERTY_TEXT = 4096;

interface XmlNode {
  name: string;
  local: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;
}
type ParsedGeometry =
  | { kind: "point"; point: TrackPoint }
  | { kind: "line"; points: TrackPoint[] }
  | { kind: "polygon"; rings: TrackPoint[][] };
export interface ParseKmlOptions {
  strict?: boolean;
}

export function parseKml(
  xml: string,
  options: ParseKmlOptions = {},
): GpxImport {
  if (typeof xml !== "string" || !xml.trim().startsWith("<"))
    throw new Error("Invalid KML: not XML");
  if (xml.length > MAX_XML_BYTES || /<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml))
    throw new Error("Invalid KML: unsafe XML declaration");
  const root = parseXml(xml);
  if (root.local.toLowerCase() !== "kml")
    throw new Error("Invalid KML: root element must be kml");
  if (findDescendants(root, "NetworkLink").length > 0)
    throw new Error("Invalid KML: NetworkLink is not supported");
  const result: GpxImport = {
    tracks: [],
    waypoints: [],
    routes: [],
    polygons: [],
  };
  let placemarkIndex = 0;
  const usedIds = new Set<string>();
  for (const placemark of findDescendants(root, "Placemark")) {
    const name = childText(placemark, "name") ?? `Place ${placemarkIndex + 1}`;
    const description = childText(placemark, "description");
    const properties = kmlProperties(placemark, name, description);
    const baseId = uniqueId(
      safeId(placemark.attrs.id) ?? `kml-${placemarkIndex + 1}`,
      usedIds,
    );
    const budget = { positions: 0 };
    let geometryIndex = 0;
    for (const geometry of geometryChildren(placemark)) {
      const id =
        geometryIndex === 0
          ? baseId
          : uniqueId(`${baseId}:${geometryIndex + 1}`, usedIds);
      const parsed = parseGeometry(geometry, budget, options.strict === true);
      geometryIndex++;
      if (!parsed) {
        if (options.strict) throw new Error("Invalid KML: invalid geometry");
        continue;
      }
      if (parsed.kind === "point")
        result.waypoints.push({
          id,
          name,
          description,
          latitude: parsed.point.latitude,
          longitude: parsed.point.longitude,
          elevation: parsed.point.elevation ?? null,
          properties,
        });
      else if (parsed.kind === "line")
        result.tracks.push({
          id,
          name,
          description,
          segments: [{ id: `${id}:segment`, points: parsed.points }],
          properties,
        });
      else
        result.polygons!.push({
          id,
          name,
          description,
          rings: parsed.rings,
          properties,
        });
    }
    placemarkIndex++;
  }
  return result;
}

function parseXml(xml: string): XmlNode {
  const root: XmlNode = {
    name: "#root",
    local: "#root",
    attrs: {},
    children: [],
    text: "",
  };
  const stack: XmlNode[] = [root];
  let nodes = 0;
  let depth = 0;
  let match: RegExpExecArray | null;
  const tokens =
    /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<(?:[^"'<>]|"[^"]*"|'[^']*')+>|[^<]+/g;
  let cursor = 0;
  while ((match = tokens.exec(xml))) {
    if (match.index !== cursor)
      throw new Error("Invalid KML: malformed XML fragment");
    cursor = tokens.lastIndex;
    const token = match[0]!;
    if (token.startsWith("<!--") || token.startsWith("<?")) continue;
    if (token.startsWith("<![CDATA[")) {
      stack.at(-1)!.text += token.slice(9, -3);
      continue;
    }
    if (!token.startsWith("<")) {
      stack.at(-1)!.text += decodeEntities(token);
      continue;
    }
    if (token.startsWith("</")) {
      const name = token.slice(2, -1).trim();
      if (
        !/^[-\w:.]+$/.test(name) ||
        stack.length === 1 ||
        stack.at(-1)!.name !== name
      )
        throw new Error("Invalid KML: mismatched XML tags");
      stack.pop();
      depth--;
      continue;
    }
    if (token.startsWith("<!"))
      throw new Error("Invalid KML: unsupported XML declaration");
    const selfClosing = /\/\s*>$/.test(token);
    const body = token.slice(1, selfClosing ? -2 : -1).trim();
    const tag = body.match(/^([-\w:.]+)([\s\S]*)$/);
    if (!tag) throw new Error("Invalid KML: malformed XML tag");
    const node: XmlNode = {
      name: tag[1]!,
      local: localName(tag[1]!),
      attrs: parseAttributes(tag[2]!),
      children: [],
      text: "",
    };
    if (++nodes > MAX_NODES || ++depth > MAX_DEPTH)
      throw new Error("Invalid KML: XML limits exceeded");
    stack.at(-1)!.children.push(node);
    if (!selfClosing) stack.push(node);
    else depth--;
  }
  if (cursor !== xml.length || stack.length !== 1)
    throw new Error("Invalid KML: incomplete XML");
  const documentRoot = root.children.find(
    (child) => child.local.toLowerCase() === "kml",
  );
  if (!documentRoot || root.children.length !== 1)
    throw new Error("Invalid KML: missing root");
  return documentRoot;
}

function parseAttributes(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  let index = 0;
  while (index < source.length) {
    while (/\s/.test(source[index] ?? "")) index++;
    if (index >= source.length) break;
    const name = source.slice(index).match(/^([-\w:.]+)/);
    if (!name) throw new Error("Invalid KML: malformed attribute");
    index += name[0].length;
    while (/\s/.test(source[index] ?? "")) index++;
    if (source[index] !== "=")
      throw new Error("Invalid KML: attribute without value");
    index++;
    while (/\s/.test(source[index] ?? "")) index++;
    const quote = source[index];
    if (quote !== '"' && quote !== "'")
      throw new Error("Invalid KML: unquoted attribute");
    const end = source.indexOf(quote, index + 1);
    if (end < 0) throw new Error("Invalid KML: unterminated attribute");
    attrs[name[0]] = decodeEntities(source.slice(index + 1, end));
    index = end + 1;
  }
  return attrs;
}

function localName(name: string): string {
  const index = name.lastIndexOf(":");
  return index >= 0 ? name.slice(index + 1) : name;
}
function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,
    (_, value: string) =>
      value.toLowerCase() === "amp"
        ? "&"
        : value.toLowerCase() === "lt"
          ? "<"
          : value.toLowerCase() === "gt"
            ? ">"
            : value.toLowerCase() === "quot"
              ? '"'
              : value.toLowerCase() === "apos"
                ? "'"
                : String.fromCodePoint(
                    value.toLowerCase().startsWith("#x")
                      ? parseInt(value.slice(2), 16)
                      : Number(value.slice(1)),
                  ),
  );
}
function children(node: XmlNode, name: string): XmlNode[] {
  return node.children.filter((child) => child.local === name);
}
function findDescendants(node: XmlNode, name: string): XmlNode[] {
  return node.children.flatMap((child) =>
    child.local === name
      ? [child, ...findDescendants(child, name)]
      : findDescendants(child, name),
  );
}
function childText(node: XmlNode, name: string): string | null {
  const child = children(node, name)[0];
  const text = child?.text.trim();
  return text ? text : null;
}
function safeId(value: string | undefined): string | null {
  return value && value.length <= 256 && /^[\w.:-]+$/.test(value)
    ? value
    : null;
}

function kmlProperties(
  placemark: XmlNode,
  name: string,
  description: string | null,
): KmlProperties {
  const properties: KmlProperties = { name, description };
  for (const data of findDescendants(placemark, "Data")) {
    const key = data.attrs.name;
    const value = childText(data, "value");
    if (key && value !== null) addScalar(properties, key, value);
  }
  for (const data of findDescendants(placemark, "SimpleData")) {
    const key = data.attrs.name;
    if (key) addScalar(properties, key, data.text.trim());
  }
  return properties;
}
function addScalar(properties: KmlProperties, key: string, raw: string): void {
  if (Object.keys(properties).length >= MAX_PROPERTIES)
    throw new Error("Invalid KML: too many scalar properties");
  if (key === "__proto__" || key === "constructor" || key === "prototype")
    throw new Error("Invalid KML: unsafe scalar property name");
  if (key.length > 256 || raw.length > MAX_PROPERTY_TEXT)
    throw new Error("Invalid KML: scalar property exceeds limits");
  properties[key] = raw;
}

function geometryChildren(placemark: XmlNode): XmlNode[] {
  return placemark.children.flatMap((child) =>
    ["Point", "LineString", "Polygon", "MultiGeometry"].includes(child.local)
      ? flattenGeometry(child)
      : [],
  );
}
function flattenGeometry(node: XmlNode): XmlNode[] {
  return node.local === "MultiGeometry"
    ? node.children.flatMap(flattenGeometry)
    : [node];
}
function parseGeometry(
  node: XmlNode,
  budget: { positions: number },
  strict: boolean,
): ParsedGeometry | null {
  if (node.local === "Point") {
    const points = parsePositions(childText(node, "coordinates") ?? "", budget);
    if (strict && points.length !== 1)
      throw new Error("Invalid KML: Point requires exactly one coordinate");
    const point = points[0];
    return point ? { kind: "point", point } : null;
  }
  if (node.local === "LineString") {
    const points = parsePositions(childText(node, "coordinates") ?? "", budget);
    return points.length >= 2 ? { kind: "line", points } : null;
  }
  if (node.local === "Polygon") {
    const outer = findDescendants(node, "outerBoundaryIs");
    if (outer.length !== 1) return null;
    const outerPoints = parsePositions(
      descendantText(outer[0]!, "coordinates") ?? "",
      budget,
    );
    if (outerPoints.length < 3) return null;
    if (!samePoint(outerPoints[0]!, outerPoints.at(-1)!))
      outerPoints.push({ ...outerPoints[0]! });
    if (outerPoints.length < 4) return null;
    const rings: TrackPoint[][] = [outerPoints];
    for (const boundary of findDescendants(node, "innerBoundaryIs")) {
      const points = parsePositions(
        descendantText(boundary, "coordinates") ?? "",
        budget,
      );
      if (points.length < 3) return null;
      if (!samePoint(points[0]!, points.at(-1)!))
        points.push({ ...points[0]! });
      if (points.length < 4) return null;
      rings.push(points);
    }
    return { kind: "polygon", rings };
  }
  return null;
}
function parsePositions(
  text: string,
  budget: { positions: number },
): TrackPoint[] {
  const points: TrackPoint[] = [];
  for (const tuple of text.trim().split(/\s+/).filter(Boolean)) {
    if (++budget.positions > MAX_POSITIONS)
      throw new Error("Invalid KML: position limit exceeded");
    const parts = tuple.split(",");
    if (
      parts.length < 2 ||
      parts.length > 3 ||
      parts[0] === "" ||
      parts[1] === ""
    )
      return [];
    const longitude = Number(parts[0]);
    const latitude = Number(parts[1]);
    const elevation =
      parts[2] === undefined || parts[2] === "" ? null : Number(parts[2]);
    if (
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      longitude < -180 ||
      longitude > 180 ||
      latitude < -90 ||
      latitude > 90 ||
      (elevation !== null && !Number.isFinite(elevation))
    )
      return [];
    points.push({ longitude, latitude, elevation });
  }
  return points;
}
function descendantText(node: XmlNode, name: string): string | null {
  const child = findDescendants(node, name)[0];
  const text = child?.text.trim();
  return text ? text : null;
}
function samePoint(a: TrackPoint, b: TrackPoint): boolean {
  return a.longitude === b.longitude && a.latitude === b.latitude;
}
function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base}:${suffix++}`;
  used.add(id);
  return id;
}
