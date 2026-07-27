"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

/**
 * Звуковая линия первого экрана — исходный WebGL-шейдер (three.js), с четырьмя
 * отличиями под наш случай:
 *   • вписан в свой контейнер (absolute inset-0), а не fixed на весь экран,
 *     иначе холст лёг бы позади всей страницы;
 *   • «чёрное на белом»: фон белый, а свечение вычитается из белого
 *     (gl_FragColor = 1 - цвет) — это светлый вариант оригинала;
 *   • цвет сведён в серую шкалу, чтобы линия была чёрной, а не радужной;
 *   • при prefers-reduced-motion рисуется один статичный кадр без цикла,
 *     а кадровый цикл вообще не крутится, пока первый экран не на виду.
 */
export function WebGLShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const vertexShader = `
      attribute vec3 position;
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `

    const fragmentShader = `
      precision highp float;
      uniform vec2 resolution;
      uniform float time;
      uniform float xScale;
      uniform float yScale;
      uniform float distortion;

      void main() {
        vec2 p = (gl_FragCoord.xy * 2.0 - resolution) / min(resolution.x, resolution.y);

        float d = length(p) * distortion;

        float rx = p.x * (1.0 + d);
        float gx = p.x;
        float bx = p.x * (1.0 - d);

        float r = 0.05 / abs(p.y + sin((rx + time) * xScale) * yScale);
        float g = 0.05 / abs(p.y + sin((gx + time) * xScale) * yScale);
        float b = 0.05 / abs(p.y + sin((bx + time) * xScale) * yScale);

        // Чёрное на белом: свечение сводим в серую шкалу и вычитаем из белого,
        // поэтому яркая линия становится чёрной, а фон остаётся белым.
        float v = (r + g + b) / 3.0;
        gl_FragColor = vec4(vec3(1.0 - v), 1.0);
      }
    `

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(new THREE.Color(0xffffff))

    const scene = new THREE.Scene()
    // RawShaderMaterial выводит позицию напрямую, камера в расчёт не идёт —
    // оставлена как в оригинале, чтобы не трогать рабочий проход.
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, -1)

    const uniforms = {
      resolution: { value: [1, 1] as [number, number] },
      time: { value: 0.0 },
      xScale: { value: 1.0 },
      yScale: { value: 0.5 },
      distortion: { value: 0.05 },
    }

    const position = [
      -1.0, -1.0, 0.0,
       1.0, -1.0, 0.0,
      -1.0,  1.0, 0.0,
       1.0, -1.0, 0.0,
      -1.0,  1.0, 0.0,
       1.0,  1.0, 0.0,
    ]
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(position), 3)
    )

    const material = new THREE.RawShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    const renderFrame = () => renderer.render(scene, camera)

    // Размер берём от контейнера, а не от окна: холст занимает первый экран.
    const resize = () => {
      const w = canvas.clientWidth || 1
      const h = canvas.clientHeight || 1
      const pr = renderer.getPixelRatio()
      renderer.setSize(w, h, false)
      uniforms.resolution.value = [w * pr, h * pr]
    }
    resize()
    renderFrame() // первый кадр рисуем всегда — линия видна и при reduced-motion

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    let rafId = 0
    let running = false
    const animate = () => {
      uniforms.time.value += 0.01
      renderFrame()
      rafId = requestAnimationFrame(animate)
    }
    const start = () => {
      if (running || reduce) return
      running = true
      rafId = requestAnimationFrame(animate)
    }
    const stop = () => {
      running = false
      if (rafId) cancelAnimationFrame(rafId)
      rafId = 0
    }

    // Кадровый цикл крутится только пока первый экран на виду — уехал за сгиб,
    // холст перестаёт нагружать видеокарту.
    const io = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? start() : stop()),
      { threshold: 0 }
    )
    io.observe(canvas)

    const ro = new ResizeObserver(() => {
      resize()
      renderFrame()
    })
    ro.observe(canvas)

    return () => {
      stop()
      io.disconnect()
      ro.disconnect()
      geometry.dispose()
      material.dispose()
      renderer.dispose()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 block h-full w-full"
    />
  )
}
