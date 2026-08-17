import { Strands } from "@/components/ui/strands";

/* Неоновый Strands в исходной эстетике ReactBits + SVG-fallback без WebGL2. */

/**
 * Кривая на два периода: сдвиг ровно на период замыкается без стыка.
 * Описана один раз — ленты различаются только сдвигом по вертикали, который
 * задаётся атрибутом y у <use>. Иначе восемь почти одинаковых путей занимали
 * бы 19 КБ разметки на каждой загрузке главной вместо трёх.
 */
const wavePath = (() => {
  const period = 1200;
  const mid = 200;
  const amp = 100; // yScale 0.5 шейдера, где половина высоты равна 1
  const pts: string[] = [];
  for (let x = 0; x <= period * 2; x += 12) {
    const t = ((x - period) / period) * Math.PI * 2;
    pts.push(`${x === 0 ? "M" : "L"}${x} ${(mid + Math.sin(t) * amp).toFixed(1)}`);
  }
  return pts.join(" ");
})();

const BANDS = [
  { y: -36, color: "#6fffe9", o: 0.78 },
  { y: -12, color: "#fff4a8", o: 0.72 },
  { y: 14, color: "#ff63b6", o: 0.82 },
  { y: 38, color: "#6f8cff", o: 0.78 },
];

const STRAND_COLORS = [
  "#6fffe9",
  "#fff4a8",
  "#ff63b6",
  "#6f8cff",
  "#b95cff",
];

export function HeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <Strands
        className="hero-strands absolute inset-0"
        colors={STRAND_COLORS}
        count={4}
        speed={0.46}
        amplitude={1.2}
        waviness={1}
        thickness={0.24}
        glow={3}
        taper={3}
        spread={1}
        hueShift={0.02}
        intensity={0.32}
        saturation={1.42}
        opacity={1}
        scale={1.15}
      />

      <svg
        aria-hidden="true"
        className="hero-wave absolute inset-0 h-full w-full"
        viewBox="0 0 1200 400"
        preserveAspectRatio="none"
        fill="none"
      >
        {/* SVG остаётся мягким резервным слоем под WebGL. */}
        <defs>
          <path id="momo-wave" d={wavePath} />
        </defs>
        <g className="hero-wave__track">
          <g className="hero-wave__ink">
            {BANDS.map((b) => (
              <use
                key={b.y}
                href="#momo-wave"
                y={b.y}
                stroke={b.color}
                strokeOpacity={b.o}
                strokeWidth="34"
                strokeLinecap="round"
              />
            ))}
          </g>
        </g>
      </svg>
    </div>
  );
}
