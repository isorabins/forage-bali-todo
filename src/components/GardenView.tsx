import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import type { Task } from '../types'
import { normalizeStatus, WEEK_DATES } from '../types'

interface Props {
  tasks: Task[]
  onOwnerWeekFilter: (owner: string, week: string) => void
}

const W = 1000
const H = 780
const CX = W / 2
const CY = H - 60   // root at bottom center

const MILESTONES: Record<number, string> = {
  3: 'Roots down', 6: 'Bookings live', 9: 'First foragers', 12: 'Full season',
}

// Leaf color by week progress — dark green (trunk) → fresh green (tips)
function leafColor(week: number, done: boolean): string {
  const t = (week - 1) / 11
  // Interpolate from deep forest to bright canopy
  const r = Math.round(40  + t * 30)
  const g = Math.round(90  + t * 80)
  const b = Math.round(45  + t * 20)
  const alpha = done ? 0.92 : 0.65
  return `rgba(${r},${g},${b},${alpha})`
}

// Seeded PRNG
function seeded(n: number) {
  let s = (n * 9301 + 49297) % 233280
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
}

interface LeafPos {
  x: number; y: number
  rx: number; ry: number   // ellipse radii
  rotation: number          // degrees
  week: number
  done: boolean
  title: string
}

function computeLeaves(tasks: Task[]): LeafPos[] {
  // Sort tasks by week then by creation order
  const sorted = [...tasks].sort((a, b) => {
    const wa = parseInt((a.week || 'Week 0').replace(/\D/g,'')) || 0
    const wb = parseInt((b.week || 'Week 0').replace(/\D/g,'')) || 0
    return wa - wb
  })

  // Group by week
  const byWeek: Record<number, Task[]> = {}
  for (const t of sorted) {
    const w = parseInt((t.week || 'Week 0').replace(/\D/g,'')) || 0
    if (w < 1 || w > 12) continue
    if (!byWeek[w]) byWeek[w] = []
    byWeek[w].push(t)
  }

  const leaves: LeafPos[] = []

  for (let w = 1; w <= 12; w++) {
    const wTasks = byWeek[w] || []
    const n = wTasks.length
    if (n === 0) continue

    const progress = (w - 1) / 11   // 0 → 1

    // Bush geometry: trunk at bottom, canopy at top
    const baseRadius  = 60  + progress * 310   // 60 → 370px from root
    const halfSpread  = (25 + progress * 65) * (Math.PI / 180)  // ±25° → ±90°

    for (let i = 0; i < n; i++) {
      const rng = seeded(w * 1000 + i)

      // Angle: centered on straight up (π/2), spreading by week
      const spreadFraction = n > 1 ? (i / (n - 1)) - 0.5 : 0
      const angle = Math.PI / 2 + spreadFraction * halfSpread * 2
                  + (rng() - 0.5) * 0.18   // small jitter

      // Radius: base + some jitter, with slight inward pull for early weeks
      const r = baseRadius * (0.85 + rng() * 0.3)

      const x = CX + Math.cos(angle) * r
      const y = CY - Math.sin(angle) * r

      // Leaf shape: small pill, tilted along branch direction
      const rx = 18 + rng() * 8
      const ry = 7  + rng() * 3
      const rotation = (Math.PI / 2 - angle) * (180 / Math.PI)
                     + (rng() - 0.5) * 25   // ±12.5° extra variation

      const t = wTasks[i]
      leaves.push({
        x: Math.round(x),
        y: Math.round(y),
        rx, ry,
        rotation,
        week: w,
        done: normalizeStatus(t.status) === 'done',
        title: t.title,
      })
    }
  }

  return leaves
}

function computeActualWeek(): number {
  const now   = new Date()
  const start = new Date('2026-02-24')
  const diff  = Math.floor((now.getTime() - start.getTime()) / 86_400_000)
  if (diff < 0) return 1
  return Math.max(1, Math.min(12, Math.floor(diff / 7) + 1))
}

