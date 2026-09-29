import { errorCodeSchema } from '@geonexo/contracts';
import type { ErrorCode } from '@geonexo/contracts';

/**
 * Erro tipado do transporte HTTP/mock. O front decide comportamento pelo
 * `code`, nunca pelo texto da mensagem (50-CONTRATOS-DE-INTEGRACAO.md:96-108).
 */
export class ApiError extends Error {
  readonly code: ErrorCode | string;
  readonly status: number;
  readonly requestId: string | undefined;

  constructor(params: { code: ErrorCode | string; message: string; status: number; requestId?: string }) {
    super(params.message);
    this.name = 'ApiError';
    this.code = params.code;
    this.status = params.status;
    this.requestId = params.requestId;
  }
}

const USER_MESSAGES: Record<ErrorCode, string> = {
  PROJECT_NOT_FOUND: 'Projeto não encontrado.',
  LAYER_NOT_FOUND: 'Camada não encontrada.',
  FEATURE_NOT_FOUND: 'Elemento não encontrado.',
  IMPORT_NOT_FOUND: 'Importação não encontrada.',
  ROUTE_NOT_FOUND: 'Recurso não encontrado.',
  INVALID_GEOMETRY: 'Geometria inválida para esta operação.',
  GEOMETRY_TYPE_MISMATCH: 'A geometria não corresponde ao tipo de geometria da camada.',
  VERSION_CONFLICT: 'Este item foi alterado em outra sessão. Recarregue antes de salvar.',
  IMPORT_UNSUPPORTED_FORMAT: 'Formato de arquivo não suportado.',
  VALIDATION_ERROR: 'Dados inválidos. Revise os campos e tente novamente.',
  INTERNAL_ERROR: 'Erro interno da API. Tente novamente em instantes.',
};

export const isApiError = (value: unknown): value is ApiError => value instanceof ApiError;

/** 409 / VERSION_CONFLICT: houve conflito de versão, nunca sobrescrever em silencio. */
export const isConflict = (value: unknown): boolean =>
  isApiError(value) && (value.status === 409 || value.code === 'VERSION_CONFLICT');

export const isNotFound = (value: unknown): boolean => isApiError(value) && value.status === 404;

/** 4xx: repetir a chamada nao resolve (usado para desligar retry automatico). */
export const isClientError = (value: unknown): boolean =>
  isApiError(value) && value.status >= 400 && value.status < 500;

/** Mensagem amigavel por `code`; codigo desconhecido usa a mensagem da API. */
export function toUserMessage(error: unknown): string {
  if (!isApiError(error)) return 'Erro inesperado. Tente novamente.';
  const known = errorCodeSchema.safeParse(error.code);
  if (known.success) return USER_MESSAGES[known.data];
  return error.message;
}
