"use client";

import { useEffect, useRef } from "react";
import { Mesh, Program, Renderer, Triangle } from "ogl";

/*
  React Bits Light Tunnel — adapted for the MOMO hero.
  https://reactbits.dev/backgrounds/light-tunnel

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

  The original purple/rainbow look is intentionally replaced with graphite
  cables and orange pulses. This component is decorative and has no bearing on
  the page layout, so a failed or unavailable WebGL2 context simply leaves the
  static CSS fallback rendered by HeroBackdrop in place.
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
uniform float uFlowDir;
uniform float uPulseSpeed;
uniform float uPulseLength;
uniform float uPulseBlend;
uniform float uPulseWidth;
uniform float uCableCount;
uniform float uThickness;
uniform float uRimWidth;
uniform float uWaviness;
uniform float uSway;
uniform float uSize;
uniform vec2 uCenter;
uniform vec2 uMouseOffset;
uniform float uGlow;
uniform float uFadeNear;
uniform float uFadeFar;
uniform float uBrightness;
uniform float uOpacity;
uniform vec3 uCableColor;
uniform vec3 uPulseColor;
uniform vec3 uTunnelColor;
uniform float uTunnelOpacity;
out vec4 fragColor;

void mainImage(out vec4 o, in vec2 fragCoord) {
  float size = uSize * 2.0;
  float speedBase = uSpeed * 4.0 * uFlowDir;
  float waviness = uWaviness * 0.15;
  float rotationOsc = uSway * 0.5;
  float baseThick = uThickness * 0.35 + 0.05;
  float borderWeight = uRimWidth * 0.15 + 0.01;
  float cablesCount = floor(uCableCount);

  vec2 res = iResolution.xy;
  vec2 uv = (fragCoord - 0.5 * res) / min(res.y, res.x);
  uv -= (uCenter + uMouseOffset);
  uv /= (size + 0.0001);

  float r = length(uv);
  float angle = atan(uv.y, uv.x);
  float depth = -log(r + 0.0001);

  float swing = sin(iTime * (uSpeed * 0.5 + 0.1)) * rotationOsc;
  float waveOffset = sin(depth * 1.2 + iTime * speedBase * 0.25) * waviness;

  float angleNormalized = (angle / 6.2831853) + 0.5;
  float finalAngle = fract(angleNormalized + waveOffset + swing);

  float cableID = floor(finalAngle * cablesCount);
  float gvX = fract(finalAngle * cablesCount) - 0.5;

  float rand = fract(sin(cableID * 12.9898) * 43758.5453);
  float randSpeed = (0.4 + rand * 0.6) * speedBase * uPulseSpeed;
  float cableThick = baseThick * (0.6 + rand * 0.4);

  float scroll = depth + iTime * randSpeed;
  float pulseFact = fract(scroll);

  float distToCore = abs(gvX);
  float wireMask = smoothstep(cableThick, cableThick - 0.05, distToCore);
  float rimGlow = smoothstep(borderWeight, 0.0, abs(distToCore - cableThick));

  float pulseThick = cableThick * uPulseWidth;
  float pulseMask = smoothstep(pulseThick, pulseThick - 0.05 * uPulseWidth, distToCore);

  float pulseDist = abs(pulseFact - 0.5);
  float pulseCore = uPulseLength * (1.0 - uPulseBlend);
  float pulseLo = min(pulseCore, uPulseLength - max(fwidth(scroll), 0.0001));
  float dataPulse = 1.0 - smoothstep(pulseLo, uPulseLength, pulseDist);

  float aBody = wireMask * uTunnelOpacity;
  float aRim = rimGlow;
  float aPulse = clamp(dataPulse * pulseMask, 0.0, 1.0);

  vec3 fiberCol = uTunnelColor * aBody
    + uCableColor * aRim * 1.3 * uGlow
    + uPulseColor * dataPulse * 3.0 * pulseMask;

  float distFade = smoothstep(0.0, uFadeNear, r)
    * smoothstep(uFadeFar, uFadeFar - 0.9, r);
  float intensity = clamp(aBody + aRim + aPulse, 0.0, 1.0) * distFade;

  vec3 finalCol = fiberCol * uBrightness;
  float alpha = clamp(intensity, 0.0, 1.0) * uOpacity;
  o = vec4(finalCol * alpha, alpha);
}

void main() {
  vec4 color = vec4(0.0);
  mainImage(color, gl_FragCoord.xy);
  fragColor = color;
}
`;

type NumericUniform = { value: number };
type VectorUniform = { value: Float32Array };

export function MomoLightTunnel({ className = "" }: { className?: string }) {
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
        uSpeed: { value: 0.065 },
        uFlowDir: { value: -1 },
        uPulseSpeed: { value: 1.55 },
        uPulseLength: { value: 0.34 },
        uPulseBlend: { value: 1.2 },
        uPulseWidth: { value: 0.92 },
        uCableCount: { value: 16 },
        uThickness: { value: 0.27 },
        uRimWidth: { value: 0.12 },
        uWaviness: { value: 0.2 },
        uSway: { value: 0.15 },
        uSize: { value: 1.18 },
        uCenter: { value: new Float32Array([0, 0.035]) },
        uMouseOffset: { value: new Float32Array([0, 0]) },
        uGlow: { value: 0.8 },
        uFadeNear: { value: 0.34 },
        uFadeFar: { value: 1.82 },
        uBrightness: { value: 0.82 },
        uOpacity: { value: 0.58 },
        uCableColor: { value: new Float32Array([0.14, 0.135, 0.13]) },
        uPulseColor: { value: new Float32Array([1, 0.333, 0]) },
        uTunnelColor: { value: new Float32Array([0.08, 0.075, 0.07]) },
        uTunnelOpacity: { value: 0.055 },
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
      const mouseOffset = uniforms.uMouseOffset as VectorUniform;

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

      const currentMouse: [number, number] = [0, 0];
      let targetMouse: [number, number] = [0, 0];
      const hasFinePointer = window.matchMedia("(pointer: fine)").matches;

      const onPointerMove = (event: PointerEvent) => {
        if (!hasFinePointer) return;
        targetMouse = [
          (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 0.035,
          (0.5 - event.clientY / Math.max(window.innerHeight, 1)) * 0.035,
        ];
      };

      const loop = (now: number) => {
        const delta = Math.min((now - previousTime) / 1000, 0.05);
        previousTime = now;
        elapsed += delta;
        time.value = elapsed;

        currentMouse[0] += (targetMouse[0] - currentMouse[0]) * 0.045;
        currentMouse[1] += (targetMouse[1] - currentMouse[1]) * 0.045;
        mouseOffset.value[0] = currentMouse[0];
        mouseOffset.value[1] = currentMouse[1];

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

      window.addEventListener("pointermove", onPointerMove, { passive: true });
      document.addEventListener("visibilitychange", onVisibilityChange);
      motionPreference.addEventListener("change", onMotionPreferenceChange);

      resize();
      start();

      return () => {
        stop();
        resizeObserver?.disconnect();
        intersectionObserver?.disconnect();
        window.removeEventListener("pointermove", onPointerMove);
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
