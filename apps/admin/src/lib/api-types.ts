import { z } from 'zod';
import { createFeatureSchema, createLayerSchema, updateFeatureSchema } from '@geonexo/contracts';
import type { Bbox } from '@geonexo/contracts';

/**
 * Tipos compartilhados entre `api-client` (transporte) e `mock` (transporte de
 * desenvolvimento). Todas as tipagens sao derivadas de `@geonexo/contracts` -
 * nunca sao declaradas de novo na mao. `z.input` e usado porque e o corpo que
 * o cliente envia: campos com `.default()` no contrato sao opcionais aqui.
 */
export interface ListOptions {
  cursor?: string;
  limit?: number;
  signal?: AbortSignal;
}

export interface ListFeaturesOptions extends ListOptions {
  bbox?: Bbox;
}

export type CreateLayerInput = Omit<z.input<typeof createLayerSchema>, 'projectId'>;

export type CreateFeatureInput = Omit<z.input<typeof createFeatureSchema>, 'layerId'>;

export type UpdateFeatureInput = Omit<z.input<typeof updateFeatureSchema>, 'id'>;
