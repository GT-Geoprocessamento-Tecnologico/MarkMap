/**
 * Storage management utilities for cleaning and monitoring local data.
 * Provides itemized breakdown and safe deletion of storage categories.
 */

import { offlineDB } from "./offline-db";
import { offlineMapStore } from "./offline-map-store";
import { localDb } from "../local-db";

export type StorageCategory =
  "soft-deleted-datasets" | "telemetry" | "offline-maps" | "original-pdfs";

export interface CategoryBreakdown {
  category: StorageCategory;
  label: string;
  description: string;
  itemCount: number;
  estimatedBytes: number;
}

export interface StorageBreakdown {
  categories: CategoryBreakdown[];
  totalBytes: number;
}

// Backward-compatible name used by the settings UI.
export type StorageBreakdownItem = CategoryBreakdown;

const storageCategories: readonly StorageCategory[] = [
  "soft-deleted-datasets",
  "telemetry",
  "offline-maps",
  "original-pdfs",
];

function isStorageCategory(value: string): value is StorageCategory {
  return storageCategories.includes(value as StorageCategory);
}

/**
 * Get itemized storage breakdown across all categories.
 */
export async function getStorageBreakdown(): Promise<StorageBreakdown> {
  const categories: CategoryBreakdown[] = [];

  // 1. Soft-deleted datasets
  try {
    const allDatasets = (await offlineDB.getAll("datasets")) as Array<{
      id: string;
      deleted?: boolean;
      sizeBytes?: number;
    }>;
    const softDeleted = allDatasets.filter((r) => r.deleted);
    const bytes = softDeleted.reduce((sum, r) => sum + (r.sizeBytes ?? 0), 0);

    categories.push({
      category: "soft-deleted-datasets",
      label: "Datasets excluídos",
      description: "Datasets marcados como excluídos mantidos no dispositivo",
      itemCount: softDeleted.length,
      estimatedBytes: bytes,
    });
  } catch {
    categories.push({
      category: "soft-deleted-datasets",
      label: "Datasets excluídos",
      description: "Datasets marcados como excluídos mantidos no dispositivo",
      itemCount: 0,
      estimatedBytes: 0,
    });
  }

  // 2. Telemetry/Logs
  try {
    const telemetry = (await offlineDB.getAll("telemetry")) as unknown[];
    const bytes = telemetry.reduce<number>(
      (sum, record) => sum + JSON.stringify(record).length * 2,
      0,
    );

    categories.push({
      category: "telemetry",
      label: "Telemetria e logs",
      description: "Dados de diagnóstico local e logs de eventos",
      itemCount: telemetry.length,
      estimatedBytes: bytes,
    });
  } catch {
    categories.push({
      category: "telemetry",
      label: "Telemetria e logs",
      description: "Dados de diagnóstico local e logs de eventos",
      itemCount: 0,
      estimatedBytes: 0,
    });
  }

  // 3. Offline map packages
  try {
    const packages = await offlineMapStore.list();
    const bytes = packages.reduce<number>(
      (sum, p) =>
        sum +
        p.manifest.archive.bytes +
        p.manifest.style.blob.bytes +
        p.manifest.glyphs.reduce(
          (glyphTotal: number, glyph: { blob: { bytes: number } }) =>
            glyphTotal + glyph.blob.bytes,
          0,
        ) +
        p.manifest.sprites.reduce(
          (spriteTotal: number, sprite: { blob: { bytes: number } }) =>
            spriteTotal + sprite.blob.bytes,
          0,
        ),
      0,
    );

    categories.push({
      category: "offline-maps",
      label: "Mapas offline",
      description: "Pacotes de mapas instalados para uso sem conexão",
      itemCount: packages.length,
      estimatedBytes: bytes,
    });
  } catch {
    categories.push({
      category: "offline-maps",
      label: "Mapas offline",
      description: "Pacotes de mapas instalados para uso sem conexão",
      itemCount: 0,
      estimatedBytes: 0,
    });
  }

  // 4. Original PDFs
  try {
    const originals = await localDb.transact(
      ["originals"],
      "readonly",
      (tx) =>
        new Promise<Array<{ bytes: number }>>((resolve, reject) => {
          const req = tx.store("originals").getAll();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        }),
    );
    const bytes = originals.reduce((sum, r) => sum + (r.bytes ?? 0), 0);

    categories.push({
      category: "original-pdfs",
      label: "PDFs originais",
      description: "Arquivos PDF originais e plantas anexadas localmente",
      itemCount: originals.length,
      estimatedBytes: bytes,
    });
  } catch {
    categories.push({
      category: "original-pdfs",
      label: "PDFs originais",
      description: "Arquivos PDF originais e plantas anexadas localmente",
      itemCount: 0,
      estimatedBytes: 0,
    });
  }

  const totalBytes = categories.reduce((sum, c) => sum + c.estimatedBytes, 0);

  return { categories, totalBytes };
}

