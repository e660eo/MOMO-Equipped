import { Strands } from "@/components/ui/strands";

/*
  Фон первого экрана объединяет ReactBits Strands с дешёвым SVG-fallback.
  WebGL даёт объёмные нити, похожие на живую осциллограмму, а SVG виден до
  гидратации и остаётся единственным фоном, если браузер не поддерживает WebGL2.
*/

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

/*
  Три близких слоя дают мягкую глубину без цветового шума. Серые полосы
  поддерживают металлический характер автозвука, оранжевая — фирменный сигнал.
*/
const BANDS = [
  { y: -22, color: "#d7d3ce", o: 0.52 },
  { y: 0, color: "#ff5500", o: 0.24 },
  { y: 22, color: "#aaa59f", o: 0.34 },
];

const STRAND_COLORS = [
  "#121212",
  "#343434",
  "#ff5500",
  "#1d1d1d",
  "#4a4a4a",
];

export function HeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <Strands
        className="hero-strands absolute inset-x-[-18%] top-[10%] h-[50%] sm:inset-x-[-10%] sm:top-[9%] sm:h-[58%]"
        colors={STRAND_COLORS}
        count={5}
        speed={0.28}
        amplitude={0.92}
        waviness={1.08}
        thickness={0.38}
        glow={0.9}
        taper={3.25}
        spread={0.56}
        opacity={0.82}
        scale={1}
      />

      <svg
        aria-hidden="true"
        className="hero-wave absolute inset-x-0 top-[10%] h-[50%] w-full sm:top-[9%] sm:h-[58%]"
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
