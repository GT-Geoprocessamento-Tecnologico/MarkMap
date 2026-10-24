import { useLayoutStore } from "../lib/store/layout";
import { useNavigate, useLocation, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@markmap/ui";
import { useCreateProject, useProjectPages } from "../lib/hooks/projects";
import { useDialogFocus } from "../lib/hooks/use-dialog-focus";
import { MarkMapBrand } from "./MarkMapBrand";
import { AppIcon } from "./AppIcon";

// ---------------------------------------------------------------------------
// Modal de Novo Projeto
// ---------------------------------------------------------------------------
function NewProjectModal({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);
  const { toast } = useToast();
  const navigate = useNavigate();
  const createProjectMutation = useCreateProject();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Informe um nome para o projeto.",
        variant: "error",
      });
      return;
    }
    try {
      await createProjectMutation.mutateAsync({
        name: name.trim(),
        description: desc.trim() || undefined,
      });
      toast({
        title: "Projeto criado!",
        description: `"${name}" foi criado com sucesso.`,
        variant: "success",
      });
      onClose();
      navigate({ to: "/projects" });
    } catch (err) {
      toast({
        title: "Erro ao criar projeto",
        description:
          err instanceof Error ? err.message : "Falha ao salvar projeto.",
        variant: "error",
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Painel */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative bg-surface-container w-full sm:max-w-md max-h-[100dvh] sm:max-h-[calc(100dvh-2rem)] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-on-surface/20 sm:hidden" aria-hidden="true" />
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant">
          <div>
            <h2 className="text-on-surface font-bold text-lg">
              Novo Projeto Espacial
            </h2>
            <p className="text-on-surface-variant text-sm mt-0.5">
              Configure o seu novo projeto GIS
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar novo projeto"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-on-surface-variant hover:text-on-surface-variant hover:bg-surface-variant transition-colors"
          >
            <AppIcon name="close" size="md" />
          </button>
        </div>

        {/* Corpo */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Nome */}
          <div>
            <label className="block text-on-surface font-semibold text-sm mb-1.5">
              Nome do Projeto <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Levantamento Planialtimétrico 2024"
              className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-high text-on-surface text-sm placeholder:text-on-surface-variant focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all"
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-on-surface font-semibold text-sm mb-1.5">
              Descrição{" "}
              <span className="text-on-surface-variant font-normal">
                (opcional)
              </span>
            </label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Descreva o objetivo deste projeto..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-high text-on-surface text-sm placeholder:text-on-surface-variant focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-outline-variant bg-surface-container-high/50">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-outline-variant bg-surface-container text-on-surface-variant font-semibold text-sm hover:bg-surface-variant transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={createProjectMutation.isPending}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-brand-blue to-brand-cyan text-white font-bold text-sm hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-brand-cyan/20"
          >
            {createProjectMutation.isPending ? (
              <AppIcon name="loading" size="md" className="animate-pulse" />
            ) : (
              <AppIcon name="add" size="md" />
            )}
            {createProjectMutation.isPending ? "Criando..." : "Criar Projeto"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TopNavBar principal
// ---------------------------------------------------------------------------
export function TopNavBar() {
  const { toggleSidebar, closeSidebar } = useLayoutStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { history } = useRouter();
  const prevPathnameRef = useRef(location.pathname);

  const [showNewProject, setShowNewProject] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const projectsQuery = useProjectPages();
  const projectsData = projectsQuery.data;
  const filteredProjects = (projectsData?.items ?? []).filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description?.toLowerCase() ?? "").includes(searchQuery.toLowerCase()),
  );

  // Fecha sidebar ao mudar de rota
  useEffect(() => {
    if (prevPathnameRef.current !== location.pathname) {
      closeSidebar();
      prevPathnameRef.current = location.pathname;
    }
  }, [location.pathname, closeSidebar]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document
          .querySelector<HTMLInputElement>('[data-project-search="desktop"]')
          ?.focus();
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  // Botão voltar: mostra apenas quando não estamos na home
  const canGoBack = location.pathname !== "/";

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      history.back();
    } else {
      navigate({ to: "/" });
    }
  };

  // Tema escuro/claro
  const [isDark, setIsDark] = useState(() => {
    try {
      return localStorage.getItem("theme") !== "light";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const syncTheme = () =>
      setIsDark(document.documentElement.classList.contains("dark"));
    window.addEventListener("geonexo-theme-change", syncTheme);
    return () => window.removeEventListener("geonexo-theme-change", syncTheme);
  }, []);

  useEffect(() => {
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (isDark) {
      document.documentElement.classList.add("dark");
      themeColor?.setAttribute("content", "#06131a");
      try {
        localStorage.setItem("theme", "dark");
      } catch {
        /* Theme remains usable without persistent storage. */
      }
    } else {
      document.documentElement.classList.remove("dark");
      themeColor?.setAttribute("content", "#f4f8fb");
      try {
        localStorage.setItem("theme", "light");
      } catch {
        /* Theme remains usable without persistent storage. */
      }
    }
    window.dispatchEvent(new Event("geonexo-theme-change"));
  }, [isDark]);

  return (
    <>
      {/* Modal de Novo Projeto */}
      {showNewProject && (
        <NewProjectModal onClose={() => setShowNewProject(false)} />
      )}

      <header className="markmap-shell-header sticky top-0 w-full bg-header bg-opacity-90 backdrop-blur-xl border-b border-outline-variant/10 z-30">
        <div className="flex items-center justify-between w-full px-4 py-2.5 gap-3">
          {/* ── Lado Esquerdo: hambúrguer + voltar + busca ── */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Hambúrguer — só mobile */}
            <button
              className="lg:hidden p-2 rounded-lg text-on-surface-variant hover:text-primary hover:bg-on-surface/5 transition-colors flex-shrink-0"
              onClick={toggleSidebar}
              aria-label="Abrir menu"
            >
              <AppIcon name="menu" size="lg" />
            </button>

            {/* Botão Voltar */}
            {canGoBack && (
              <button
                onClick={handleBack}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-on-surface/5 transition-colors text-sm flex-shrink-0"
                aria-label="Voltar"
              >
                <AppIcon name="back" size="md" />
                <span className="hidden sm:inline text-xs">Voltar</span>
              </button>
            )}

            <div className="min-w-0 flex-1 sm:hidden">
              <MarkMapBrand />
            </div>

            {/* Barra de busca */}
            <div className="relative flex-1 hidden sm:block">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <AppIcon name="search" size="sm" className="text-on-surface-variant" />
              </div>
              <input
                className="w-full min-h-[40px] pl-9 pr-10 py-1.5 bg-surface-container-high/70 border border-outline-variant text-on-surface text-xs rounded-xl focus:border-brand-cyan/60 focus:ring-1 focus:ring-brand-cyan/25 focus:outline-none transition-colors placeholder:text-on-surface-variant/60"
                data-project-search="desktop"
                aria-label="Buscar projetos carregados"
                placeholder="Buscar projetos... [⌘K]"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
                <span className="border border-outline-variant bg-surface-container-high px-1.5 py-0.5 rounded text-on-surface-variant text-[10px]">
                  ⌘K
                </span>
              </div>
              {searchQuery && (
                <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-60 overflow-y-auto rounded-lg border border-outline-variant bg-header shadow-xl">
                  {projectsQuery.isError && (
                    <p role="alert" className="p-3 text-sm">
                      Não foi possível carregar os projetos.
                    </p>
                  )}
                  {!projectsQuery.isLoading &&
                    filteredProjects.length === 0 && (
                      <p className="p-3 text-sm">
                        Nenhum resultado nos projetos carregados.
                      </p>
                    )}
                  {projectsQuery.hasNextPage && (
                    <button
                      disabled={
                        projectsQuery.isFetchingNextPage ||
                        projectsQuery.isError
                      }
                      onClick={() => void projectsQuery.fetchNextPage()}
                      className="w-full p-3 text-left text-sm"
                    >
                      Carregar mais projetos para buscar
                    </button>
                  )}
                  {filteredProjects.slice(0, 5).map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      className="min-h-[44px] w-full px-3 py-2 text-left text-sm text-on-surface hover:bg-on-surface/5"
                      onClick={() => {
                        navigate({
                          to: "/projects/$projectId",
                          params: { projectId: project.id },
                        });
                        setSearchQuery("");
                      }}
                    >
                      <span className="block truncate font-medium">
                        {project.name}
                      </span>
                      {project.description && (
                        <span className="block truncate text-xs text-on-surface-variant">
                          {project.description}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Busca — ícone no mobile */}
            <button
              className="sm:hidden p-2 rounded-lg text-on-surface-variant hover:text-primary hover:bg-on-surface/5 transition-colors"
              aria-label="Buscar"
              onClick={() => setShowMobileSearch(!showMobileSearch)}
            >
              <AppIcon name="search" size="md" />
            </button>
          </div>

          {/* ── Lado Direito: pills + ações ── */}
          <div className="flex items-center gap-1.5 flex-shrink-0 bg-surface-container rounded-xl p-1.5 border border-outline-variant/10">
            {/* Pill CRS — apenas em telas grandes */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-on-surface/5 rounded-lg border border-outline-variant/50 text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
              <span className="text-primary font-medium">EPSG:4326</span>
              <span className="text-on-surface-variant">WGS 84</span>
            </div>

            {/* Separador */}
            <div className="hidden sm:block h-5 w-px bg-on-surface/10 mx-1" />

            {/* Tema */}
            <button
              onClick={() => setIsDark(!isDark)}
              className="markmap-theme-button p-2 rounded-xl text-on-surface-variant hover:text-brand-cyan hover:bg-on-surface/5 transition-colors"
              title="Alternar tema"
              aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
            >
              <AppIcon name={isDark ? "sun" : "moon"} size="md" />
            </button>

            {/* Notificações */}
            <button
              className="hidden sm:block p-2 rounded-lg text-on-surface-variant hover:text-primary hover:bg-on-surface/5 transition-colors relative"
              onClick={() => setShowNotifications(!showNotifications)}
              title="Notificações"
            >
              <AppIcon name="notifications" size="md" />
            </button>

            {/* Botão Novo Projeto */}
            <button
              onClick={() => setShowNewProject(true)}
              className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-blue to-brand-cyan text-white font-bold text-xs active:scale-[0.97] hover:shadow-lg hover:shadow-brand-cyan/20 transition-all"
            >
              <AppIcon name="add" size="sm" />
              Novo Projeto
            </button>
          </div>
        </div>
      </header>

      {/* Mobile search bar */}
      {showMobileSearch && (
        <div className="sm:hidden fixed top-[calc(64px+env(safe-area-inset-top))] left-0 right-0 z-40 p-3 bg-header border-b border-outline-variant/10">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <AppIcon name="search" size="sm" className="text-on-surface-variant" />
            </div>
            <input
              autoFocus
              className="w-full pl-9 pr-4 py-2 bg-surface-container-high border border-outline-variant text-on-surface text-sm rounded-lg focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none transition-colors placeholder:text-on-surface-variant/60"
              aria-label="Buscar projetos no menu móvel"
              placeholder="Buscar projetos..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {searchQuery && (
            <div className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-outline-variant bg-header">
              {projectsQuery.isError && (
                <p role="alert" className="p-3 text-sm">
                  Não foi possível carregar os projetos.
                </p>
              )}
              {!projectsQuery.isLoading && filteredProjects.length === 0 && (
                <p className="p-3 text-sm">
                  Nenhum resultado nos projetos carregados.
                </p>
              )}
              {projectsQuery.hasNextPage && (
                <button
                  disabled={
                    projectsQuery.isFetchingNextPage || projectsQuery.isError
                  }
                  onClick={() => void projectsQuery.fetchNextPage()}
                  className="w-full p-3 text-left text-sm"
                >
                  Carregar mais projetos para buscar
                </button>
              )}
              {filteredProjects.slice(0, 5).map((p) => (
                <button
                  key={p.id}
                  className="w-full text-left px-3 py-2 text-sm text-on-surface hover:bg-on-surface/5 transition-colors"
                  onClick={() => {
                    navigate({
                      to: "/projects/$projectId",
                      params: { projectId: p.id },
                    });
                    setShowMobileSearch(false);
                    setSearchQuery("");
                  }}
                >
                  <span className="font-medium">{p.name}</span>
                  {p.description && (
                    <span className="block text-xs text-on-surface-variant truncate">
                      {p.description}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Notifications panel */}
      {showNotifications && (
        <div className="fixed top-[calc(64px+env(safe-area-inset-top))] right-4 z-40 w-72 rounded-xl border border-outline-variant bg-header shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-outline-variant/10">
            <h3 className="text-sm font-semibold text-on-surface">
              Notificações
            </h3>
          </div>
          <div className="px-4 py-6 text-center">
            <AppIcon name="notificationsOff" size="lg" className="text-on-surface-variant" />
            <p className="text-sm text-on-surface-variant mt-2">
              Sem notificações
            </p>
          </div>
        </div>
      )}
    </>
  );
}
