import type { ReactNode } from "react";

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

interface AppIconProps {
  name: AppIconName;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClass: Record<NonNullable<AppIconProps["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-[18px] w-[18px]",
  lg: "h-[22px] w-[22px]",
};

const icons: Record<AppIconName, ReactNode> = {
  dashboard: (
    <>
      <path d="M3.5 10.5 12 3.8l8.5 6.7" />
      <path d="M5.5 9.7V20h13V9.7" />
      <path d="M9.5 20v-6h5v6" />
    </>
  ),
  projects: (
    <>
      <path d="M3.5 6.5h6l1.8 2h9.2v9.8a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7Z" />
      <path d="M3.5 8.5v-2A1.5 1.5 0 0 1 5 5h4.2l1.5 1.5" />
    </>
  ),
  map: (
    <>
      <path d="m3.5 6 5-2 7 2 5-2v14l-5 2-7-2-5 2Z" />
      <path d="M8.5 4v14M15.5 6v14" />
    </>
  ),
  data: (
    <>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" />
      <path d="M4.5 5.5v5c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-5" />
      <path d="M4.5 10.5v5c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-5" />
    </>
  ),
  mesh: (
    <>
      <path d="m12 3.5 7 4v9l-7 4-7-4v-9Z" />
      <path d="m5 7.5 7 4 7-4M12 11.5v9" />
    </>
  ),
  coordinates: (
    <>
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
    </>
  ),
  analytics: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      <path d="m4 8 6-5 6 7 5-4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.2 13.8c.1-.6.1-1.2 0-1.8l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.6-.9L15 4.6h-4l-.3 2.6c-.6.2-1.1.5-1.6.9l-2.4-1-2 3.4 2 1.5a8 8 0 0 0 0 1.8l-2 1.5 2 3.4 2.4-1c.5.4 1 .7 1.6.9l.3 2.6h4l.3-2.6c.6-.2 1.1-.5 1.6-.9l2.4 1 2-3.4Z" />
    </>
  ),
  collapse: <path d="m14.5 6-6 6 6 6" />,
  expand: <path d="m9.5 6 6 6-6 6" />,
  close: <path d="M5 5l14 14M19 5 5 19" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  back: <path d="M19 12H5M10 7l-5 5 5 5" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </>
  ),
  notifications: (
    <>
      <path d="M6.5 17h11l-1.2-1.8V10a4.3 4.3 0 0 0-8.6 0v5.2Z" />
      <path d="M10 20h4" />
    </>
  ),
  notificationsOff: (
    <>
      <path d="M8 8.2A4.2 4.2 0 0 1 16.3 10v5.2L17.5 17H9" />
      <path d="M10 20h4M4 4l16 16" />
    </>
  ),
  add: <path d="M12 5v14M5 12h14" />,
  loading: (
    <>
      <path d="M12 3a9 9 0 1 1-8.4 5.8" />
      <path d="M3 4v5h5" />
    </>
  ),
  telemetry: (
    <>
      <path d="m8 8 8 8M6 14l4 4-4 2-2-2ZM18 4l2 2-2 4-4-4Z" />
      <path d="M14.5 9.5a4 4 0 0 0-4 4M17 12a7 7 0 0 0-7 7" />
    </>
  ),
  layers: (
    <>
      <path d="m12 4 8 4-8 4-8-4Z" />
      <path d="m4 12 8 4 8-4M4 16l8 4 8-4" />
    </>
  ),
  filters: (
    <>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h8M16 18h4" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="14" cy="18" r="2" />
    </>
  ),
  tools: (
    <>
      <path d="m5 19 6.5-6.5" />
      <path d="M12 5.5a4 4 0 0 0 4.8 4.8L20 7.2A5.5 5.5 0 0 1 13.7 14L7.2 20.5 3.5 16.8 10 10.3A5.5 5.5 0 0 1 16.8 4Z" />
    </>
  ),
  location: (
    <>
      <path d="M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2" />
    </>
  ),
  measure: (
    <>
      <path d="m5 18 13-13 2 2L7 20Z" />
      <path d="m10 13 2 2M13 10l2 2M16 7l2 2" />
    </>
  ),
  point: (
    <>
      <path d="M12 21s5-4.6 5-9.5a5 5 0 1 0-10 0C7 16.4 12 21 12 21Z" />
      <circle cx="12" cy="11.5" r="1.8" />
    </>
  ),
  line: (
    <>
      <path d="M4 18 9 8l6 7 5-10" />
      <circle cx="4" cy="18" r="1.5" />
      <circle cx="9" cy="8" r="1.5" />
      <circle cx="15" cy="15" r="1.5" />
      <circle cx="20" cy="5" r="1.5" />
    </>
  ),
  polygon: <path d="m12 3.5 7 4 1 8-6 5H7l-3-6 2-7Z" />,
  upload: (
    <>
      <path d="M12 16V4M8 8l4-4 4 4" />
      <path d="M5 14v5h14v-5" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v12M8 12l4 4 4-4" />
      <path d="M5 18v2h14v-2" />
    </>
  ),
  delete: (
    <>
      <path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 10v7M14 10v7" />
    </>
  ),
  view: (
    <>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
    </>
  ),
  sync: (
    <>
      <path d="M19 7v5h-5M5 17v-5h5" />
      <path d="M18.3 12A6.5 6.5 0 0 0 7 7.5L5 9M5.7 12A6.5 6.5 0 0 0 17 16.5L19 15" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
    </>
  ),
  moon: <path d="M20 15.2A8 8 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5h.01" />
    </>
  ),
  favorite: (
    <path
      d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"
      fill="currentColor"
    />
  ),
  favoriteOutline: (
    <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />
  ),
};

export function AppIcon({ name, className = "", size = "md" }: AppIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      aria-hidden="true"
      className={`markmap-app-icon ${sizeClass[size]} ${className}`}
    >
      {icons[name]}
    </svg>
  );
}
