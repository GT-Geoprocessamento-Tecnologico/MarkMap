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
      <svg viewBox="0 0 128 96" className="h-10 w-12 shrink-0" aria-hidden="true">
        <defs>
          <linearGradient id="markmap-brand-gradient" x1="0" y1="0" x2=".8" y2="1">
            <stop offset="0" stopColor="#0075D6" />
            <stop offset="1" stopColor="#00D6DB" />
          </linearGradient>
        </defs>
        <path d="M14 45a36 36 0 1 1 63 24L57 91h42l23-43-22-42h-18l22 42-5 10H79l8-15A48 48 0 1 0 14 45Z" fill="url(#markmap-brand-gradient)" />
        <circle cx="49" cy="45" r="15" fill="url(#markmap-brand-gradient)" />
        <path d="M96 6l22 42-22 43h7l22-43-22-42Z" fill="url(#markmap-brand-gradient)" opacity=".9" />
      </svg>
      {!compact && (
        <span className="min-w-0">
          <span className="block truncate text-[17px] tracking-[0.04em] text-on-surface"><strong>MARK</strong>MAP</span>
          <span className="block truncate text-[8px] font-medium tracking-[0.24em] text-on-surface-variant">PLANEJAMENTO INTELIGENTE</span>
        </span>
      )}
    </div>
  );
}
