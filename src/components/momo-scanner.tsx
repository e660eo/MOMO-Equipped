"use client";

import { useEffect, useRef } from "react";
import { Mesh, Program, Renderer, Triangle } from "ogl";

/*
  React Bits Scanner — adapted for the MOMO hero.
  https://reactbits.dev/backgrounds/scanner

  MIT + Commons Clause License Condition v1.0
  Copyright (c) 2026 David Haz

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, and distribute the Software as part of
  an application, website, or product, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in
  all copies or substantial portions of the Software.

  Commons Clause Restriction: You may use this Software, including for any
  commercial purpose, so long as you do not sell, sublicense, or redistribute
  the components themselves—whether alone, in a bundle, or as a ported version.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.

  The original chromatic field is deliberately monochrome here. The shader
  draws black graphite traces in the light theme and pale graphite traces in
  the dark theme, so the same signal remains legible without becoming a second
  brand accent beside MOMO orange.
*/

const vertex = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uSpeed;
uniform float uSweepSpeed;
uniform float uSweepWidth;
uniform float uSweepFalloff;
uniform float uScale;
uniform float uFrequency;
uniform float uRipple;
uniform float uBandDensity;
uniform float uLineSharpness;
uniform float uGlow;
uniform float uBrightness;
uniform float uContrast;
uniform float uSoftness;
uniform float uVignette;
uniform float uOpacity;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
out vec4 fragColor;

const float TAU = 6.2831853;

float signalField(vec2 p, float t) {
  float wave = sin(p.x * 1.3 + t * 0.7);
  wave += sin(p.y * 1.7 - t * 0.52) * 0.8;
  wave += sin((p.x + p.y) * 0.9 + t * 0.91) * 0.6;
  wave += sin((p.x - p.y) * 1.53 - t * 0.63) * 0.42;
  return wave * 0.35;
}

vec3 palette(float signal) {
  signal = pow(clamp(signal, 0.0, 1.0), uContrast);
  vec3 color = mix(uColor1, uColor2, smoothstep(0.08, 0.6, signal));
  return mix(color, uColor3, smoothstep(0.68, 1.0, signal));
}

