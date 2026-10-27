export interface PropertyPopupData {
  name?: unknown;
  area?: unknown;
  owner?: unknown;
  // CAR attributes
  cod_imovel?: unknown;
  carCode?: unknown;
  car_code?: unknown;
  tipo_tema?: unknown;
  nom_tema?: unknown;
  layerType?: unknown;
  _carLayerType?: unknown;
  nom_mun?: unknown;
  municipio?: unknown;
  municipality?: unknown;
  uf?: unknown;
  state?: unknown;
  status?: unknown;
  ind_status?: unknown;
  num_area?: unknown;
}

/** Build the property popup from DOM nodes so feature values are always text. */
export function createPropertyPopupContent(props: PropertyPopupData): HTMLDivElement {
  const content = document.createElement('div');
  content.style.cssText = 'padding:8px;font-family:monospace;font-size:13px;color:#1e293b';

  const carCode = props.carCode ?? props.cod_imovel ?? props.car_code;
  const displayName = props.name ?? (carCode ? String(carCode) : '');

  const name = document.createElement('strong');
  name.textContent = String(displayName);
  content.append(name, document.createElement('br'));

  const areaVal = props.area ?? (props.num_area != null ? `${String(props.num_area)} ha` : '');
  content.append('Área: ', document.createTextNode(String(areaVal)), document.createElement('br'));
  content.append('Proprietário: ', document.createTextNode(String(props.owner ?? '')));

  if (carCode && props.name) {
    content.append(document.createElement('br'), 'CAR: ', document.createTextNode(String(carCode)));
  }

  const layer = props.tipo_tema ?? props.nom_tema ?? props.layerType ?? props._carLayerType;
  if (layer) {
    content.append(document.createElement('br'), 'Camada: ', document.createTextNode(String(layer)));
  }

  const mun = props.nom_mun ?? props.municipio ?? props.municipality;
  const uf = props.uf ?? props.state;
  const locality = [mun, uf].filter(Boolean).map(String).join(' - ');
  if (locality) {
    content.append(document.createElement('br'), 'Município: ', document.createTextNode(locality));
  }

  const status = props.status ?? props.ind_status;
  if (status) {
    content.append(document.createElement('br'), 'Status: ', document.createTextNode(String(status)));
  }

  return content;
}
