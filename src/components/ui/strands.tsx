"use client";

import { useEffect, useRef, type CSSProperties } from "react";

const DEFAULT_COLORS = ["#151515", "#343434", "#ff5500", "#202020"];

const VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 uv;
in vec2 position;
out vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

/*
 * ReactBits Strands, перенастроенный для светлого hero MOMO. В оригинале
 * свечение рассчитано на тёмный фон. Здесь прозрачность считается отдельно
 * от яркости цвета, поэтому графитовые нити действительно остаются чёрными,
 * а не исчезают на белом фоне.
 */
const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform vec2 uResolution;
uniform float uTime;
uniform float uCount;
uniform float uSpeed;
uniform float uAmplitude;
uniform float uWaviness;
uniform float uThickness;
uniform float uGlow;
uniform float uTaper;
uniform float uSpread;
uniform float uOpacity;
uniform float uScale;
uniform vec3 uColors[6];

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0) / max(uScale, 0.01);

  vec3 ink = vec3(0.0);
  float weight = 0.0;
  float coverage = 0.0;
  float edgeFade = smoothstep(0.015, 0.15, vUv.x)
    * smoothstep(0.015, 0.15, 1.0 - vUv.x);

  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    if (fi >= uCount) break;

    float centered = fi - (uCount - 1.0) * 0.5;
    float phase = fi * 1.73 + uTime * uSpeed;
    float envelope = exp(-pow(abs(p.x) * uTaper, 2.0));
    float carrier = sin(p.x * (9.0 + uWaviness * 3.5) + phase);
    float detail = sin(p.x * (20.0 + uWaviness * 7.0) - phase * 1.27);
    float micro = sin(p.x * 41.0 + phase * 0.63);
    float wave = (carrier * 0.105 + detail * 0.042 + micro * 0.012)
      * uAmplitude * envelope;
    float lane = centered * uSpread * 0.052;
    float strandY = lane + wave;
    float distanceToStrand = abs(p.y - strandY);
    float width = (0.0045 + uThickness * 0.008)
      * (0.55 + envelope * 0.65);
    float strand = 1.0 - smoothstep(width, width * 2.9, distanceToStrand);
    strand *= edgeFade;

    float bevel = 1.0 - smoothstep(0.0, width * 1.55, distanceToStrand);
    vec3 base = uColors[i];
    vec3 metallic = mix(base, min(vec3(1.0), base + vec3(0.58)), bevel * 0.32);

    ink += metallic * strand;
    weight += strand;
    coverage += strand * (0.72 + envelope * 0.55);
  }

  vec3 color = weight > 0.001 ? ink / weight : vec3(0.0);
  float alpha = (1.0 - exp(-coverage * (0.75 + uGlow * 0.55))) * uOpacity;
  alpha = clamp(alpha, 0.0, 0.94);
  fragColor = vec4(color, alpha);
}
`;

export type StrandsProps = {
  colors?: string[];
  count?: number;
  speed?: number;
  amplitude?: number;
  waviness?: number;
  thickness?: number;
  glow?: number;
  taper?: number;
  spread?: number;
  opacity?: number;
  scale?: number;
  className?: string;
  style?: CSSProperties;
};

export function Strands({
  colors = DEFAULT_COLORS,
  count = 4,
  speed = 0.45,
  amplitude = 1,
  waviness = 1,
  thickness = 0.7,
  glow = 2.6,
  taper = 3,
  spread = 1,
  opacity = 1,
  scale = 1.5,
  className,
  style,
}: StrandsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let dispose = () => {};
    container.dataset.strandsStatus = "loading";

    void import("ogl").then(({ Color, Mesh, Program, Renderer, Triangle }) => {
      if (cancelled || !container.isConnected) return;

      let renderer: InstanceType<typeof Renderer>;
      try {
        renderer = new Renderer({
          alpha: true,
          antialias: true,
          depth: false,
          dpr: Math.min(window.devicePixelRatio || 1, 1.5),
          premultipliedAlpha: false,
          webgl: 2,
          powerPreference: "high-performance",
        });
      } catch {
        // SVG-подложка в HeroBackdrop остаётся видимой как безопасный fallback.
        container.dataset.strandsStatus = "renderer-unavailable";
        return;
      }

      const gl = renderer.gl;
      const canvas = gl.canvas;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
      container.appendChild(canvas);

      const palette = Array.from({ length: 6 }, (_, index) => {
        const color = colors[index % Math.max(colors.length, 1)] ?? "#151515";
        return new Color(color);
      });

      const uniforms = {
        uResolution: { value: [1, 1] },
        uTime: { value: 0 },
        uCount: { value: Math.min(Math.max(count, 1), 6) },
        uSpeed: { value: speed },
        uAmplitude: { value: amplitude },
        uWaviness: { value: waviness },
        uThickness: { value: thickness },
        uGlow: { value: glow },
        uTaper: { value: taper },
        uSpread: { value: spread },
        uOpacity: { value: opacity },
        uScale: { value: scale },
        uColors: { value: palette },
      };

      let program: InstanceType<typeof Program>;
      let mesh: InstanceType<typeof Mesh>;
      try {
        program = new Program(gl, {
          vertex: VERTEX_SHADER,
          fragment: FRAGMENT_SHADER,
          uniforms,
          transparent: true,
          depthTest: false,
          depthWrite: false,
        });
        mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
      } catch {
        container.dataset.strandsStatus = "shader-unavailable";
        canvas.remove();
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        return;
      }

      container.dataset.strandsStatus = "ready";

      const resize = () => {
        const width = Math.max(container.clientWidth, 1);
        const height = Math.max(container.clientHeight, 1);
        renderer.setSize(width, height);
        uniforms.uResolution.value = [width * renderer.dpr, height * renderer.dpr];
      };

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let inViewport = true;
      let frame = 0;
      let startTime = performance.now();

      const render = (time: number) => {
        frame = 0;
        uniforms.uTime.value = (time - startTime) * 0.001;
        renderer.render({ scene: mesh });
        if (!reducedMotion && inViewport && !document.hidden) {
          frame = requestAnimationFrame(render);
        }
      };

      const start = () => {
        if (reducedMotion || frame || !inViewport || document.hidden) return;
        startTime = performance.now() - uniforms.uTime.value * 1000;
        frame = requestAnimationFrame(render);
      };

      const stop = () => {
        if (!frame) return;
        cancelAnimationFrame(frame);
        frame = 0;
      };

      const resizeObserver = new ResizeObserver(() => {
        resize();
        if (reducedMotion) renderer.render({ scene: mesh });
      });
      resizeObserver.observe(container);

      const intersectionObserver = new IntersectionObserver(([entry]) => {
        inViewport = entry?.isIntersecting ?? true;
        if (inViewport) start();
        else stop();
      });
      intersectionObserver.observe(container);

      const handleVisibility = () => {
        if (document.hidden) stop();
        else start();
      };
      document.addEventListener("visibilitychange", handleVisibility);

      resize();
      if (reducedMotion) renderer.render({ scene: mesh });
      else start();

      dispose = () => {
        stop();
        resizeObserver.disconnect();
        intersectionObserver.disconnect();
        document.removeEventListener("visibilitychange", handleVisibility);
        program.remove();
        canvas.remove();
        delete container.dataset.strandsStatus;
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      };
    }).catch(() => {
      // Если динамический чанк не загрузился, статичный фон продолжает работать.
      if (!cancelled) container.dataset.strandsStatus = "module-unavailable";
    });

    return () => {
      cancelled = true;
      dispose();
      delete container.dataset.strandsStatus;
    };
  }, [amplitude, colors, count, glow, opacity, scale, speed, spread, taper, thickness, waviness]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={className}
      style={style}
    />
  );
}