float scanBand(float x, float antiAlias, float sharpness) {
  float value = mix(0.5, 0.5 + 0.5 * cos(x * TAU), antiAlias);
  return pow(value, sharpness);
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - iResolution.xy) / iResolution.y;
  vec2 point = uv / max(uScale, 0.001);
  float time = iTime * uSpeed;

  float signal = signalField(point * uFrequency, time);
  float coordinate = point.y + signal * uRipple;

  float phase = coordinate / max(uSweepWidth, 0.05) - time * uSweepSpeed;
  float sweep = pow(
    0.5 + 0.5 * cos(phase * TAU),
    max(uSweepFalloff, 0.1)
  );

  float lineCoordinate = coordinate * uBandDensity;
  float antiAlias = 1.0 / (1.0 + uSoftness * fwidth(lineCoordinate) * 3.0);
  antiAlias = clamp(antiAlias, 0.0, 1.0);

  float bodyBase = clamp(0.5 + 0.5 * signal, 0.0, 1.0);
  float body = bodyBase * bodyBase * uGlow * sweep;
  float line = clamp(
    scanBand(lineCoordinate, antiAlias, max(uLineSharpness, 0.1)) * sweep + body,
    0.0,
    1.0
  );

  vec3 color = palette(line);
  float intensity = line * uBrightness;
  intensity *= clamp(
    1.0 - uVignette * smoothstep(0.5, 1.65, length(uv)),
    0.0,
    1.0
  );

  float alpha = clamp(intensity * uOpacity, 0.0, 1.0);
  fragColor = vec4(clamp(color, 0.0, 1.0) * alpha, alpha);
}
`;

type NumericUniform = { value: number };
type VectorUniform = { value: Float32Array };

function setRgb(uniform: VectorUniform, rgb: readonly [number, number, number]) {
  uniform.value[0] = rgb[0];
  uniform.value[1] = rgb[1];
  uniform.value[2] = rgb[2];
}

export function MomoScanner({ className = "" }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionPreference.matches) return;

    let renderer: Renderer | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let intersectionObserver: IntersectionObserver | null = null;
    let themeObserver: MutationObserver | null = null;
    let frame = 0;
    let visible = true;
    let pageVisible = !document.hidden;
    let elapsed = 0;
    let previousTime = performance.now();

    try {
      renderer = new Renderer({
        webgl: 2,
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        dpr: Math.min(window.devicePixelRatio || 1, 1.5),
        powerPreference: "high-performance",
      });

      if (!renderer.isWebgl2) {
        renderer.gl.getExtension("WEBGL_lose_context")?.loseContext();
        return;
      }

      const gl = renderer.gl;
      gl.clearColor(0, 0, 0, 0);

      const uniforms = {
        iTime: { value: 0 },
        iResolution: { value: new Float32Array([1, 1]) },
        uSpeed: { value: 0.34 },
        uSweepSpeed: { value: 0.2 },
        uSweepWidth: { value: 1.9 },
        uSweepFalloff: { value: 6.8 },
        uScale: { value: 1.35 },
        uFrequency: { value: 2.1 },
        uRipple: { value: 0.44 },
        uBandDensity: { value: 11.5 },
        uLineSharpness: { value: 7.2 },
        uGlow: { value: 0.08 },
        uBrightness: { value: 0.9 },
        uContrast: { value: 1.35 },
        uSoftness: { value: 1.7 },
        uVignette: { value: 0.66 },
        uOpacity: { value: 0.6 },
        uColor1: { value: new Float32Array([0.015, 0.015, 0.018]) },
        uColor2: { value: new Float32Array([0.09, 0.09, 0.105]) },
        uColor3: { value: new Float32Array([0.25, 0.25, 0.27]) },
      };

      const geometry = new Triangle(gl);
      const program = new Program(gl, {
        vertex,
        fragment,
        uniforms,
        transparent: true,
        cullFace: false,
        depthTest: false,
        depthWrite: false,
      });
      const mesh = new Mesh(gl, { geometry, program });

      canvas = gl.canvas;
      canvas.setAttribute("aria-hidden", "true");
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
      container.appendChild(canvas);

      const resolution = uniforms.iResolution as VectorUniform;
      const time = uniforms.iTime as NumericUniform;
      const opacity = uniforms.uOpacity as NumericUniform;
      const brightness = uniforms.uBrightness as NumericUniform;
      const color1 = uniforms.uColor1 as VectorUniform;
      const color2 = uniforms.uColor2 as VectorUniform;
      const color3 = uniforms.uColor3 as VectorUniform;

      const syncTheme = () => {
        const isDark = document.documentElement.dataset.theme === "dark";
        if (isDark) {
          setRgb(color1, [0.24, 0.24, 0.26]);
          setRgb(color2, [0.58, 0.58, 0.61]);
          setRgb(color3, [0.94, 0.94, 0.96]);
          opacity.value = 0.38;
          brightness.value = 0.68;
        } else {
          setRgb(color1, [0.015, 0.015, 0.018]);
          setRgb(color2, [0.09, 0.09, 0.105]);
          setRgb(color3, [0.25, 0.25, 0.27]);
          opacity.value = 0.6;
          brightness.value = 0.9;
        }
      };

      const resize = () => {
        if (!renderer) return;
        const rect = container.getBoundingClientRect();
        renderer.setSize(
          Math.max(1, Math.floor(rect.width)),
          Math.max(1, Math.floor(rect.height)),
        );
        resolution.value[0] = renderer.gl.drawingBufferWidth;
        resolution.value[1] = renderer.gl.drawingBufferHeight;
        renderer.render({ scene: mesh });
      };

      const loop = (now: number) => {
        const delta = Math.min((now - previousTime) / 1000, 0.05);
        previousTime = now;
        elapsed += delta;
        time.value = elapsed;
        renderer?.render({ scene: mesh });
        frame = requestAnimationFrame(loop);
      };

      const stop = () => {
        if (!frame) return;
        cancelAnimationFrame(frame);
        frame = 0;
      };

      const start = () => {
        if (!visible || !pageVisible || frame) return;
        previousTime = performance.now();
        frame = requestAnimationFrame(loop);
      };

      const onVisibilityChange = () => {
        pageVisible = !document.hidden;
        if (pageVisible) start();
        else stop();
      };

      const onMotionPreferenceChange = (event: MediaQueryListEvent) => {
        if (event.matches) stop();
        else start();
      };

      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
      intersectionObserver = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) start();
        else stop();
      });
      intersectionObserver.observe(container);
      themeObserver = new MutationObserver(syncTheme);
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });

      document.addEventListener("visibilitychange", onVisibilityChange);
      motionPreference.addEventListener("change", onMotionPreferenceChange);

      syncTheme();
      resize();
      start();

      return () => {
        stop();
        resizeObserver?.disconnect();
        intersectionObserver?.disconnect();
        themeObserver?.disconnect();
        document.removeEventListener("visibilitychange", onVisibilityChange);
        motionPreference.removeEventListener("change", onMotionPreferenceChange);
        if (canvas?.parentNode === container) container.removeChild(canvas);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      };
    } catch {
      if (canvas?.parentNode === container) container.removeChild(canvas);
      renderer?.gl.getExtension("WEBGL_lose_context")?.loseContext();
      return;
    }
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`h-full w-full overflow-hidden ${className}`.trim()}
    />
  );
}
