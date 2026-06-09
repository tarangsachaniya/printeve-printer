'use client'

import { useEffect, useRef } from 'react'

interface SignatureCanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  onSigned: (v: boolean) => void
}

export function SignatureCanvas({ canvasRef, onSigned }: SignatureCanvasProps) {
  const drawing = useRef(false)

  function getCtx() {
    const canvas = canvasRef.current
    if (!canvas) return null
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.strokeStyle = '#111827'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    return { canvas, ctx }
  }

  function initCanvas() {
    const r = getCtx()
    if (!r) return
    r.ctx.fillStyle = '#ffffff'
    r.ctx.fillRect(0, 0, r.canvas.width, r.canvas.height)
  }

  useEffect(() => { initCanvas() }, [])

  function checkSigned() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    let hasMark = false
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] < 240 || d[i + 1] < 240 || d[i + 2] < 240) { hasMark = true; break }
    }
    onSigned(hasMark)
  }

  function pos(e: React.MouseEvent<HTMLCanvasElement>) {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function posTouch(e: React.TouchEvent<HTMLCanvasElement>) {
    const r = canvasRef.current!.getBoundingClientRect()
    const t = e.touches[0]
    return { x: t.clientX - r.left, y: t.clientY - r.top }
  }

  function start(x: number, y: number) {
    drawing.current = true
    const r = getCtx(); if (!r) return
    r.ctx.beginPath(); r.ctx.moveTo(x, y)
  }

  function move(x: number, y: number) {
    if (!drawing.current) return
    const r = getCtx(); if (!r) return
    r.ctx.lineTo(x, y); r.ctx.stroke()
    checkSigned()
  }

  function stop() { drawing.current = false }

  function clear() { initCanvas(); onSigned(false) }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Draw your signature below
        </p>
        <button
          type="button"
          onClick={clear}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
        >
          Clear
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={600}
        height={180}
        className="w-full rounded-lg border border-input bg-white touch-none cursor-crosshair"
        style={{ height: 180 }}
        onMouseDown={e => { const { x, y } = pos(e); start(x, y) }}
        onMouseMove={e => { const { x, y } = pos(e); move(x, y) }}
        onMouseUp={stop}
        onMouseLeave={stop}
        onTouchStart={e => { e.preventDefault(); const { x, y } = posTouch(e); start(x, y) }}
        onTouchMove={e => { e.preventDefault(); const { x, y } = posTouch(e); move(x, y) }}
        onTouchEnd={stop}
      />
      <p className="text-xs text-muted-foreground">Use mouse or touch to draw your signature</p>
    </div>
  )
}
