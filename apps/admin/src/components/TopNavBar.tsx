import { useLayoutStore } from '../lib/store/layout';
import { useNavigate, useLocation, useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '@geonexo/ui';
import { useCreateProject, useProjects } from '../lib/hooks/projects';

// ---------------------------------------------------------------------------
// Modal de Novo Projeto
// ---------------------------------------------------------------------------
function NewProjectModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const createProjectMutation = useCreateProject();
  const [name, setName] = useState('');
  const [type, setType] = useState('vetorial');
  const [desc, setDesc] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: 'Nome obrigatório', description: 'Informe um nome para o projeto.', variant: 'error' });
      return;
    }
    try {
      await createProjectMutation.mutateAsync({
        name: name.trim(),
        description: desc.trim() || undefined,
      });
      toast({ title: 'Projeto criado!', description: `"${name}" foi criado com sucesso.`, variant: 'success' });
      onClose();
      navigate({ to: '/projects' });
    } catch (err) {
      toast({
        title: 'Erro ao criar projeto',
        description: err instanceof Error ? err.message : 'Falha ao salvar projeto.',
        variant: 'error',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Painel */}
      <div className="relative bg-surface-container w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant">
          <div>
            <h2 className="text-on-surface font-bold text-lg">Novo Projeto Espacial</h2>
            <p className="text-on-surface-variant text-sm mt-0.5">Configure o seu novo projeto GIS</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-on-surface-variant hover:text-on-surface-variant hover:bg-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
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
              autoFocus
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Levantamento Planialtimétrico 2024"
              className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-high text-on-surface text-sm placeholder:text-on-surface-variant focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all"
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-on-surface font-semibold text-sm mb-1.5">Tipo de Projeto</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'vetorial', label: 'Vetorial', icon: 'polyline', desc: 'Pontos, linhas, polígonos' },
                { value: 'raster', label: 'Raster', icon: 'grid_on', desc: 'Imagens, grades, DEM' },
                { value: '3d', label: 'Malha 3D', icon: 'view_in_ar', desc: 'Modelos 3D e nuvem de pontos' },
                { value: 'pipeline', label: 'Pipeline', icon: 'account_tree', desc: 'Processamento automatizado' },
              ].map(t => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`flex items-start gap-2.5 px-3 py-3 rounded-xl border text-left transition-all ${
                    type === t.value
                      ? 'bg-cyan-50 border-cyan-400 text-cyan-800'
                      : 'bg-surface-container-high border-outline-variant text-on-surface-variant hover:bg-surface-variant'
                  }`}
                >
                  <span className={`material-symbols-outlined mt-0.5 flex-shrink-0 ${type === t.value ? 'text-cyan-500' : 'text-on-surface-variant'}`} style={{ fontSize: '18px' }}>{t.icon}</span>
                  <div>
                    <p className="font-semibold text-sm">{t.label}</p>
                    <p className="text-xs opacity-70 leading-tight mt-0.5">{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-on-surface font-semibold text-sm mb-1.5">Descrição <span className="text-on-surface-variant font-normal">(opcional)</span></label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Descreva o objetivo deste projeto..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-high text-on-surface text-sm placeholder:text-on-surface-variant focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-outline-variant bg-surface-container-high/50">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-outline-variant bg-surface-container text-on-surface-variant font-semibold text-sm hover:bg-surface-variant transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={createProjectMutation.isPending}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 text-white font-bold text-sm hover:from-cyan-600 hover:to-cyan-500 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
          >
            {createProjectMutation.isPending ? (
              <span className="material-symbols-outlined animate-spin" style={{ fontSize: '18px' }}>progress_activity</span>
            ) : (
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add_circle</span>
            )}
            {createProjectMutation.isPending ? 'Criando...' : 'Criar Projeto'}
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
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const { data: projectsData } = useProjects();
  const filteredProjects = (projectsData?.items ?? []).filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description?.toLowerCase() ?? '').includes(searchQuery.toLowerCase())
  );

  // Fecha sidebar ao mudar de rota
  useEffect(() => {
    if (prevPathnameRef.current !== location.pathname) {
      closeSidebar();
      prevPathnameRef.current = location.pathname;
    }
  }, [location.pathname, closeSidebar]);

  // Botão voltar: mostra apenas quando não estamos na home
  const canGoBack = location.pathname !== '/';
  
  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      history.back();
    } else {
      navigate({ to: '/' });
    }
  };

  // Tema escuro/claro
  const [isDark, setIsDark] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('theme') !== 'light' : true
  );

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return (
    <>
      {/* Modal de Novo Projeto */}
      {showNewProject && <NewProjectModal onClose={() => setShowNewProject(false)} />}

      <header className="sticky top-0 w-full bg-header bg-opacity-90 backdrop-blur-md border-b border-outline-variant/10 z-30">
        <div className="flex items-center justify-between w-full px-4 py-2.5 gap-3">

          {/* ── Lado Esquerdo: hambúrguer + voltar + busca ── */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Hambúrguer — só mobile */}
            <button
              className="md:hidden p-2 rounded-lg text-on-surface-variant hover:text-cyan-300 hover:bg-on-surface/5 transition-colors flex-shrink-0"
              onClick={toggleSidebar}
              aria-label="Abrir menu"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>menu</span>
            </button>

            {/* Botão Voltar */}
            {canGoBack && (
              <button
                onClick={handleBack}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-on-surface-variant hover:text-cyan-300 hover:bg-on-surface/5 transition-colors text-sm flex-shrink-0"
                aria-label="Voltar"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
                <span className="hidden sm:inline text-xs">Voltar</span>
              </button>
            )}

            {/* Barra de busca */}
            <div className="relative flex-1 hidden sm:block">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '16px' }}>search</span>
              </div>
              <input
                className="w-full pl-9 pr-10 py-1.5 bg-surface-container-high border border-outline-variant text-on-surface text-xs rounded-lg focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none transition-colors placeholder:text-on-surface-variant/60"
                placeholder="Buscar projetos... [⌘K]"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
                <span className="border border-outline-variant bg-surface-container-high px-1.5 py-0.5 rounded text-on-surface-variant text-[10px]">⌘K</span>
              </div>
            </div>

            {/* Busca — ícone no mobile */}
            <button
              className="sm:hidden p-2 rounded-lg text-on-surface-variant hover:text-cyan-300 hover:bg-on-surface/5 transition-colors"
              aria-label="Buscar"
              onClick={() => setShowMobileSearch(!showMobileSearch)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>search</span>
            </button>
          </div>

          {/* ── Lado Direito: pills + ações ── */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Pill CRS — apenas em telas grandes */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-on-surface/5 rounded-lg border border-outline-variant/50 text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
              <span className="text-cyan-400 font-medium">EPSG:4326</span>
              <span className="text-on-surface-variant">WGS 84</span>
            </div>

            {/* Separador */}
            <div className="hidden sm:block h-5 w-px bg-on-surface/10 mx-1" />

            {/* Tema */}
            <button
              onClick={() => setIsDark(!isDark)}
              className="p-2 rounded-lg text-on-surface-variant hover:text-cyan-300 hover:bg-on-surface/5 transition-colors"
              title="Alternar Tema"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{isDark ? 'light_mode' : 'dark_mode'}</span>
            </button>

            {/* Notificações */}
            <button
              className="p-2 rounded-lg text-on-surface-variant hover:text-cyan-300 hover:bg-on-surface/5 transition-colors relative"
              onClick={() => setShowNotifications(!showNotifications)}
              title="Notificações"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>notifications</span>
            </button>

            {/* Preferências — navega para /settings */}
            <button
              className="hidden sm:block p-2 rounded-lg text-on-surface-variant hover:text-cyan-300 hover:bg-on-surface/5 transition-colors"
              onClick={() => navigate({ to: '/settings' })}
              title="Preferências do Ambiente"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>tune</span>
            </button>

            {/* Separador */}
            <div className="hidden sm:block h-5 w-px bg-on-surface/10 mx-1" />

            {/* Botão Novo Projeto */}
            <button
              onClick={() => setShowNewProject(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-400 text-on-surface font-bold text-xs active:scale-[0.97] hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
              Novo Projeto
            </button>

            {/* Perfil — navega para /settings */}
            <button
              onClick={() => navigate({ to: '/settings' })}
              className="w-8 h-8 rounded-full border border-cyan-500/40 bg-gradient-to-br from-cyan-900/60 to-emerald-900/40 flex items-center justify-center text-cyan-300 font-bold text-xs hover:border-cyan-400 hover:brightness-110 transition-all active:scale-95"
              aria-label="Perfil do Usuário"
              title="Configurações e Perfil"
            >
              AR
            </button>
          </div>

        </div>
      </header>

      {/* Mobile search bar */}
      {showMobileSearch && (
        <div className="sm:hidden fixed top-[52px] left-0 right-0 z-40 p-3 bg-header border-b border-outline-variant/10">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '16px' }}>search</span>
            </div>
            <input
              autoFocus
              className="w-full pl-9 pr-4 py-2 bg-surface-container-high border border-outline-variant text-on-surface text-sm rounded-lg focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none transition-colors placeholder:text-on-surface-variant/60"
              placeholder="Buscar projetos..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {searchQuery && filteredProjects.length > 0 && (
            <div className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-outline-variant bg-header">
              {filteredProjects.slice(0, 5).map((p) => (
                <button
                  key={p.id}
                  className="w-full text-left px-3 py-2 text-sm text-on-surface hover:bg-on-surface/5 transition-colors"
                  onClick={() => {
                    navigate({ to: '/projects/$projectId', params: { projectId: p.id } });
                    setShowMobileSearch(false);
                    setSearchQuery('');
                  }}
                >
                  <span className="font-medium">{p.name}</span>
                  {p.description && (
                    <span className="block text-xs text-on-surface-variant truncate">{p.description}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Notifications panel */}
      {showNotifications && (
        <div className="fixed top-[52px] right-4 z-40 w-72 rounded-xl border border-outline-variant bg-header shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-outline-variant/10">
            <h3 className="text-sm font-semibold text-on-surface">Notificações</h3>
          </div>
          <div className="px-4 py-6 text-center">
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '32px' }}>notifications_off</span>
            <p className="text-sm text-on-surface-variant mt-2">Sem notificações</p>
          </div>
        </div>
      )}
    </>
  );
}
