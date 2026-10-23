export type InspectionTemplateType = "APP_DEGRADATION" | "FIRE_OUTBREAK" | "CROP_PEST";

export interface FieldFormQuestion {
  id: string;
  label: string;
  type: "select" | "text" | "number" | "boolean" | "photo";
  options?: string[];
  required?: boolean;
}

export interface FieldFormTemplate {
  type: InspectionTemplateType;
  title: string;
  description: string;
  questions: FieldFormQuestion[];
}

export const BRAZILIAN_INSPECTION_TEMPLATES: Record<InspectionTemplateType, FieldFormTemplate> = {
  APP_DEGRADATION: {
    type: "APP_DEGRADATION",
    title: "Vistoria de APP e Reserva Legal",
    description: "Formulário de campo para fiscalização e conformidade ambiental em Áreas de Preservação Permanente (APP) e Reserva Legal.",
    questions: [
      { id: "app_type", label: "Tipo de APP", type: "select", options: ["Curso d'água", "Nascente / Olho d'água", "Encosta declivosa (>45°)", "Topo de morro"], required: true },
      { id: "degradation_cause", label: "Causa da Degradação", type: "select", options: ["Supressão vegetal ilegal", "Erosão / Voçoroca", "Pecuária extensiva em APP", "Resíduos sólidos / Lixo", "Nenhuma degradação"], required: true },
      { id: "soil_exposure_pct", label: "Porcentagem de Solo Exposto (%)", type: "number", required: true },
      { id: "observations", label: "Observações Técnicas", type: "text", required: false },
      { id: "photo_evidence", label: "Registro Fotográfico da Área", type: "photo", required: true },
    ],
  },
  FIRE_OUTBREAK: {
    type: "FIRE_OUTBREAK",
    title: "Registro de Queimada / Foco de Incêndio",
    description: "Relato de ocorrência de incêndio ou queimada não autorizada em imóvel rural.",
    questions: [
      { id: "fire_status", label: "Status do Incêndio", type: "select", options: ["Ativo em propagação", "Controlado", "Extinto recentemente"], required: true },
      { id: "affected_area_type", label: "Tipo de Vegetação Atingida", type: "select", options: ["Pastagem", "Lavoura", "Reserva Legal", "Cerrado Nativo / Floresta"], required: true },
      { id: "estimated_hectares", label: "Área Estimada Atingida (ha)", type: "number", required: false },
      { id: "wind_direction", label: "Direção Predominante do Vento", type: "select", options: ["Norte", "Sul", "Leste", "Oeste", "Variável"], required: false },
      { id: "photo_evidence", label: "Foto da Fumaça / Foco", type: "photo", required: true },
    ],
  },
  CROP_PEST: {
    type: "CROP_PEST",
    title: "Monitoramento de Pragas e Doenças na Lavoura",
    description: "Inspeção fitossanitária para controle de pragas em culturas agrícolas.",
    questions: [
      { id: "crop_type", label: "Cultura Agrícola", type: "select", options: ["Soja", "Milho", "Algodão", "Café", "Cana-de-açúcar", "Outros"], required: true },
      { id: "pest_identified", label: "Praga ou Doença Identificada", type: "text", required: true },
      { id: "severity_level", label: "Nível de Infestação", type: "select", options: ["Baixo (<10%)", "Moderado (10-30%)", "Alto (>30%)"], required: true },
      { id: "recommended_action", label: "Ação Corretiva Recomendada", type: "text", required: false },
      { id: "photo_evidence", label: "Foto dos Sintomas / Praga", type: "photo", required: true },
    ],
  },
};

export interface FormSubmission {
  templateType: InspectionTemplateType;
  timestamp: number;
  coordinate: [number, number]; // [lon, lat]
  answers: Record<string, unknown>;
  photoUrls?: string[];
}

export function validateFormSubmission(submission: FormSubmission): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const template = BRAZILIAN_INSPECTION_TEMPLATES[submission.templateType];

  if (!template) {
    return { isValid: false, errors: [`Unknown inspection template type: ${submission.templateType}`] };
  }

  if (!Array.isArray(submission.coordinate) || submission.coordinate.length !== 2 || !Number.isFinite(submission.coordinate[0]) || !Number.isFinite(submission.coordinate[1])) {
    errors.push("Submission must include valid [longitude, latitude] geographic coordinates");
  }

  for (const q of template.questions) {
    const val = submission.answers[q.id];
    if (q.required && (val === undefined || val === null || val === "")) {
      errors.push(`Required field missing: ${q.label} (${q.id})`);
    }
    if (q.type === "number" && val !== undefined && val !== "" && !Number.isFinite(Number(val))) {
      errors.push(`Field ${q.label} must be a valid number`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
