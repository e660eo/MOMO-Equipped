export function WaveDivider() {
  const d =
    "M0 32 H540 L560 32 570 14 580 50 590 8 600 56 610 20 620 44 630 28 640 32 H1400";
  return (
    <svg
      className="wave"
      viewBox="0 0 1400 64"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path className="base" d={d} strokeWidth="1.5" />
      <path className="live" d={d} strokeWidth="1.5" />
    </svg>
  );
}
