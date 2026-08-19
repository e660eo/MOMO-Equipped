import { MomoFloatingLines } from "@/components/momo-floating-lines";

export function HeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* До WebGL, на слабых устройствах и при reduced motion остаются статичные линии. */}
      <div aria-hidden className="hero-floating-lines-fallback absolute inset-0" />
      <MomoFloatingLines className="absolute inset-0" />
    </div>
  );
}
