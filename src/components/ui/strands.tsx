"use client";

import { useEffect, useRef, type CSSProperties } from "react";

const MAX_STRANDS = 12;
const MAX_COLORS = 8;
const DEFAULT_COLORS = ["#6fffe9", "#fff4a8", "#ff63b6", "#6f8cff", "#b95cff"];

const VERTEX_SHADER = `#version 300 es
in vec2 position;

void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

/* Оригинальная светящаяся модель ReactBits Strands. */
const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColors[${MAX_COLORS}];
uniform int uColorCount;
uniform int uStrandCount;
uniform float uSpeed;
uniform float uAmplitude;
uniform float uWaviness;
uniform float uThickness;
uniform float uGlow;
uniform float uTaper;
uniform float uSpread;
uniform float uHueShift;
uniform float uIntensity;
uniform float uOpacity;
uniform float uScale;
uniform float uSaturation;

out vec4 fragColor;

const float PI = 3.14159265;

vec3 spectrum(float t) {
  return 0.5 + 0.5 * cos(2.0 * PI * (t + vec3(0.00, 0.33, 0.67)));
}

vec3 samplePalette(float t) {
  t = fract(t);
  float scaled = t * float(uColorCount);
  int idx = int(floor(scaled));
  float blend = fract(scaled);
  int nextIdx = idx + 1;
  if (nextIdx >= uColorCount) nextIdx = 0;
  return mix(uColors[idx], uColors[nextIdx], blend);
}

vec3 strandColor(float t) {
  if (uColorCount > 0) return samplePalette(t);
  return spectrum(t);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  uv /= max(uScale, 0.0001);

  float e = 0.06 + uIntensity * 0.94;
  float env = pow(max(cos(uv.x * PI * 1.3), 0.0), uTaper);
  vec3 col = vec3(0.0);

  for (int i = 0; i < ${MAX_STRANDS}; i++) {
    if (i >= uStrandCount) break;

    float fi = float(i);
    float ph = fi * 1.7 * uSpread;
    float freq = (2.0 + fi * 0.35) * uWaviness;
    float spd = 1.4 + fi * 1.2;

    float tt = uTime * uSpeed;
    float w = sin(uv.x * freq + tt * spd + ph) * 0.60
      + sin(uv.x * freq * 1.1 - tt * spd * 0.7 + ph * 1.7) * 0.40;

    float amp = (0.1 + 0.02 * e) * env * uAmplitude;
    float y = w * amp;
    float d = abs(uv.y - y);
    float thick = (0.001 + 0.05 * e) * (0.35 + env) * uThickness;
    float normalizedDistance = d / max(thick, 0.0001);
    float g = 2.2 * exp(-normalizedDistance * normalizedDistance * 1.4)
      + 0.35 * exp(-normalizedDistance * normalizedDistance * 0.035);

    float h = fi / float(uStrandCount) + uv.x * 0.30 + uTime * 0.04 + uHueShift;
    col += strandColor(h) * g * env;
  }

  col *= 0.45 + 0.7 * e;
  col = 1.0 - exp(-col * uGlow);

  // На широком hero убираем только самый дальний цветной туман, сохраняя
  // яркое ядро и мягкое свечение непосредственно вокруг каждой ленты.
  float haloEnergy = max(max(col.r, col.g), col.b);
  col *= smoothstep(0.07, 0.24, haloEnergy);

  float gray = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = max(mix(vec3(gray), col, uSaturation), 0.0);

  float lum = max(max(col.r, col.g), col.b);
  float alpha = clamp(lum, 0.0, 1.0) * uOpacity;
  fragColor = vec4(col * uOpacity, alpha);
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
  hueShift?: number;
  intensity?: number;
  saturation?: number;
  opacity?: number;
  scale?: number;
  className?: string;
  style?: CSSProperties;
};

export function Strands({
  colors = DEFAULT_COLORS,
  count = 4,
  speed = 0.5,
  amplitude = 1,
  waviness = 1,
  thickness = 0.7,
  glow = 2.6,
  taper = 3,
  spread = 1,
  hueShift = 0,
  intensity = 0.6,
  saturation = 1.5,
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
          premultipliedAlpha: true,
          webgl: 2,
          powerPreference: "high-performance",
        });
      } catch {
        container.dataset.strandsStatus = "renderer-unavailable";
        return;
      }

      const gl = renderer.gl;
      const canvas = gl.canvas;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
      canvas.style.backgroundColor = "transparent";
      gl.clearColor(0, 0, 0, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      container.appendChild(canvas);

      const buildPalette = () => {
        const source = colors.length ? colors : ["#ffffff"];
        return Array.from({ length: MAX_COLORS }, (_, index) => {
          const color = new Color(source[index] ?? source[source.length - 1]);
          return [color.r, color.g, color.b];
        });
      };

      const uniforms = {
        uTime: { value: 0 },
        uResolution: { value: [1, 1] },
        uColors: { value: buildPalette() },
        uColorCount: { value: Math.min(Math.max(colors.length, 1), MAX_COLORS) },
        uStrandCount: { value: Math.min(Math.max(Math.round(count), 1), MAX_STRANDS) },
        uSpeed: { value: speed },
        uAmplitude: { value: amplitude },
        uWaviness: { value: waviness },
        uThickness: { value: thickness },
        uGlow: { value: glow },
        uTaper: { value: taper },
        uSpread: { value: spread },
        uHueShift: { value: hueShift },
        uIntensity: { value: intensity },
        uOpacity: { value: opacity },
        uScale: { value: scale },
        uSaturation: { value: saturation },
      };

      let program: InstanceType<typeof Program>;
      let mesh: InstanceType<typeof Mesh>;
      try {
        const geometry = new Triangle(gl);
        if (geometry.attributes.uv) delete geometry.attributes.uv;
        program = new Program(gl, {
          vertex: VERTEX_SHADER,
          fragment: FRAGMENT_SHADER,
          uniforms,
          transparent: true,
          depthTest: false,
          depthWrite: false,
        });
        program.setBlendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        mesh = new Mesh(gl, { geometry, program });
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
      if (!cancelled) container.dataset.strandsStatus = "module-unavailable";
    });

    return () => {
      cancelled = true;
      dispose();
      delete container.dataset.strandsStatus;
    };
  }, [
    amplitude,
    colors,
    count,
    glow,
    hueShift,
    intensity,
    opacity,
    saturation,
    scale,
    speed,
    spread,
    taper,
    thickness,
    waviness,
  ]);

  return <div ref={containerRef} aria-hidden="true" className={className} style={style} />;
}
