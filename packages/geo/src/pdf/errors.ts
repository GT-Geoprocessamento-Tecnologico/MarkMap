export type PdfErrorCode =
  | 'not-pdf' | 'corrupt-pdf' | 'encrypted-pdf' | 'input-too-large'
  | 'too-many-pages' | 'metadata-limit' | 'unsupported-profile'
  | 'unsupported-crs' | 'inconsistent-crs-controls' | 'ambiguous-viewport'
  | 'invalid-page-geometry' | 'invalid-control-points' | 'degenerate-transform'
  | 'accuracy-check-failed' | 'render-limit' | 'cancelled' | 'deadline-exceeded';

export class PdfError extends Error {
  readonly code: PdfErrorCode;

  constructor(code: PdfErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'PdfError';
    this.code = code;
  }
}

export function isPdfError(error: unknown, code?: PdfErrorCode): error is PdfError {
  return error instanceof PdfError && (code === undefined || error.code === code);
}
