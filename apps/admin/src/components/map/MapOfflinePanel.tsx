// Desenvolvido por MtsFerreira. Offline shortcuts share the existing map-panel layout.
import type { ReactNode } from "react";
import { AppIcon, type AppIconName } from "../AppIcon";

type Props = {
  open: boolean;
  title: string;
  icon: AppIconName;
  onClose: () => void;
  children: ReactNode;
};

export function MapOfflinePanel({
  open,
  title,
  icon,
  onClose,
  children,
}: Props) {
  if (!open) return null;
  return (
    <section
      role="region"
      aria-label={title}
      className="absolute bottom-[calc(8rem+env(safe-area-inset-bottom))] left-3 right-3 z-20 flex max-h-[55vh] flex-col rounded-2xl border border-outline-variant bg-surface-container text-on-surface shadow-2xl lg:bottom-auto lg:top-0 lg:left-auto lg:right-0 lg:h-full lg:w-80 lg:max-h-full lg:rounded-none lg:rounded-l-2xl"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-outline-variant px-5 py-4">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <AppIcon name={icon} size="md" />
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Fechar ${title}`}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
        >
          <AppIcon name="close" size="sm" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {children}
      </div>
    </section>
  );
}
