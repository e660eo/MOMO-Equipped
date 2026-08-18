import { MomoLightTunnel } from "@/components/momo-light-tunnel";

export function HeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* На слабых устройствах и при reduced motion останется этот статичный тоннель. */}
      <div aria-hidden className="hero-tunnel-fallback absolute inset-0" />
      <MomoLightTunnel className="absolute inset-0" />
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_38%_42%_at_50%_47%,rgba(255,85,0,0.11),transparent_72%)]"
      />
    </div>
  );
}