export function GardenView({ tasks, onOwnerWeekFilter }: Props) {
  const actualWeek = useMemo(() => computeActualWeek(), [])

  const [previewWeek, setPreviewWeekState] = useState(actualWeek)
  const previewWeekRef = useRef(actualWeek)
  const setPreviewWeek = useCallback((w: number) => {
    previewWeekRef.current = w
    setPreviewWeekState(w)
  }, [])

  const [isDragging, setIsDragging] = useState(false)
  const [isPlaying, setIsPlaying]   = useState(false)
  const [mounted, setMounted]       = useState(false)

  const springRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isPlayingRef = useRef(false)

  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t) }, [])

  const triggerSpringBack = useCallback(() => {
    if (springRef.current) clearTimeout(springRef.current)
    const start = previewWeekRef.current; const end = actualWeek
    if (start === end) return
    const dir = end > start ? 1 : -1
    const ms  = Math.max(50, Math.round(500 / Math.abs(end - start)))
    let cur   = start
    const tick = () => { cur += dir; setPreviewWeek(cur); if (cur !== end) springRef.current = setTimeout(tick, ms) }
    springRef.current = setTimeout(tick, 60)
  }, [actualWeek, setPreviewWeek])

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (springRef.current) clearTimeout(springRef.current)
    setIsDragging(true); setPreviewWeek(parseInt(e.target.value, 10))
  }
  const handleSliderUp = () => { setIsDragging(false); triggerSpringBack() }

  const handlePlay = () => {
    if (isPlayingRef.current) {
      isPlayingRef.current = false; if (playRef.current) clearTimeout(playRef.current)
      setIsPlaying(false); triggerSpringBack(); return
    }
    if (springRef.current) clearTimeout(springRef.current)
    isPlayingRef.current = true; setIsPlaying(true); setPreviewWeek(1)
    let wk = 1
    const step = () => {
      wk++; setPreviewWeek(wk)
      if (wk < 12 && isPlayingRef.current) { playRef.current = setTimeout(step, 700) }
      else { isPlayingRef.current = false; setIsPlaying(false); setTimeout(() => triggerSpringBack(), 1200) }
    }
    playRef.current = setTimeout(step, 700)
  }

  const handleReset = () => {
    isPlayingRef.current = false
    if (playRef.current) clearTimeout(playRef.current)
    if (springRef.current) clearTimeout(springRef.current)
    setIsPlaying(false); setIsDragging(false); setPreviewWeek(actualWeek)
  }

  useEffect(() => () => {
    if (springRef.current) clearTimeout(springRef.current)
    if (playRef.current)   clearTimeout(playRef.current)
  }, [])

  // Compute leaf positions from actual task data
  const leaves = useMemo(() => computeLeaves(tasks), [tasks])

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
  const totalTasks = tasks.length || 220

  const displayWeek      = previewWeek
  const currentDateRange = WEEK_DATES[`Week ${displayWeek}`] || ''
  const currentStats     = weekStats[`Week ${displayWeek}`] || { done: 0, total: 0 }

  const summaryText = totalDone === 0
    ? 'The garden is bare — tasks will grow here'
    : `${totalDone} of ${totalTasks} leaves unfurled`

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100vh',
      overflow: 'hidden', background: '#0d1a0a',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <style>{`
        @keyframes leafIn {
          0%   { opacity: 0; transform: scale(0) rotate(var(--rot, 0deg)); }
          70%  { opacity: 1; transform: scale(1.15) rotate(var(--rot, 0deg)); }
          100% { opacity: 1; transform: scale(1) rotate(var(--rot, 0deg)); }
        }
        .leaf-bloom {
          animation: leafIn 0.45s cubic-bezier(0.34, 1.4, 0.64, 1) both;
          transform-box: fill-box; transform-origin: center;
        }
        .scrubber-range {
          -webkit-appearance: none; width: 100%; height: 1px;
          background: rgba(100,160,80,0.22); border-radius: 1px;
          outline: none; cursor: pointer;
        }
        .scrubber-range::-webkit-slider-thumb {
          -webkit-appearance: none; width: 13px; height: 13px;
          border-radius: 50%; background: rgba(140,200,110,0.9);
          cursor: pointer; box-shadow: 0 0 7px rgba(120,190,90,0.5);
          transition: transform 0.15s;
        }
        .scrubber-range::-webkit-slider-thumb:hover { transform: scale(1.3); }
        .scrubber-range::-moz-range-thumb {
          width: 13px; height: 13px; border-radius: 50%;
          background: rgba(140,200,110,0.9); border: none; cursor: pointer;
        }
        .scrub-btn {
          background: none; border: none; cursor: pointer; padding: 3px 12px;
          color: rgba(120,170,90,0.45); font-size: 11px;
          font-family: 'Inter', system-ui, sans-serif;
          letter-spacing: 0.06em; border-radius: 4px; transition: color 0.15s;
        }
        .scrub-btn:hover { color: rgba(150,210,110,0.85); }
        .scrub-btn.playing { color: rgba(200,130,70,0.8); }
      `}</style>

      {/* Summary */}
      <div style={{
        position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(8,20,6,0.65)', backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(80,140,60,0.15)',
        borderRadius: 20, padding: '6px 22px',
        fontSize: 12, color: 'rgba(130,190,100,0.6)',
        letterSpacing: '0.07em', whiteSpace: 'nowrap',
        zIndex: 10, pointerEvents: 'none',
      }}>
        {summaryText}
      </div>

      {/* SVG */}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100vh"
        preserveAspectRatio="xMidYMax meet" style={{ display: 'block' }}>

        <defs>
          <filter id="lg" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="mg" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.2" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <radialGradient id="bg" cx="50%" cy="90%" r="70%">
            <stop offset="0%" stopColor="#132010"/>
            <stop offset="100%" stopColor="#080e06"/>
          </radialGradient>
        </defs>

        <rect width={W} height={H} fill="url(#bg)"/>

        {/* Ground glow */}
        <ellipse cx={CX} cy={CY} rx={180} ry={28}
          fill="#1a3a14" opacity={0.45} style={{ filter: 'blur(16px)' }}/>

        {/* Root dot */}
        <circle cx={CX} cy={CY} r={5} fill="#4a8a3a" opacity={0.8} filter="url(#lg)"/>

        {/* Trunk line — thin, grows upward as weeks increase */}
        {displayWeek >= 1 && (() => {
          const trunkH = 40 + ((displayWeek - 1) / 11) * 140
          return (
            <line x1={CX} y1={CY} x2={CX} y2={CY - trunkH}
              stroke="#3a5a2a" strokeWidth={displayWeek >= 6 ? 3 : 2}
              strokeLinecap="round" opacity={0.5}
              style={{ transition: 'all 0.5s ease' }}/>
          )
        })()}

        {/* Leaves */}
        {leaves.map((lf, i) => {
          if (lf.week > displayWeek) return null
          const isCurrent = lf.week === displayWeek
          const age       = displayWeek - lf.week
          const opacity   = isCurrent ? 1 : Math.max(0.4, 0.9 - age * 0.04)
          const fill      = leafColor(lf.week, lf.done)
          const filter    = isCurrent ? 'url(#mg)' : undefined

          return (
            <ellipse
              key={i}
              cx={lf.x} cy={lf.y}
              rx={lf.rx} ry={lf.ry}
              fill={fill}
              opacity={opacity}
              transform={`rotate(${lf.rotation}, ${lf.x}, ${lf.y})`}
              filter={filter}
              className={isCurrent && mounted ? 'leaf-bloom' : undefined}
              style={{ transition: 'opacity 0.4s ease', cursor: 'pointer' }}
              onClick={() => onOwnerWeekFilter('All', `Week ${lf.week}`)}
            >
              <title>{lf.title}</title>
            </ellipse>
          )
        })}

        {/* Milestone labels — appear at the outer edge of each milestone week's cluster */}
        {Object.entries(MILESTONES).map(([wStr, label]) => {
          const w = parseInt(wStr)
          if (w > displayWeek) return null
          const progress  = (w - 1) / 11
          const labelY    = CY - (60 + progress * 310) * 1.1 - 16
          const isNow     = w === displayWeek
          const alpha     = isNow ? 0.95 : 0.45
          return (
            <text key={w}
              x={CX} y={labelY}
              textAnchor="middle"
              fill={`rgba(210,180,110,${alpha})`}
              fontSize={isNow ? 13 : 11}
              fontWeight={isNow ? 600 : 400}
              fontFamily="'Inter', system-ui, sans-serif"
              letterSpacing="0.06em"
              style={{ userSelect: 'none', pointerEvents: 'none', transition: 'all 0.4s ease' }}
            >
              {label}
            </text>
          )
        })}
      </svg>

      {/* Scrubber */}
      <div style={{
        position: 'absolute', bottom: 22, left: '50%', transform: 'translateX(-50%)',
        width: 'min(520px, 88vw)',
        background: 'rgba(5, 12, 4, 0.82)', backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: '1px solid rgba(80,140,60,0.18)',
        borderRadius: 18, padding: '12px 22px',
        zIndex: 50, boxShadow: '0 4px 40px rgba(0,0,0,0.7)',
      }}>
        <div style={{
          textAlign: 'center', marginBottom: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          {isDragging && <span style={{ fontSize: 10, color: 'rgba(120,170,90,0.3)', fontStyle: 'italic' }}>preview</span>}
          <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(150,210,110,0.85)', letterSpacing: '0.04em' }}>
            Week {displayWeek}{currentDateRange ? ` · ${currentDateRange}` : ''}
            {MILESTONES[displayWeek] && (
              <span style={{ color: 'rgba(210,170,80,0.85)', marginLeft: 8 }}>· {MILESTONES[displayWeek]}</span>
            )}
          </span>
          {currentStats.total > 0 && (
            <span style={{ fontSize: 10, color: 'rgba(120,170,90,0.38)' }}>
              {currentStats.done}/{currentStats.total}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 10, color: 'rgba(100,150,80,0.3)', whiteSpace: 'nowrap' }}>W1</span>
          <input type="range" min={1} max={12} value={displayWeek}
            className="scrubber-range"
            onChange={handleSliderChange} onMouseUp={handleSliderUp} onTouchEnd={handleSliderUp}
            style={{ flex: 1 }}/>
          <span style={{ fontSize: 10, color: 'rgba(100,150,80,0.3)', whiteSpace: 'nowrap' }}>W12</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 8 }}>
          <button className={`scrub-btn${isPlaying ? ' playing' : ''}`} onClick={handlePlay}>
            {isPlaying ? '■ stop' : '▶ play'}
          </button>
          <button className="scrub-btn" onClick={handleReset}>⏮ reset</button>
          <button className="scrub-btn" onClick={() => onOwnerWeekFilter('All', `Week ${displayWeek}`)}
            style={{ color: 'rgba(200,130,70,0.45)' }}>
            view tasks
          </button>
        </div>
      </div>
    </div>
  )
}
