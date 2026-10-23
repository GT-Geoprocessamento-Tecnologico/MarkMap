export interface PropertyPopupData {
  name?: unknown;
  area?: unknown;
  owner?: unknown;
}

/** Build the property popup from DOM nodes so feature values are always text. */
export function createPropertyPopupContent(
  props: PropertyPopupData,
): HTMLDivElement {
  const content = document.createElement("div");
  content.style.cssText =
    "padding:8px;font-family:monospace;font-size:13px;color:#1e293b";

  const name = document.createElement("strong");
  name.textContent = String(props.name ?? "");
  content.append(name, document.createElement("br"));

  content.append(
    "Área: ",
    document.createTextNode(String(props.area ?? "")),
    document.createElement("br"),
  );
  content.append(
    "Proprietário: ",
    document.createTextNode(String(props.owner ?? "")),
  );

  return content;
}
