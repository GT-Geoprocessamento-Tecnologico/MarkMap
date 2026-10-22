import type { RouteStep } from "@markmap/contracts";

export function generateTtsText(step: RouteStep, locale = "pt-BR"): string {
  const { maneuver } = step;
  const roadName = maneuver.roadName ?? "";

  const texts: Record<string, string> = {
    depart: locale === "pt-BR" ? `Inicie em ${roadName}` : `Start on ${roadName}`,
    turn_left: locale === "pt-BR" ? `Vire à esquerda em ${roadName}` : `Turn left onto ${roadName}`,
    turn_right: locale === "pt-BR" ? `Vire à direita em ${roadName}` : `Turn right onto ${roadName}`,
    continue: locale === "pt-BR" ? `Continue em ${roadName}` : `Continue on ${roadName}`,
    roundabout: locale === "pt-BR" ? `Entre na rotatória` : `Enter the roundabout`,
    roundabout_exit: locale === "pt-BR" ? `Saia na ${maneuver.exitNumber ?? "?"}ª saída` : `Take exit ${maneuver.exitNumber ?? "?"}`,
    merge: locale === "pt-BR" ? `Funda-se em ${roadName}` : `Merge onto ${roadName}`,
    fork_left: locale === "pt-BR" ? `Mantenha à esquerda em ${roadName}` : `Keep left onto ${roadName}`,
    fork_right: locale === "pt-BR" ? `Mantenha à direita em ${roadName}` : `Keep right onto ${roadName}`,
    u_turn: locale === "pt-BR" ? `Faça retorno` : `Make a U-turn`,
    arrive: locale === "pt-BR" ? `Chegou ao destino` : `You have arrived`,
    new_name: locale === "pt-BR" ? `Continue em ${roadName}` : `Continue on ${roadName}`,
  };

  if (maneuver.modifier) {
    const mods: Record<string, string> = {
      slight_left: locale === "pt-BR" ? "Levemente à esquerda" : "Slight left",
      slight_right: locale === "pt-BR" ? "Levemente à direita" : "Slight right",
      sharp_left: locale === "pt-BR" ? "Acentuada à esquerda" : "Sharp left",
      sharp_right: locale === "pt-BR" ? "Acentuada à direita" : "Sharp right",
    };
    if (mods[maneuver.modifier]) {
      return `${mods[maneuver.modifier]} em ${roadName}`.trim();
    }
  }

  return texts[maneuver.type] ?? (locale === "pt-BR" ? "Continue" : "Continue");
}

export function getDistanceText(meters: number, locale = "pt-BR"): string {
  if (meters < 1000) {
    return locale === "pt-BR" ? `${Math.round(meters)} metros` : `${Math.round(meters)} meters`;
  }
  const km = (meters / 1000).toFixed(1);
  return locale === "pt-BR" ? `${km} quilômetros` : `${km} kilometers`;
}

export function getEtaText(totalSeconds: number, locale = "pt-BR"): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return locale === "pt-BR" ? `${hours}h ${minutes}min` : `${hours}h ${minutes}m`;
  }
  return locale === "pt-BR" ? `${minutes} min` : `${minutes} min`;
}
