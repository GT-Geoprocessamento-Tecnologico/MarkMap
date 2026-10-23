import { Link, useRouterState } from "@tanstack/react-router";
import { AppIcon, type AppIconName } from "../AppIcon";

interface TabItem {
  label: string;
  to: "/" | "/workspace" | "/imports" | "/settings";
  icon: AppIconName;
  active: (pathname: string) => boolean;
}

const tabs: TabItem[] = [
  {
    label: "Mapa",
    to: "/workspace",
    icon: "map",
    active: (pathname) =>
      pathname === "/workspace" || /^\/projects\/[^/]+\/map$/.test(pathname),
  },
  {
    label: "Projetos",
    to: "/",
    icon: "projects",
    active: (pathname) => pathname === "/" || pathname.startsWith("/projects"),
  },
  {
    label: "Dados",
    to: "/imports",
    icon: "data",
    active: (pathname) => pathname === "/imports",
  },
  {
    label: "Ajustes",
    to: "/settings",
    icon: "settings",
    active: (pathname) => pathname === "/settings",
  },
];

export function MobileTabBar() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <nav
      className="markmap-mobile-tabs lg:hidden"
      aria-label="Navegação principal do aplicativo"
    >
      {tabs.map((tab) => {
        const selected = tab.active(pathname);
        return (
          <Link
            key={tab.label}
            to={tab.to}
            aria-current={selected ? "page" : undefined}
            className={"markmap-mobile-tab" + (selected ? " is-active" : "")}
          >
            <AppIcon name={tab.icon} size="md" />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
