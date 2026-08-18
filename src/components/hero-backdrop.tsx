import { MomoScanner } from "@/components/momo-scanner";

export function HeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* До WebGL, на слабых устройствах и при reduced motion остаётся статичная волна. */}
      <div aria-hidden className="hero-scanner-fallback absolute inset-0" />
      <MomoScanner className="absolute inset-0" />
    </div>
  );
}
