export function HeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div aria-hidden className="hero-spectrum-haze absolute inset-0" />

      <svg
        aria-hidden="true"
        className="hero-spectrum-wave absolute inset-0 h-full w-full"
        viewBox="0 0 1440 620"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <defs>
          <filter
            id="hero-spectrum-glow"
            x="-20%"
            y="-50%"
            width="140%"
            height="200%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation="18" />
          </filter>
        </defs>

        <g className="hero-spectrum-wave__glow" filter="url(#hero-spectrum-glow)">
          <path
            d="M-120 132 C 185 118 350 230 585 360 C 720 435 835 435 980 355 C 1195 236 1325 120 1560 112"
            stroke="#21c7ee"
            strokeWidth="36"
          />
          <path
            d="M-120 154 C 190 138 365 255 595 374 C 725 442 840 442 990 370 C 1205 266 1330 152 1560 136"
            stroke="#314fe8"
            strokeWidth="32"
          />
          <path
            d="M-120 178 C 205 154 380 282 610 388 C 740 448 850 448 1002 384 C 1218 292 1340 174 1560 156"
            stroke="#e2389f"
            strokeWidth="34"
          />
          <path
            d="M-120 204 C 220 174 395 304 626 402 C 750 455 865 455 1015 398 C 1230 316 1350 198 1560 178"
            stroke="#f0cf25"
            strokeWidth="32"
          />
        </g>

        <g className="hero-spectrum-wave__lines">
          <path
            d="M-120 132 C 185 118 350 230 585 360 C 720 435 835 435 980 355 C 1195 236 1325 120 1560 112"
            stroke="#35d8ee"
            strokeWidth="8"
          />
          <path
            d="M-120 154 C 190 138 365 255 595 374 C 725 442 840 442 990 370 C 1205 266 1330 152 1560 136"
            stroke="#405bed"
            strokeWidth="8"
          />
          <path
            d="M-120 178 C 205 154 380 282 610 388 C 740 448 850 448 1002 384 C 1218 292 1340 174 1560 156"
            stroke="#ef4cac"
            strokeWidth="8"
          />
          <path
            d="M-120 204 C 220 174 395 304 626 402 C 750 455 865 455 1015 398 C 1230 316 1350 198 1560 178"
            stroke="#f5d539"
            strokeWidth="8"
          />
        </g>
      </svg>
    </div>
  );
}
