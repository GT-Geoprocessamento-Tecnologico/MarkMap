import { useMemo } from "react";
import { profileFromFeatures } from "../../lib/elevation/track-elevation";

export function TrackElevationProfile({
  features,
}: {
  features: readonly unknown[];
}) {
  const profile = useMemo(() => profileFromFeatures(features), [features]);
  if (!profile)
    return (
      <p className="text-sm text-on-surface-variant">
        Este dataset não possui uma trilha com coordenadas de altitude
        suficientes. Não é gerada altitude fictícia.
      </p>
    );
  const {
    points,
    totalDistanceKm,
    minElevation,
    maxElevation,
    ascent,
    descent,
  } = profile;
  const span = Math.max(1, maxElevation - minElevation);
  const step = Math.max(1, Math.ceil(points.length / 250));
  const sample = points.filter(
    (_, index) => index % step === 0 || index === points.length - 1,
  );
  const polyline = sample
    .map(
      (p) =>
        `${((p.distanceKm / totalDistanceKm) * 1000).toFixed(2)},${(185 - ((p.elevation - minElevation) / span) * 170).toFixed(2)}`,
    )
    .join(" ");
  return (
    <section
      aria-label="Perfil altimétrico offline"
      className="mt-3 rounded-xl border border-outline-variant p-4"
    >
      <h3 className="font-semibold">
        Perfil de elevação (altitudes do arquivo)
      </h3>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
        <span>Distância: {totalDistanceKm.toFixed(2)} km</span>
        <span>Mín.: {minElevation.toFixed(0)} m</span>
        <span>Máx.: {maxElevation.toFixed(0)} m</span>
        <span>Subida: {ascent.toFixed(0)} m</span>
        <span>Descida: {descent.toFixed(0)} m</span>
      </div>
      <svg
        viewBox="0 0 1000 200"
        role="img"
        aria-label={`Gráfico do perfil de elevação com ${points.length} pontos`}
        className="mt-2 w-full"
        preserveAspectRatio="none"
      >
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
          points={polyline}
        />
      </svg>
      <p className="text-xs text-on-surface-variant">
        Cálculo local a partir da elevação contida no GPX/KML/GeoJSON. Não
        utiliza modelo digital de terreno.
      </p>
    </section>
  );
}
