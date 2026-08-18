"use client";

import { useEffect, useRef } from "react";
import { Mesh, Program, Renderer, Triangle } from "ogl";

/*
  React Bits Floating Lines — adapted for the MOMO hero.
  https://reactbits.dev/backgrounds/floating-lines?gradientStart=EAB308

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

  The original Three.js shader is ported to the OGL renderer already used by
  the storefront. This keeps the same three-wave geometry and pointer bend
  without adding a second WebGL runtime to the public bundle.
*/

const vertex = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `
precision highp float;

uniform vec2 iResolution;
uniform float iTime;
uniform float uAnimationSpeed;
uniform float uLineDistance;
uniform vec2 uMouse;
uniform float uBendInfluence;
uniform vec2 uParallaxOffset;
uniform vec3 uColorStart;
uniform vec3 uColorMid;
uniform vec3 uColorEnd;
uniform float uOpacity;

mat2 rotate2d(float angle) {
  return mat2(cos(angle), sin(angle), -sin(angle), cos(angle));
}

vec3 lineColor(float t) {
  if (t < 0.5) {
    return mix(uColorStart, uColorMid, t * 2.0);
  }
  return mix(uColorMid, uColorEnd, (t - 0.5) * 2.0);
}

float wave(
  vec2 uv,
  float offset,
  vec2 screenUv,
  vec2 mouseUv,
  float strength
) {
  float time = iTime * uAnimationSpeed;
  float amplitude = sin(offset + time * 0.2) * 0.3;
  float y = sin(uv.x + offset + time * 0.1) * amplitude;

  vec2 delta = screenUv - mouseUv;
  float influence = exp(-dot(delta, delta) * 8.0);
  y += (mouseUv.y - screenUv.y) * influence * -2.0 * uBendInfluence;

  float distanceToLine = uv.y - y;
  return (0.0175 / max(abs(distanceToLine) + 0.01, 0.001) + 0.01) * strength;
}

void main() {
  vec2 baseUv = (2.0 * gl_FragCoord.xy - iResolution.xy) / iResolution.y;
  baseUv.y *= -1.0;
  baseUv += uParallaxOffset;

  vec2 mouseUv = (2.0 * uMouse - iResolution.xy) / iResolution.y;
  mouseUv.y *= -1.0;

  vec3 color = vec3(0.0);

  for (int i = 0; i < 8; ++i) {
    float fi = float(i);
    float t = fi / 7.0;
    vec3 gradient = lineColor(t);

    float bottomAngle = -1.0 * log(length(baseUv) + 1.0);
    vec2 bottomUv = baseUv * rotate2d(bottomAngle);
    color += gradient * wave(
      bottomUv + vec2(uLineDistance * fi + 2.0, -0.7),
      1.5 + 0.2 * fi,
      baseUv,
      mouseUv,
      0.2
    );

    float middleAngle = 0.2 * log(length(baseUv) + 1.0);
    vec2 middleUv = baseUv * rotate2d(middleAngle);
    color += gradient * wave(
      middleUv + vec2(uLineDistance * fi + 5.0, 0.0),
      2.0 + 0.15 * fi,
      baseUv,
      mouseUv,
      1.0
    );

    float topAngle = -0.4 * log(length(baseUv) + 1.0);
    vec2 topUv = baseUv * rotate2d(topAngle);
    topUv.x *= -1.0;
    color += gradient * wave(
      topUv + vec2(uLineDistance * fi + 10.0, 0.5),
      1.0 + 0.2 * fi,
      baseUv,
      mouseUv,
      0.1
    );
  }

  color = min(color * 0.5, vec3(1.0));
  float luminance = max(max(color.r, color.g), color.b);
  float alpha = clamp(luminance * uOpacity, 0.0, 0.78);
  gl_FragColor = vec4(color * alpha, alpha);
}
`;

type NumericUniform = { value: number };
type VectorUniform = { value: Float32Array };

function setRgb(uniform: VectorUniform, rgb: readonly [number, number, number]) {
  uniform.value[0] = rgb[0];
  uniform.value[1] = rgb[1];
  uniform.value[2] = rgb[2];
}

