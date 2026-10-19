type MarkMapBrandProps = {
  compact?: boolean;
  ariaLabel?: string;
};

export function MarkMapBrand({
  compact = false,
  ariaLabel = "MarkMap — Planejamento Inteligente",
}: MarkMapBrandProps) {
  return (
    <div className="flex min-w-0 items-center gap-3" aria-label={ariaLabel || undefined}>
      <img src="/icons/icon-192x192-652c2c29.png" className="h-10 w-12 shrink-0 object-contain" width="48" height="40" alt="" aria-hidden="true" />
      {!compact && (
        <span className="min-w-0">
          <span className="block truncate text-[17px] tracking-[0.04em] text-on-surface"><strong>MARK</strong>MAP</span>
          <span className="block truncate text-[8px] font-medium tracking-[0.24em] text-on-surface-variant">PLANEJAMENTO INTELIGENTE</span>
        </span>
      )}
    </div>
  );
}
