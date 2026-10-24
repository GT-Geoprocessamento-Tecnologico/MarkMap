import React, { useState, useEffect, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { useToast } from "@markmap/ui";
import { useDialogFocus } from "../../lib/hooks/use-dialog-focus";
import { AppIcon } from "../../components/AppIcon";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CrsEntry {
  code: string;
  name: string;
  type: string;
  region: string;
}

// Somente cadastros do usuário; as definições EPSG internas do motor GIS não mudam.
const DEFAULT_SYSTEMS: CrsEntry[] = [];

const STORAGE_KEY_SYSTEMS = "geonexo_crs_systems";
const STORAGE_KEY_FAVORITES = "geonexo_crs_favorites";

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------
function loadSystems(): CrsEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SYSTEMS);
    if (!raw) return DEFAULT_SYSTEMS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_SYSTEMS;
    return parsed.filter(
      (entry): entry is CrsEntry =>
        entry &&
        typeof entry.code === "string" &&
        /^EPSG:\d{4,6}$/.test(entry.code) &&
        typeof entry.name === "string" &&
        typeof entry.type === "string" &&
        typeof entry.region === "string",
    );
  } catch {
    return DEFAULT_SYSTEMS;
  }
}

function saveSystems(systems: CrsEntry[]): void {
  localStorage.setItem(STORAGE_KEY_SYSTEMS, JSON.stringify(systems));
}

function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FAVORITES);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((code): code is string => typeof code === "string"),
    );
  } catch {
    return new Set();
  }
}

function saveFavorites(favorites: Set<string>): void {
  localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify([...favorites]));
}

// ---------------------------------------------------------------------------
// Componente de Modal
// ---------------------------------------------------------------------------
interface CrsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  onSave?: (() => void) | undefined;
  children: ReactNode;
}