/**
 * Safely delete selected storage categories.
 * NEVER deletes without explicit call from user-confirmed action.
 */
export async function cleanStorageCategories(
  categoriesToClean: string[],
): Promise<{
  cleaned: StorageCategory[];
  errors: Array<{ category: StorageCategory; error: string }>;
}> {
  const cleaned: StorageCategory[] = [];
  const errors: Array<{ category: StorageCategory; error: string }> = [];

  for (const value of categoriesToClean) {
    if (!isStorageCategory(value)) continue;
    const category = value;
    try {
      switch (category) {
        case "soft-deleted-datasets":
          await cleanSoftDeletedDatasets();
          cleaned.push(category);
          break;

        case "telemetry":
          await cleanTelemetry();
          cleaned.push(category);
          break;

        case "offline-maps":
          await cleanOfflineMaps();
          cleaned.push(category);
          break;

        case "original-pdfs":
          await cleanOriginalPdfs();
          cleaned.push(category);
          break;
      }
    } catch (cause) {
      errors.push({
        category,
        error: cause instanceof Error ? cause.message : "Erro desconhecido",
      });
    }
  }

  return { cleaned, errors };
}

/**
 * Delete soft-deleted datasets (hard delete from IndexedDB)
 */
async function cleanSoftDeletedDatasets(): Promise<void> {
  const db = await indexedDB.open("GeoNexoLocalEngineDB", 1);
  return new Promise((resolve, reject) => {
    const tx = db.result.transaction(["store"], "readwrite");
    const store = tx.objectStore("store");
    const index = store.index("collection");
    const req = index.getAll("datasets");

    req.onsuccess = () => {
      const records = req.result as Array<{
        id: string;
        payload?: { deleted?: boolean };
      }>;
      const toDelete = records.filter(
        (r) =>
          r.payload &&
          typeof r.payload === "object" &&
          "deleted" in r.payload &&
          r.payload.deleted,
      );

      for (const record of toDelete) {
        store.delete(record.id);
      }
    };

    tx.oncomplete = () => {
      db.result.close();
      resolve();
    };
    tx.onerror = () => {
      db.result.close();
      reject(tx.error ?? new Error("Falha ao limpar datasets excluídos"));
    };
  });
}

/**
 * Delete all telemetry records
 */
async function cleanTelemetry(): Promise<void> {
  const db = await indexedDB.open("GeoNexoLocalEngineDB", 1);
  return new Promise((resolve, reject) => {
    const tx = db.result.transaction(["store"], "readwrite");
    const store = tx.objectStore("store");
    const req = store.getAll();

    req.onsuccess = () => {
      const records = req.result as Array<{ id: string; collection: string }>;
      for (const record of records) {
        if (
          record.collection === "telemetry" ||
          record.id.startsWith("telemetry:")
        ) {
          store.delete(record.id);
        }
      }
    };

    tx.oncomplete = () => {
      db.result.close();
      resolve();
    };
    tx.onerror = () => {
      db.result.close();
      reject(tx.error ?? new Error("Falha ao limpar telemetria"));
    };
  });
}

/**
 * Delete all offline map packages using the store's remove method
 */
async function cleanOfflineMaps(): Promise<void> {
  const packages = await offlineMapStore.list();
  for (const pkg of packages) {
    await offlineMapStore.remove(pkg.manifest.id);
  }
}

/**
 * Delete all original PDF files
 */
async function cleanOriginalPdfs(): Promise<void> {
  return localDb.transact(["originals"], "readwrite", async (tx) => {
    const store = tx.store("originals");
    const req = store.getAllKeys();
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    for (const key of keys) {
      store.delete(key);
    }
  });
}
