export type AppIconName =
  | "dashboard"
  | "projects"
  | "map"
  | "data"
  | "mesh"
  | "coordinates"
  | "analytics"
  | "settings"
  | "collapse"
  | "expand"
  | "close"
  | "menu"
  | "back"
  | "search"
  | "notifications"
  | "notificationsOff"
  | "add"
  | "loading"
  | "telemetry"
  | "layers"
  | "filters"
  | "tools"
  | "location"
  | "measure"
  | "point"
  | "line"
  | "polygon"
  | "upload"
  | "download"
  | "delete"
  | "view"
  | "copy"
  | "sync"
  | "sun"
  | "moon"
  | "info"
  | "favorite"
  | "favoriteOutline";

const glyphs: Record<AppIconName, string> = {
  dashboard: "🏠",
  projects: "📁",
  map: "🗺️",
  data: "🗂️",
  mesh: "🧊",
  coordinates: "🎯",
  analytics: "📈",
  settings: "⚙️",
  collapse: "◀️",
  expand: "▶️",
  close: "✕",
  menu: "☰",
  back: "←",
  search: "🔎",
  notifications: "🔔",
  notificationsOff: "🔕",
  add: "＋",
  loading: "⏳",
  telemetry: "🛰️",
  layers: "🗂️",
  filters: "🎚️",
  tools: "🛠️",
  location: "📍",
  measure: "📏",
  point: "📌",
  line: "〰️",
  polygon: "⬡",
  upload: "📤",
  download: "📥",
  delete: "🗑️",
  view: "👁️",
  copy: "📋",
  sync: "🔄",
  sun: "☀️",
  moon: "🌙",
  info: "ℹ️",
  favorite: "★",
  favoriteOutline: "☆",
};

interface AppIconProps {
  name: AppIconName;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClass: Record<NonNullable<AppIconProps["size"]>, string> = {
  sm: "text-[15px]",
  md: "text-[18px]",
  lg: "text-[22px]",
};

export function AppIcon({
  name,
  className = "",
  size = "md",
}: AppIconProps) {
  return (
    <span
      aria-hidden="true"
      className={`markmap-app-icon ${sizeClass[size]} ${className}`}
    >
      {glyphs[name]}
    </span>
  );
}
