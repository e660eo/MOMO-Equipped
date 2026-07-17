"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

/*
  Звуковая линия на WebGL. Отличия от исходного компонента (по просьбе:
  «на белом фоне такая звуковая линия»):
   • фон белый, линия тёмная — цвет во фрагментном шейдере инвертирован;
   • канвас заполняет родителя (absolute + ResizeObserver), а не весь экран,
     чтобы жить внутри hero-секции;
   • уважает prefers-reduced-motion (рендерит один кадр без цикла).
*/
export function WebGLShader({
  className = "",
  variant = "light",
  mono = false,
}: {
  className?: string;
  /** light — тёмная линия на белом; dark — белая линия на чёрном */
  variant?: "light" | "dark";
  /** mono — без хроматики: одна чистая линия */
  mono?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<{
    scene: THREE.Scene | null
    camera: THREE.OrthographicCamera | null
    renderer: THREE.WebGLRenderer | null
    mesh: THREE.Mesh | null
    uniforms: any
    animationId: number | null
  }>({
    scene: null,
    camera: null,
    renderer: null,
    mesh: null,
    uniforms: null,
    animationId: null,
  })

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const parent = canvas.parentElement
    const { current: refs } = sceneRef

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

        ${
          variant === "dark"
            ? "gl_FragColor = vec4(vec3(r, g, b), 1.0); // чёрный фон, светлая линия"
            : "gl_FragColor = vec4(vec3(1.0) - vec3(r, g, b), 1.0); // белый фон, тёмная линия"
        }
      }
    `

    const getSize = () => ({
      width: parent ? parent.clientWidth : window.innerWidth,
      height: parent ? parent.clientHeight : window.innerHeight,
    })

    const initScene = () => {
      refs.scene = new THREE.Scene()
      refs.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
      refs.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      refs.renderer.setClearColor(new THREE.Color(0xffffff))

      refs.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, -1)

      const { width, height } = getSize()
      refs.uniforms = {
        resolution: { value: [width, height] },
        time: { value: 0.0 },
        xScale: { value: 1.0 },
        yScale: { value: 0.5 },
        distortion: { value: mono ? 0.0 : 0.05 },
      }

      const position = [
        -1.0, -1.0, 0.0,
         1.0, -1.0, 0.0,
        -1.0,  1.0, 0.0,
         1.0, -1.0, 0.0,
        -1.0,  1.0, 0.0,
         1.0,  1.0, 0.0,
      ]

      const positions = new THREE.BufferAttribute(new Float32Array(position), 3)
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute("position", positions)

      const material = new THREE.RawShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: refs.uniforms,
        side: THREE.DoubleSide,
      })

      refs.mesh = new THREE.Mesh(geometry, material)
      refs.scene.add(refs.mesh)

      handleResize()
    }

    const renderFrame = () => {
      if (refs.renderer && refs.scene && refs.camera) {
        refs.renderer.render(refs.scene, refs.camera)
      }
    }

    const animate = () => {
      if (refs.uniforms) refs.uniforms.time.value += 0.01
      renderFrame()
      refs.animationId = requestAnimationFrame(animate)
    }

    const handleResize = () => {
      if (!refs.renderer || !refs.uniforms) return
      const { width, height } = getSize()
      refs.renderer.setSize(width, height, false)
      refs.uniforms.resolution.value = [width, height]
    }

    initScene()

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches
    if (reduceMotion) {
      renderFrame()
    } else {
      animate()
    }

    const ro = parent ? new ResizeObserver(handleResize) : null
    ro?.observe(parent as Element)
    window.addEventListener("resize", handleResize)

    return () => {
      if (refs.animationId) cancelAnimationFrame(refs.animationId)
      window.removeEventListener("resize", handleResize)
      ro?.disconnect()
      if (refs.mesh) {
        refs.scene?.remove(refs.mesh)
        refs.mesh.geometry.dispose()
        if (refs.mesh.material instanceof THREE.Material) {
          refs.mesh.material.dispose()
        }
      }
      refs.renderer?.dispose()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 block h-full w-full ${className}`}
    />
  )
}
