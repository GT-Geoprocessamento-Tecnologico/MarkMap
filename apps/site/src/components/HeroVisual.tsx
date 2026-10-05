export function HeroVisual() {
  return (
    <div className="hero-visual" aria-hidden="true">
      <svg viewBox="0 0 1280 760" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="terrain-base" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#173f35" />
            <stop offset=".46" stopColor="#315b34" />
            <stop offset="1" stopColor="#10252a" />
          </linearGradient>
          <linearGradient id="water" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#0c3140" />
            <stop offset="1" stopColor="#0a1f2d" />
          </linearGradient>
          <linearGradient id="route-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#0075D6" />
            <stop offset="1" stopColor="#00D6DB" />
          </linearGradient>
          <filter id="terrain-noise" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency=".018 .045" numOctaves="4" seed="7" result="noise" />
            <feColorMatrix
              in="noise"
              type="matrix"
              values="0.55 0 0 0 0.12  0 0.72 0 0 0.20  0 0 0.38 0 0.11  0 0 0 .58 0"
              result="coloredNoise"
            />
            <feBlend in="SourceGraphic" in2="coloredNoise" mode="overlay" />
          </filter>
          <pattern id="contours" width="150" height="110" patternUnits="userSpaceOnUse">
            <path d="M-20 75C18 30 63 23 96 51s64 26 92-2" fill="none" stroke="rgba(82,198,210,.15)" strokeWidth="1" />
            <path d="M-18 93C20 50 62 45 94 70s66 24 96 0" fill="none" stroke="rgba(82,198,210,.1)" strokeWidth="1" />
          </pattern>
        </defs>

        <rect width="1280" height="760" fill="url(#terrain-base)" filter="url(#terrain-noise)" />
        <path d="M0 540C170 505 212 398 345 395s186 111 307 78c108-29 113-146 240-189 116-39 214 9 388-66V760H0Z" fill="url(#water)" opacity=".94" />
        <rect width="1280" height="760" fill="url(#contours)" />

        <g fill="none" stroke="rgba(231,220,198,.34)" strokeWidth="2">
          <path d="M520 0C548 99 640 113 658 204s-38 162 16 233 173 87 206 177" />
          <path d="M870 34C902 116 998 122 1024 202s-42 151 9 228 145 91 183 178" />
          <path d="M1004 0C1003 96 1096 126 1116 210s-57 129-20 205 128 118 154 214" />
        </g>

        <g fill="rgba(0,214,219,.12)" stroke="rgba(91,235,235,.72)" strokeWidth="2">
          <path d="M690 396L790 346 904 385 890 492 758 530 666 474Z" />
        </g>

        <path
          className="route-line"
          d="M594 128C642 166 649 225 694 257S776 309 803 354 820 443 885 483 984 488 1086 560"
          fill="none"
          stroke="url(#route-gradient)"
          strokeWidth="5"
          strokeLinecap="round"
        />

        {[
          [594,128],[662,230],[727,285],[803,354],[827,438],[885,483],[984,505],[1086,560],
        ].map(([x,y], index) => (
          <g key={String(x) + "-" + String(y)} className={"map-node map-node--" + ((index % 4) + 1)}>
            <circle cx={x} cy={y} r="9" fill="#0a1c24" stroke="#55f3f0" strokeWidth="2" />
            <circle cx={x} cy={y} r="3.2" fill="#ffffff" />
          </g>
        ))}

        <g className="target-ring" transform="translate(803 354)">
          <circle r="18" fill="#0075D6" stroke="#bdfcff" strokeWidth="4" />
          <circle r="35" fill="none" stroke="#55f3f0" strokeWidth="1.5" />
          <circle r="52" fill="none" stroke="rgba(85,243,240,.35)" strokeWidth="1" />
        </g>
      </svg>

      <div className="hero-visual__coordinates">07° 11' 28"S&nbsp;&nbsp;&nbsp;48° 12' 36"W</div>
    </div>
  );
}
