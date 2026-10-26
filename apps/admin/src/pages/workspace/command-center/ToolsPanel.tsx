import React from "react";
import { AppIcon, type AppIconName } from "../../../components/AppIcon.js";
import { exportDatasetGeoJSON, type DatasetRecord } from "../../../lib/datasets/dataset-store.js";
import type { TelemetryData } from "./types.js";

interface ToolsPanelProps {
  activeDataset?: DatasetRecord;
  telemetry: TelemetryData;
  onToggleMeasure: () => void;
  onHandleMyLocation: () => void;
  onSetSidePanel: (panel: "telemetria" | "none") => void;
  toast: (options: {
    title: string;
    description?: string;
    variant?: "default" | "error" | "success";
  }) => void;
  subtitleClass: string;
}

export function ToolsPanel({
  activeDataset,
  telemetry,
  onToggleMeasure,
  onHandleMyLocation,
  onSetSidePanel,
  toast,
  subtitleClass,
}: ToolsPanelProps) {
  const tools: Array<{
    icon: AppIconName;
    label: string;
    desc: string;
    action: () => void;
  }> = [
    {
      icon: "measure",
      label: "Medir Distância",
      desc: "Clique em pontos no mapa para medir.",
      action: () => {
        onToggleMeasure();
        onSetSidePanel("telemetria");
      },
    },
    {
      icon: "location",
      label: "Minha Localização",
      desc: "Centralizar o mapa na sua posição atual.",
      action: onHandleMyLocation,
    },
    {
      icon: "download",
      label: "Exportar Dados",
      desc: "Exportar o dataset selecionado em GeoJSON.",
      action: () => {
        if (activeDataset)
          void exportDatasetGeoJSON(activeDataset.id).catch((cause) =>
            toast({
              title: "Exportação não concluída",
              description:
                cause instanceof Error ? cause.message : "Falha ao exportar.",
              variant: "error",
            }),
          );
        else
          toast({
            title: "Nenhum dataset selecionado",
            variant: "error",
          });
      },
    },
    {
      icon: "copy",
      label: "Copiar coordenadas",
      desc: "Copiar o centro atual do mapa.",
      action: async () => {
        const value = `${telemetry.lat.toFixed(6)}, ${telemetry.lng.toFixed(6)}`;
        try {
          if (!navigator.clipboard?.writeText)
            throw new Error("Cópia indisponível neste dispositivo.");
          await navigator.clipboard.writeText(value);
          toast({
            title: "Coordenadas copiadas",
            description: value,
            variant: "success",
          });
        } catch (cause) {
          toast({
            title: "Não foi possível copiar",
            description:
              cause instanceof Error
                ? cause.message
                : "Verifique a permissão de cópia.",
            variant: "error",
          });
        }
      },
    },
    {
      icon: "upload",
      label: "Importar dataset",
      desc: "Abrir a página de importação local.",
      action: () => {
        window.location.href = "/imports";
      },
    },
  ];

  return (
    <div className="p-5 space-y-3">
      <p className={`${subtitleClass} uppercase tracking-wider`}>
        Ferramentas disponíveis
      </p>
      {tools.map((tool) => (
        <button
          key={tool.icon}
          type="button"
          onClick={tool.action}
          className="w-full flex items-start gap-3 px-3 py-3 rounded-xl border border-outline-variant bg-surface-container-high hover:bg-primary/10 hover:border-primary/30 transition-colors text-left"
        >
          <AppIcon name={tool.icon} size="md" className="mt-0.5" />
          <div>
            <p className="text-on-surface font-semibold text-sm">
              {tool.label}
            </p>
            <p className="text-on-surface-variant text-xs mt-0.5">
              {tool.desc}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
