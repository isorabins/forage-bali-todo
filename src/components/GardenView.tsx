import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import type { Task } from '../types'
import { normalizeStatus, WEEK_DATES } from '../types'

interface Props {
  tasks: Task[]
  onOwnerWeekFilter: (owner: string, week: string) => void
}

// ── Seeded PRNG (deterministic — same tree every render) ──────────────────────
class SeededRandom {
  private s: number
  constructor(seed = 42) { this.s = seed }
  next(): number {
    this.s = (this.s * 9301 + 49297) % 233280
    return this.s / 233280
  }
}

// ── Branch color by depth ──────────────────────────────────────────────────────
function getBranchColor(depth: number): string {
  if (depth >= 8) return '#3a2a1a'  // dark trunk
  if (depth >= 6) return '#5a3e28'  // main branches
  if (depth >= 4) return '#7a5a3a'  // secondary
  if (depth >= 2) return '#9a7a5a'  // tertiary/twigs
  return '#b89a7a'                  // tips
}

// ── Milestone weeks (coral flowers) ───────────────────────────────────────────
const MILESTONE_WEEKS = new Set([3, 6, 9, 12])

// ── Leaf cluster at branch tip ─────────────────────────────────────────────────
function drawLeafCluster(
  ctx: CanvasRenderingContext2D,
  rand: SeededRandom,
  x: number, y: number,
  angle: number,
  depth: number,
  count: number,
  opacity: number,
): void {
  for (let i = 0; i < count; i++) {
    const leafAngle = angle + (rand.next() - 0.5) * Math.PI
    const dist = rand.next() * 12 + 4
    const lx = x + Math.cos(leafAngle) * dist
    const ly = y + Math.sin(leafAngle) * dist
    const size = 4 + rand.next() * 6

    const greenness = Math.floor(80 + depth * 20)
    ctx.globalAlpha = opacity * (0.5 + rand.next() * 0.5)
    ctx.fillStyle = `rgb(${60 + depth * 8}, ${greenness + 40}, ${50 + depth * 12})`

    ctx.save()
    ctx.translate(lx, ly)
    ctx.rotate(leafAngle)
    ctx.beginPath()
    ctx.ellipse(0, 0, size * 0.4, size, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    ctx.globalAlpha = 1
  }
}

// ── 5-petal coral flower ───────────────────────────────────────────────────────
function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, size = 5): void {
  ctx.fillStyle = '#c97d60'
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    ctx.beginPath()
    ctx.arc(x + Math.cos(a) * size, y + Math.sin(a) * size, size * 0.6, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#f0c080'
  ctx.beginPath()
  ctx.arc(x, y, size * 0.4, 0, Math.PI * 2)
  ctx.fill()
}

// ── Recursive fractal branch draw ─────────────────────────────────────────────
function drawBranch(
  ctx: CanvasRenderingContext2D,
  rand: SeededRandom,
  x: number, y: number,
  angle: number,
  length: number,
  depth: number,
  displayWeek: number,
  weekIndex: number,
): void {
  if (depth === 0 || length < 2) return

  const wobble = (rand.next() - 0.5) * 0.3
  const endX = x + Math.cos(angle + wobble) * length
  const endY = y + Math.sin(angle + wobble) * length

  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(endX, endY)
  ctx.strokeStyle = getBranchColor(depth)
  ctx.lineWidth = Math.max(0.5, depth * 1.8)
  ctx.lineCap = 'round'
  ctx.stroke()

  // Leaves on shallow branches when week is unlocked
  if (depth <= 3 && weekIndex <= displayWeek) {
    const leafCount = Math.floor(rand.next() * 4) + 2
    const leafOpacity = Math.min(1, (displayWeek - weekIndex + 1) / 3)
    drawLeafCluster(ctx, rand, endX, endY, angle, depth, leafCount, leafOpacity)
  }

  // Coral flowers at milestone weeks (depth <= 2 = near tips)
  if (depth <= 2 && MILESTONE_WEEKS.has(weekIndex) && weekIndex <= displayWeek) {
    drawFlower(ctx, endX, endY, 4 + depth)
  }

  // Recurse: 2-3 child branches
  const splits = depth > 6 && rand.next() > 0.5 ? 3 : 2
  const spread = 0.4 + rand.next() * 0.3

  for (let i = 0; i < splits; i++) {
    const angleOffset = splits === 2
      ? (i === 0 ? -spread : spread)
      : (i - 1) * spread
    const newAngle = angle + angleOffset + (rand.next() - 0.5) * 0.2
    const newLength = length * (0.62 + rand.next() * 0.08)
    const newWeek = Math.min(12, weekIndex + Math.ceil(12 / Math.pow(2, depth - 1)))
    drawBranch(ctx, rand, endX, endY, newAngle, newLength, depth - 1, displayWeek, newWeek)
  }
}

// ── Current week from program start date ──────────────────────────────────────
function computeActualWeek(): number {
  const now = new Date()
  const weekOneStart = new Date('2026-02-24')
  const diffDays = Math.floor((now.getTime() - weekOneStart.getTime()) / 86_400_000)
  if (diffDays < 0) return 1
  return Math.max(1, Math.min(12, Math.floor(diffDays / 7) + 1))
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function GardenView({ tasks, onOwnerWeekFilter }: Props) {
  const actualWeek = useMemo(() => computeActualWeek(), [])

  const [previewWeek, setPreviewWeekState] = useState(actualWeek)
  const previewWeekRef = useRef(actualWeek)
  const setPreviewWeek = useCallback((w: number) => {
    previewWeekRef.current = w
    setPreviewWeekState(w)
  }, [])

  const [isDragging, setIsDragging] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  const springRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isPlayingRef = useRef(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const displayWeekRef = useRef(actualWeek)

  // ── Draw the full fractal tree onto canvas ─────────────────────────────────
  const drawTree = useCallback((week: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Dark forest background
    ctx.fillStyle = '#0f1a14'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Soft ground shadow
    ctx.save()
    ctx.globalAlpha = 0.25
    ctx.fillStyle = '#1a3020'
    ctx.beginPath()
    ctx.ellipse(canvas.width / 2, canvas.height - 35, canvas.width * 0.18, 8, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    const rand = new SeededRandom(42)
    drawBranch(
      ctx, rand,
      canvas.width / 2,
      canvas.height - 40,
      -Math.PI / 2,
      canvas.height * 0.28,
      9,
      week,
      1,
    )
  }, [])

  // ── Resize handler ─────────────────────────────────────────────────────────
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight
    drawTree(displayWeekRef.current)
  }, [drawTree])

  // ── Initial mount: set canvas size, draw, add resize listener ─────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight
    drawTree(actualWeek)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [actualWeek, drawTree, handleResize])

  // ── Redraw when displayWeek changes ───────────────────────────────────────
  useEffect(() => {
    displayWeekRef.current = previewWeek
    drawTree(previewWeek)
  }, [previewWeek, drawTree])

  // ── Week stats ─────────────────────────────────────────────────────────────
  const weekStats = useMemo(() => {
    const map: Record<string, { done: number; total: number }> = {}
    for (const t of tasks) {
      if (!t.week) continue
      if (!map[t.week]) map[t.week] = { done: 0, total: 0 }
      map[t.week].total++
      if (normalizeStatus(t.status) === 'done') map[t.week].done++
    }
    return map
  }, [tasks])

  const totalDone  = tasks.filter(t => normalizeStatus(t.status) === 'done').length
  const totalCount = tasks.length

  // ── Spring-back: animate previewWeek → actualWeek ─────────────────────────
  const triggerSpringBack = useCallback(() => {
    if (springRef.current) clearTimeout(springRef.current)
    const start = previewWeekRef.current
    const end   = actualWeek
    if (start === end) return
    const steps  = Math.abs(end - start)
    const stepMs = Math.max(40, Math.round(600 / steps))
    const dir    = end > start ? 1 : -1
    let current  = start
    const tick = () => {
      current += dir
      setPreviewWeek(current)
      if (current !== end) springRef.current = setTimeout(tick, stepMs)
    }
    springRef.current = setTimeout(tick, 60)
  }, [actualWeek, setPreviewWeek])

  // ── Slider handlers ────────────────────────────────────────────────────────
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (springRef.current) clearTimeout(springRef.current)
    setIsDragging(true)
    setPreviewWeek(parseInt(e.target.value, 10))
  }
  const handleSliderUp = () => {
    setIsDragging(false)
    triggerSpringBack()
  }

  // ── Play animation ─────────────────────────────────────────────────────────
  const handlePlay = () => {
    if (isPlayingRef.current) {
      isPlayingRef.current = false
      if (playRef.current) clearTimeout(playRef.current)
      setIsPlaying(false)
      triggerSpringBack()
      return
    }
    if (springRef.current) clearTimeout(springRef.current)
    isPlayingRef.current = true
    setIsPlaying(true)
    setPreviewWeek(1)
    let wk = 1
    const step = () => {
      wk++
      setPreviewWeek(wk)
      if (wk < 12 && isPlayingRef.current) {
        playRef.current = setTimeout(step, 700)
      } else {
        isPlayingRef.current = false
        setIsPlaying(false)
        setTimeout(() => triggerSpringBack(), 1000)
      }
    }
    playRef.current = setTimeout(step, 700)
  }

  const handleReset = () => {
    isPlayingRef.current = false
    if (playRef.current) clearTimeout(playRef.current)
    if (springRef.current) clearTimeout(springRef.current)
    setIsPlaying(false)
    setIsDragging(false)
    setPreviewWeek(actualWeek)
  }

  useEffect(() => () => {
    if (springRef.current) clearTimeout(springRef.current)
    if (playRef.current) clearTimeout(playRef.current)
  }, [])

  const currentDateRange  = WEEK_DATES[`Week ${previewWeek}`] || ''
  const currentWeekStats  = weekStats[`Week ${previewWeek}`] || { done: 0, total: 0 }

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100vh',
      overflow: 'hidden',
      background: '#0f1a14',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* Slider thumb style */}
      <style>{`
        .scrubber-range {
          -webkit-appearance: none;
          width: 100%;
          height: 3px;
          background: rgba(255,255,255,0.15);
          border-radius: 2px;
          outline: none;
          cursor: pointer;
        }
        .scrubber-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px; height: 16px;
          border-radius: 50%;
          background: #c97d60;
          cursor: pointer;
          box-shadow: 0 1px 6px rgba(201,125,96,0.55);
          transition: transform 0.15s;
        }
        .scrubber-range::-webkit-slider-thumb:hover { transform: scale(1.25); }
        .scrubber-range::-moz-range-thumb {
          width: 16px; height: 16px;
          border-radius: 50%;
          background: #c97d60;
          cursor: pointer;
          border: none;
          box-shadow: 0 1px 6px rgba(201,125,96,0.55);
        }
        .scrub-btn {
          background: none; border: none;
          cursor: pointer; padding: 4px 10px;
          color: rgba(255,255,255,0.45);
          font-size: 12px;
          font-family: 'Inter', system-ui, sans-serif;
          letter-spacing: 0.03em; border-radius: 4px;
          transition: color 0.15s;
        }
        .scrub-btn:hover { color: rgba(255,255,255,0.85); }
        .scrub-btn.playing { color: #c97d60; }
      `}</style>

      {/* ── Canvas — fills entire viewport ─────────────────────────────────── */}
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          position: 'absolute',
          top: 0, left: 0,
          width: '100%',
          height: '100%',
        }}
      />

      {/* ── Summary — top center ───────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 20, left: '50%',
        transform: 'translateX(-50%)',
        color: 'rgba(255,255,255,0.6)',
        fontSize: 13,
        fontFamily: "'Inter', system-ui, sans-serif",
        background: 'rgba(0,0,0,0.3)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding: '6px 16px',
        borderRadius: 20,
        whiteSpace: 'nowrap',
        zIndex: 10,
        pointerEvents: 'none',
        letterSpacing: '0.03em',
      }}>
        {totalDone} of {totalCount || 220} tasks complete
      </div>

      {/* ── Time Scrubber — bottom center ─────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(560px, 90vw)',
        background: 'rgba(15,26,20,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: 20,
        padding: '12px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        border: '1px solid rgba(255,255,255,0.1)',
        zIndex: 50,
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      }}>
        {/* Label row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 10, minHeight: 18,
        }}>
          {isDragging && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>
              Preview — release to return
            </span>
          )}
          <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.75)' }}>
            Week {previewWeek}{currentDateRange ? ` · ${currentDateRange}` : ''}
          </span>
          {currentWeekStats.total > 0 && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
              {currentWeekStats.done}/{currentWeekStats.total} done
            </span>
          )}
          {previewWeek === actualWeek && !isDragging && !isPlaying && (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
              current
            </span>
          )}
        </div>

        {/* Slider row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>
            Wk 1
          </span>
          <input
            type="range" min={1} max={12} value={previewWeek}
            className="scrubber-range"
            onChange={handleSliderChange}
            onMouseUp={handleSliderUp}
            onTouchEnd={handleSliderUp}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>
            Wk 12
          </span>
        </div>

        {/* Button row */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
          <button className={`scrub-btn${isPlaying ? ' playing' : ''}`} onClick={handlePlay}>
            {isPlaying ? '■ Stop' : '▶ Play'}
          </button>
          <button className="scrub-btn" onClick={handleReset}>⏮ Reset</button>
          <button
            className="scrub-btn"
            onClick={() => onOwnerWeekFilter('All', `Week ${previewWeek}`)}
            style={{ color: '#c97d60', fontWeight: 500 }}
          >
            View tasks →
          </button>
        </div>
      </div>
    </div>
  )
}
