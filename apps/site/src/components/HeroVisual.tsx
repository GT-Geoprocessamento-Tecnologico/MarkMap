export function HeroVisual() {
  return (
    <div className="hero-visual" aria-hidden="true">
      <svg viewBox="0 0 1200 760" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="route-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#0075D6" /><stop offset="1" stopColor="#00D6DB" />
          </linearGradient>
          <pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse">
            <path d="M44 0H0V44" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="1200" height="760" fill="url(#grid)" />
        <g fill="none" stroke="rgba(255,255,255,.09)" strokeWidth="2">
          <path d="M70 610C190 470 250 640 390 510S610 370 760 470 990 560 1180 360" />
          <path d="M10 250C180 150 300 300 470 190S760 95 900 180 1080 230 1210 120" />
          <path d="M110 680C210 590 280 710 420 610S650 520 770 590 1010 660 1190 530" />
        </g>
        <polygon points="350,180 660,125 870,300 790,575 470,635 270,420" fill="rgba(0,214,219,.05)" stroke="url(#route-gradient)" strokeWidth="3" />
        <path className="route-line" d="M235 560L390 410 535 455 690 275 865 330 1025 175" fill="none" stroke="url(#route-gradient)" strokeWidth="5" strokeLinecap="round" />
        {[[390,410],[535,455],[690,275],[865,330]].map(([x,y]) => <g key={`${x}-${y}`}><circle cx={x} cy={y} r="11" fill="#07131f" stroke="#00D6DB" strokeWidth="3" /><circle cx={x} cy={y} r="3" fill="#fff" /></g>)}
        <circle className="route-pulse" cx="690" cy="275" r="36" fill="none" stroke="#00D6DB" strokeWidth="2" />
      </svg>
    </div>
  );
}
