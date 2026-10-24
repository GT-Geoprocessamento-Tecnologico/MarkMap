import { z } from 'zod';
import { featureSchema, layerSchema, projectSchema } from '@markmap/contracts';

export const MOCK_DB_VERSION = 1;

/** Formato persistido no localStorage - versionado para invalidar seeds antigos. */
export const mockDbSchema = z.object({
  version: z.literal(MOCK_DB_VERSION),
  projects: z.array(projectSchema),
  layers: z.array(layerSchema),
  features: z.array(featureSchema),
});

export type MockDb = z.infer<typeof mockDbSchema>;

const PROJECT_CENTRO = 'a1b2c3d4-0000-4000-8000-000000000001';
const PROJECT_LITORAL = 'a1b2c3d4-0000-4000-8000-000000000002';
const LAYER_PONTOS = 'a1b2c3d4-0001-4000-8000-000000000001';
const LAYER_TRAJETOS = 'a1b2c3d4-0001-4000-8000-000000000002';
const LAYER_POLIGONOS = 'a1b2c3d4-0001-4000-8000-000000000003';
const FEATURE_PONTO_A = 'a1b2c3d4-0002-4000-8000-000000000001';
const FEATURE_PONTO_B = 'a1b2c3d4-0002-4000-8000-000000000002';
const FEATURE_LINHA = 'a1b2c3d4-0002-4000-8000-000000000003';
const FEATURE_POLIGONO = 'a1b2c3d4-0002-4000-8000-000000000004';

/**
 * Demo enxuta: 2 projetos, 3 camadas e 4 features (Belo Horizonte).
 * Cada camada exercita um tipo geometrico distinto para a onda de paginas
 * testar Point/LineString/Polygon sem depender da API real.
 */
export function createSeedDb(): MockDb {
  return {
    version: MOCK_DB_VERSION,
    projects: [
      {
        id: PROJECT_CENTRO,
        name: 'Reconhecimento Centro',
        description: 'Levantamento piloto da região central',
        status: 'active',
        createdAt: '2026-01-10T09:00:00.000Z',
        updatedAt: '2026-01-12T15:30:00.000Z',
      },
      {
        id: PROJECT_LITORAL,
        name: 'Faixa litorânea',
        description: 'Mapeamento de áreas costeiras',
        status: 'active',
        createdAt: '2026-01-11T10:00:00.000Z',
        updatedAt: '2026-01-13T08:45:00.000Z',
      },
    ],
    layers: [
      layerSchema.parse({
        id: LAYER_PONTOS,
        projectId: PROJECT_CENTRO,
        name: 'Pontos de interesse',
        description: null,
        kind: 'point',
        geometryType: 'Point',
        createdAt: '2026-01-10T09:10:00.000Z',
        updatedAt: '2026-01-10T09:10:00.000Z',
      }),
      layerSchema.parse({
        id: LAYER_TRAJETOS,
        projectId: PROJECT_CENTRO,
        name: 'Trajetos',
        description: null,
        kind: 'line',
        geometryType: 'LineString',
        createdAt: '2026-01-10T09:20:00.000Z',
        updatedAt: '2026-01-10T09:20:00.000Z',
      }),
      layerSchema.parse({
        id: LAYER_POLIGONOS,
        projectId: PROJECT_LITORAL,
        name: 'Polígonos de estudo',
        description: null,
        kind: 'polygon',
        geometryType: 'Polygon',
        createdAt: '2026-01-11T10:20:00.000Z',
        updatedAt: '2026-01-11T10:20:00.000Z',
      }),
    ],
    features: [
      {
        id: FEATURE_PONTO_A,
        layerId: LAYER_PONTOS,
        geometry: { type: 'Point', coordinates: [-43.9378, -19.9167] },
        properties: { nome: 'Marco zero' },
        version: 1,
        createdAt: '2026-01-10T09:30:00.000Z',
        updatedAt: '2026-01-10T09:30:00.000Z',
      },
      {
        id: FEATURE_PONTO_B,
        layerId: LAYER_PONTOS,
        geometry: { type: 'Point', coordinates: [-43.9451, -19.9246] },
        properties: { nome: 'Ponto de coleta' },
        version: 1,
        createdAt: '2026-01-10T09:35:00.000Z',
        updatedAt: '2026-01-10T09:35:00.000Z',
      },
      {
        id: FEATURE_LINHA,
        layerId: LAYER_TRAJETOS,
        geometry: {
          type: 'LineString',
          coordinates: [
            [-43.95, -19.9],
            [-43.93, -19.92],
          ],
        },
        properties: { nome: 'Percurso de vistoria' },
        version: 1,
        createdAt: '2026-01-10T09:40:00.000Z',
        updatedAt: '2026-01-10T09:40:00.000Z',
      },
      {
        id: FEATURE_POLIGONO,
        layerId: LAYER_POLIGONOS,
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-44.0, -19.95],
              [-43.9, -19.95],
              [-43.9, -19.85],
              [-44.0, -19.85],
              [-44.0, -19.95],
            ],
          ],
        },
        properties: { nome: 'Área de estudo' },
        version: 1,
        createdAt: '2026-01-11T10:30:00.000Z',
        updatedAt: '2026-01-11T10:30:00.000Z',
      },
    ],
  };
}
