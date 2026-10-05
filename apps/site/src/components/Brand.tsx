interface BrandProps {
  compact?: boolean;
  inverse?: boolean;
}

export function Brand({ compact = false, inverse = false }: BrandProps) {
  const textColor = inverse ? "#ffffff" : "#101820";
  return (
    <span className="brand" aria-label="MarkMap — Planejamento Inteligente">
      <svg className="brand__mark" viewBox="0 0 128 96" role="img" aria-hidden="true">
        <defs>
          <linearGradient id="brand-gradient" x1="0" y1="0" x2="0.8" y2="1">
            <stop offset="0" stopColor="#0075D6" />
            <stop offset="1" stopColor="#00D6DB" />
          </linearGradient>
        </defs>
        <path d="M14 45a36 36 0 1 1 63 24L57 91h42l23-43-22-42h-18l22 42-5 10H79l8-15A48 48 0 1 0 14 45Z" fill="url(#brand-gradient)" />
        <circle cx="49" cy="45" r="15" fill="url(#brand-gradient)" />
        <path d="M96 6l22 42-22 43h7l22-43-22-42Z" fill="url(#brand-gradient)" opacity=".9" />
      </svg>
      {!compact && (
        <span className="brand__wording">
          <span className="brand__name" style={{ color: textColor }}><strong>MARK</strong>MAP</span>
          <span className="brand__tagline" style={{ color: inverse ? "rgba(255,255,255,.65)" : "#5f6d78" }}>PLANEJAMENTO INTELIGENTE</span>
        </span>
      )}
    </span>
  );
}