function CrsModal({ isOpen, onClose, title, onSave, children }: CrsModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, isOpen);
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);
  if (!isOpen) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="max-h-[calc(100dvh-2rem)] bg-surface-container rounded-2xl shadow-xl w-full max-w-md flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
          <h2 className="text-on-surface font-bold text-lg">{title}</h2>
          <button
            aria-label="Fechar diálogo"
            onClick={onClose}
            className="min-w-[44px] text-on-surface-variant hover:text-on-surface-variant transition-colors"
          >
            <AppIcon name="close" size="md" />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto p-6">{children}</div>
        {onSave && (
          <div className="px-6 py-4 bg-surface-container-high border-t border-outline-variant flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-outline-variant text-on-surface-variant font-medium hover:bg-surface-variant"
            >
              Cancelar
            </button>
            <button
              onClick={onSave}
              className="flex-1 py-2.5 rounded-xl bg-cyan-500 text-on-surface font-bold hover:bg-cyan-600"
            >
              Salvar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function CoordinateSystemsPage() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("Todos");
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedCrs, setSelectedCrs] = useState<CrsEntry | null>(null);
  const [newCrsCode, setNewCrsCode] = useState("");
  const [newCrsName, setNewCrsName] = useState("");
  const [allSystems, setAllSystems] = useState<CrsEntry[]>(DEFAULT_SYSTEMS);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    setAllSystems(loadSystems());
    setFavorites(loadFavorites());
  }, []);

  const systems = allSystems.filter((s) => {
    const matchSearch =
      s.code.toLowerCase().includes(search.toLowerCase()) ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.region.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "Todos" || s.type === filterType;
    return matchSearch && matchType;
  });

  const handleSaveCrs = useCallback(() => {
    const normalizedCode = newCrsCode.trim().toUpperCase();
    if (!/^EPSG:\d{4,6}$/.test(normalizedCode) || !newCrsName.trim()) {
      toast({
        title: "Erro",
        description: "Preencha o código e o nome do CRS",
        variant: "error",
      });
      return;
    }

    const entry: CrsEntry = {
      code: normalizedCode,
      name: newCrsName.trim(),
      type: "Customizado",
      region: "Local",
    };

    if (allSystems.some((system) => system.code === entry.code)) {
      toast({
        title: "Erro",
        description: "Já existe um CRS com este código.",
        variant: "error",
      });
      return;
    }
    try {
      const updated = [entry, ...allSystems];
      saveSystems(updated);
      setAllSystems(updated);
    } catch {
      toast({
        title: "Não foi possível salvar",
        description: "O armazenamento local está indisponível ou cheio.",
        variant: "error",
      });
      return;
    }

    setShowModal(false);
    setNewCrsCode("");
    setNewCrsName("");
    toast({
      title: "Sucesso",
      description: "CRS adicionado com sucesso!",
      variant: "success",
    });
  }, [newCrsCode, newCrsName, toast, allSystems]);

  const handleToggleFavorite = useCallback(
    (code: string) => {
      try {
        const next = new Set(favorites);
        if (next.has(code)) {
          next.delete(code);
        } else {
          next.add(code);
        }
        saveFavorites(next);
        setFavorites(next);
      } catch {
        toast({
          title: "Não foi possível salvar",
          description: "O favorito não foi gravado no dispositivo.",
          variant: "error",
        });
      }
    },
    [favorites, toast],
  );

  const handleShowDetails = useCallback((crs: CrsEntry) => {
    setSelectedCrs(crs);
    setShowDetailsModal(true);
  }, []);

  return (
    <div className="flex flex-col h-full bg-background p-4 md:p-6 overflow-y-auto">
      <CrsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Novo CRS"
        onSave={handleSaveCrs}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-on-surface mb-1">
              Código (Ex: EPSG:1234)
            </label>
            <input
              aria-label="Código do CRS"
              type="text"
              value={newCrsCode}
              onChange={(e) => setNewCrsCode(e.target.value)}
              className="w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-on-surface mb-1">
              Nome do Sistema
            </label>
            <input
              aria-label="Nome do CRS"
              type="text"
              value={newCrsName}
              onChange={(e) => setNewCrsName(e.target.value)}
              className="w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
          </div>
        </div>
      </CrsModal>

      <CrsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title="Detalhes do CRS"
      >
        {selectedCrs && (
          <div className="space-y-3">
            <div>
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                Código
              </span>
              <p className="text-on-surface font-mono font-medium">
                {selectedCrs.code}
              </p>
            </div>
            <div>
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                Nome
              </span>
              <p className="text-on-surface">{selectedCrs.name}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                Tipo
              </span>
              <p className="text-on-surface">{selectedCrs.type}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                Região
              </span>
              <p className="text-on-surface">{selectedCrs.region}</p>
            </div>
          </div>
        )}
      </CrsModal>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2">
            <AppIcon name="coordinates" size="lg" />
            Sistemas de Coordenadas
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Catálogo de referência e favoritos. Cadastrar um código não
            reprojeta os seus dados.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="flex-1 md:flex-none px-4 py-2 min-h-[44px] rounded-lg bg-gradient-to-r from-brand-blue to-brand-cyan text-white hover:brightness-110 font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-brand-cyan/20"
          >
            <AppIcon name="add" size="sm" />
            Novo CRS
          </button>
        </div>
      </div>

      <div className="bg-surface-container-high border border-outline-variant/50 rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full flex-1">
          <AppIcon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            aria-label="Buscar sistemas de coordenadas"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código, nome ou região..."
            className="w-full min-h-[44px] rounded-lg border border-outline-variant bg-surface-container pl-10 pr-4 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 transition-colors"
          />
        </div>
        <div className="w-full md:w-auto flex items-center gap-2">
          <label className="text-on-surface-variant text-sm whitespace-nowrap hidden sm:block">
            Tipo:
          </label>
          <select
            aria-label="Tipo de sistema de coordenadas"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full md:w-auto min-h-[44px] rounded-lg border border-outline-variant bg-surface-container px-4 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          >
            <option value="Todos" className="text-black">
              Todos os tipos
            </option>
            <option value="Geográfico" className="text-black">
              Geográfico
            </option>
            <option value="Projetado" className="text-black">
              Projetado
            </option>
            <option value="Customizado" className="text-black">
              Customizado
            </option>
          </select>
        </div>
      </div>

      <div className="bg-surface-container-high border border-outline-variant/50 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-sm min-w-[600px]">
            <thead className="bg-on-surface/5 text-on-surface-variant text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">Código EPSG</th>
                <th className="px-6 py-4 font-medium">Nome</th>
                <th className="px-6 py-4 font-medium">Tipo</th>
                <th className="px-6 py-4 font-medium">Região</th>
                <th className="px-6 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {systems.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-on-surface-variant"
                  >
                    Nenhum sistema cadastrado. Use Novo CRS para adicionar.
                  </td>
                </tr>
              ) : (
                systems.map((sys) => (
                  <tr
                    key={sys.code}
                    className="hover:bg-on-surface/5 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 bg-primary/10 text-primary rounded border border-primary/20 font-mono text-xs">
                        {sys.code}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-on-surface">
                      {sys.name}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs ${sys.type === "Geográfico" ? "bg-purple-500/10 text-purple-400" : sys.type === "Projetado" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}
                      >
                        {sys.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant">
                      {sys.region}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap flex justify-end gap-1">
                      <button
                        aria-label={`Detalhes de ${sys.code}`}
                        onClick={() => handleShowDetails(sys)}
                        className="w-9 h-9 rounded text-on-surface-variant hover:text-primary hover:bg-cyan-400/10 flex items-center justify-center transition-colors"
                      >
                        <AppIcon name="info" size="md" />
                      </button>
                      <button
                        aria-label={`${favorites.has(sys.code) ? "Remover favorito" : "Favoritar"} ${sys.code}`}
                        aria-pressed={favorites.has(sys.code)}
                        onClick={() => handleToggleFavorite(sys.code)}
                        className={`w-9 h-9 rounded flex items-center justify-center transition-colors ${
                          favorites.has(sys.code)
                            ? "text-amber-400 bg-amber-400/10"
                            : "text-on-surface-variant hover:text-amber-400 hover:bg-amber-400/10"
                        }`}
                      >
                        <AppIcon
                          name={favorites.has(sys.code) ? "favorite" : "favoriteOutline"}
                          size="md"
                        />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
