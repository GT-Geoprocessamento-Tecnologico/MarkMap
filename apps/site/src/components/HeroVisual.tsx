export function HeroVisual() {
  const contourPaths = [
    "M-40 170C120 40 280 250 455 128S770 70 955 210 1195 210 1300 82",
    "M-80 262C105 125 300 338 485 214S775 155 970 284 1210 292 1320 156",
    "M-65 370C112 238 286 430 474 332S765 260 970 402 1218 395 1328 272",
    "M-55 496C138 352 314 555 502 448S788 386 982 520 1210 534 1324 410",
    "M-50 624C150 490 340 676 525 576S805 520 1000 646 1215 658 1320 548",
  ];

  return (
    <div className="hero-visual" aria-hidden="true">
      <svg viewBox="0 0 1280 760" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="markmap-route" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#55d8ff" />
            <stop offset="1" stopColor="#00d6db" />
          </linearGradient>
          <radialGradient id="markmap-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#19dbe0" stopOpacity=".34" />
            <stop offset="1" stopColor="#19dbe0" stopOpacity="0" />
          </radialGradient>
          <pattern id="markmap-grid" width="64" height="64" patternUnits="userSpaceOnUse">
            <path d="M64 0H0V64" fill="none" stroke="rgba(255,255,255,.045)" strokeWidth="1" />
          </pattern>
        </defs>

        <rect width="1280" height="760" fill="url(#markmap-grid)" />
        <g className="contour-set" fill="none" stroke="rgba(157,202,207,.18)" strokeWidth="1.4">
          {contourPaths.map((path) => <path key={path} d={path} />)}
        </g>

        <g className="parcel-lines" fill="rgba(29,71,77,.14)" stroke="rgba(94,155,159,.19)" strokeWidth="1">
          <path d="M690 85L948 132 1010 302 875 442 648 365 590 198Z" />
          <path d="M952 140L1212 94 1306 266 1200 438 1013 306Z" />
          <path d="M680 390L874 455 840 698 590 734 530 532Z" />
        </g>

        <circle cx="884" cy="282" r="170" fill="url(#markmap-glow)" />
        <path
          className="route-line"
          d="M510 654C590 575 608 510 676 456S758 355 836 312 966 270 1094 168"
          fill="none"
          stroke="url(#markmap-route)"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {[
          [676, 456],
          [836, 312],
          [957, 274],
          [1094, 168],
        ].map(([x, y], index) => (
          <g key={String(x) + "-" + String(y)} className={"map-node map-node--" + (index + 1)}>
            <circle cx={x} cy={y} r="12" fill="#07131f" stroke="#52f2f0" strokeWidth="2" />
            <circle cx={x} cy={y} r="3.6" fill="#f7ffff" />
          </g>
        ))}

        <g className="target-ring" transform="translate(836 312)">
          <circle r="27" fill="none" stroke="#52f2f0" strokeWidth="1.2" />
          <circle r="49" fill="none" stroke="#52f2f0" strokeOpacity=".35" strokeWidth="1" />
        </g>

        <g className="coordinate-cross" stroke="rgba(255,255,255,.22)" strokeWidth="1">
          <path d="M836 220V404" />
          <path d="M742 312H930" />
        </g>
      </svg>

      <span className="hero-visual__coordinate hero-visual__coordinate--a">07°11'34.8"S</span>
      <span className="hero-visual__coordinate hero-visual__coordinate--b">48°12'27.4"W</span>
      <span className="hero-visual__label">SIRGAS 2000 · EPSG:4674</span>
    </div>
  );
}
