import { Link, Outlet } from '@tanstack/react-router';
import AppFooter from './AppFooter';

const NAV_LINK_CLASS =
  'rounded-md px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary aria-current:text-primary';

/**
 * Layout raiz do admin: header com a navegacao principal, `<main>` como
 * outlet das rotas e o footer compartilhado. Rotas fullscreen (workspace)
 * podem sobrescrever isso na onda de paginas, mantendo o footer acessivel.
 */
export default function AppShell() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2">
          <Link to="/" className="text-base font-semibold text-text-primary">
            GeoNexo
          </Link>
          <nav aria-label="Navegação principal" className="flex flex-wrap items-center gap-1">
            <Link to="/" activeOptions={{ exact: true }} className={NAV_LINK_CLASS}>
              Dashboard
            </Link>
            <Link to="/projects" className={NAV_LINK_CLASS}>
              Projetos
            </Link>
            <Link to="/imports" className={NAV_LINK_CLASS}>
              Importações
            </Link>
            <Link to="/settings" className={NAV_LINK_CLASS}>
              Configurações
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <AppFooter />
    </div>
  );
}