export function MomoFloatingLines({ className = "" }: { className?: string }) {
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

    const targetMouse = new Float32Array([-1000, -1000]);
    const currentMouse = new Float32Array([-1000, -1000]);
    const targetParallax = new Float32Array([0, 0]);
    const currentParallax = new Float32Array([0, 0]);
    let targetInfluence = 0;
    let currentInfluence = 0;

    try {
      renderer = new Renderer({
        webgl: 1,
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        dpr: Math.min(window.devicePixelRatio || 1, 1.5),
        powerPreference: "high-performance",
      });

      const gl = renderer.gl;
      gl.clearColor(0, 0, 0, 0);

      const uniforms = {
        iResolution: { value: new Float32Array([1, 1]) },
        iTime: { value: 0 },
        uAnimationSpeed: { value: 0.62 },
        uLineDistance: { value: 0.08 },
        uMouse: { value: currentMouse },
        uBendInfluence: { value: 0 },
        uParallaxOffset: { value: currentParallax },
        uColorStart: { value: new Float32Array([0.918, 0.702, 0.031]) },
        uColorMid: { value: new Float32Array([0.34, 0.34, 0.36]) },
        uColorEnd: { value: new Float32Array([0.09, 0.09, 0.1]) },
        uOpacity: { value: 0.72 },
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
      container.parentElement?.setAttribute("data-floating-lines-active", "true");

      const resolution = uniforms.iResolution as VectorUniform;
      const time = uniforms.iTime as NumericUniform;
      const influence = uniforms.uBendInfluence as NumericUniform;
      const opacity = uniforms.uOpacity as NumericUniform;
      const colorStart = uniforms.uColorStart as VectorUniform;
      const colorMid = uniforms.uColorMid as VectorUniform;
      const colorEnd = uniforms.uColorEnd as VectorUniform;

      const syncTheme = () => {
        const isDark = document.documentElement.dataset.theme === "dark";
        if (isDark) {
          setRgb(colorStart, [0.918, 0.702, 0.031]);
          setRgb(colorMid, [0.435, 0.435, 0.435]);
          setRgb(colorEnd, [0.416, 0.416, 0.416]);
          opacity.value = 0.72;
        } else {
          setRgb(colorStart, [0.72, 0.53, 0.0]);
          setRgb(colorMid, [0.34, 0.34, 0.36]);
          setRgb(colorEnd, [0.09, 0.09, 0.1]);
          opacity.value = 0.72;
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

      const handlePointerMove = (event: PointerEvent) => {
        if (!renderer) return;
        const rect = container.getBoundingClientRect();
        const inside =
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom;

        if (!inside) {
          targetInfluence = 0;
          targetParallax[0] = 0;
          targetParallax[1] = 0;
          return;
        }

        const dpr = renderer.dpr;
        const x = (event.clientX - rect.left) * dpr;
        const y = (rect.height - (event.clientY - rect.top)) * dpr;
        targetMouse[0] = x;
        targetMouse[1] = y;
        targetInfluence = 1;
        targetParallax[0] = ((event.clientX - rect.left) / rect.width - 0.5) * 0.12;
        targetParallax[1] = -((event.clientY - rect.top) / rect.height - 0.5) * 0.12;
      };

      const handlePointerLeave = () => {
        targetInfluence = 0;
        targetParallax[0] = 0;
        targetParallax[1] = 0;
      };

      const loop = (now: number) => {
        const delta = Math.min((now - previousTime) / 1000, 0.05);
        previousTime = now;
        elapsed += delta;
        time.value = elapsed;

        const damping = 0.055;
        currentMouse[0] += (targetMouse[0] - currentMouse[0]) * damping;
        currentMouse[1] += (targetMouse[1] - currentMouse[1]) * damping;
        currentParallax[0] += (targetParallax[0] - currentParallax[0]) * damping;
        currentParallax[1] += (targetParallax[1] - currentParallax[1]) * damping;
        currentInfluence += (targetInfluence - currentInfluence) * damping;
        influence.value = currentInfluence;

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

      window.addEventListener("pointermove", handlePointerMove, { passive: true });
      window.addEventListener("pointerout", handlePointerLeave);
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
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerout", handlePointerLeave);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        motionPreference.removeEventListener("change", onMotionPreferenceChange);
        container.parentElement?.removeAttribute("data-floating-lines-active");
        if (canvas?.parentNode === container) container.removeChild(canvas);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      };
    } catch {
      container.parentElement?.removeAttribute("data-floating-lines-active");
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
