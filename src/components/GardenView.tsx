import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import type { Task } from '../types'
import { normalizeStatus, WEEK_DATES } from '../types'

interface Props {
  tasks: Task[]
  onOwnerWeekFilter: (owner: string, week: string) => void
}

// ── Seeded PRNG ────────────────────────────────────────────────────────────────
class SeededRandom {
  private seed: number
  constructor(seed: number) { this.seed = seed }
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280
    return this.seed / 233280
  }
}

// ── Canvas constants ───────────────────────────────────────────────────────────
const W = 1000
const H = 760
const STARS_PER_WEEK = 9

// ── Milestone labels ───────────────────────────────────────────────────────────
const MILESTONES: Record<number, string> = {
  3:  'Roots down',
  6:  'Bookings live',
  9:  'First foragers',
  12: 'Full season',
}

// ── Accomplishment labels per week ────────────────────────────────────────────
const WEEK_LABELS: Record<number, string[]> = {
  1:  ['Website designed', 'Domain live'],
  2:  ['Booking system set up', 'Guide contract drafted'],
  3:  ['Payments ready', 'Legal done'],
  4:  ['WhatsApp automation', 'Content calendar'],
  5:  ['Bokun integrated', 'Pricing final'],
  6:  ['Booking page live', 'First signups'],
  7:  ['SEO content out', 'Partnerships'],
  8:  ['Founding foragers invited', 'Pre-launch done'],
  9:  ['Apr 6 — class 1', 'Apr 13 — class 2', 'Apr 20 — class 3'],
  10: ['Apr 24 — first paid', 'Feedback in'],
  11: ['Operations smooth', 'Reviews growing'],
  12: ['Full season live', 'Revenue flowing'],
}

// ── Star ───────────────────────────────────────────────────────────────────────
interface Star {
  x: number
  y: number
  r: number
  week: number
  isMilestone: boolean
  label?: string
  labelAnchor: 'left' | 'right'
}

// ── Connection ─────────────────────────────────────────────────────────────────
interface Connection {
  x1: number; y1: number
  x2: number; y2: number
  week: number
  len: number
}

// ── Generate stars scattered across canvas ────────────────────────────────────
function buildConstellation(): { stars: Star[]; connections: Connection[] } {
  const rand = new SeededRandom(77)

  // Divide canvas into a loose vertical band per week
  // Week 1 seeds at bottom, Week 12 at top — with horizontal scatter
  const stars: Star[] = []

  for (let w = 1; w <= 12; w++) {
    const isMilestoneWeek = w in MILESTONES
    const weekLabels = [...(WEEK_LABELS[w] || [])]
    const labelSlots = [1, 4, 7]  // which star indices get a label

    for (let i = 0; i < STARS_PER_WEEK; i++) {
      const t       = (w - 1) / 11
      const yBase   = H * 0.88 - t * H * 0.76
      const xBase   = W * 0.12 + rand.next() * W * 0.76
      const yJitter = (rand.next() - 0.5) * H * 0.14
      const x = Math.round(xBase)
      const y = Math.round(Math.max(30, Math.min(H - 20, yBase + yJitter)))

      const isMilestone = isMilestoneWeek && i === 0
      const r = isMilestone ? 2.8 + rand.next() * 0.8 : 0.8 + rand.next() * 2.2

      const slotIdx = labelSlots.indexOf(i)
      const label   = slotIdx !== -1 ? weekLabels[slotIdx] : undefined
      const anchor: 'left' | 'right' = x > W / 2 ? 'left' : 'right'

      stars.push({ x, y, r, week: w, isMilestone, label, labelAnchor: anchor })
    }
  }

  // ── Build connections — each star connects to its 2 nearest already-unlocked peers
  const connections: Connection[] = []

  for (let i = 0; i < stars.length; i++) {
    const a = stars[i]

    // Find closest stars from same or earlier week (up to 2 connections)
    const candidates = stars
      .map((b, j) => ({ j, dx: b.x - a.x, dy: b.y - a.y, week: b.week }))
      .filter(c => c.j !== i && c.week <= a.week)
      .map(c => ({ ...c, dist: Math.hypot(c.dx, c.dy) }))
      .sort((c1, c2) => c1.dist - c2.dist)
      .slice(0, 2)

    for (const c of candidates) {
      const b = stars[c.j]
      const alreadyAdded = connections.some(
        con => (con.x1 === a.x && con.y1 === a.y && con.x2 === b.x && con.y2 === b.y) ||
               (con.x1 === b.x && con.y1 === b.y && con.x2 === a.x && con.y2 === a.y),
      )
      if (!alreadyAdded) {
        connections.push({
          x1: a.x, y1: a.y,
          x2: b.x, y2: b.y,
          week: a.week,
          len: Math.round(Math.hypot(c.dx, c.dy)),
        })
      }
    }
  }

  return { stars, connections }
}

// ── Compute actual current week ────────────────────────────────────────────────
function computeActualWeek(): number {
  const now = new Date()
  const start = new Date('2026-02-24')
  const diff = Math.floor((now.getTime() - start.getTime()) / 86_400_000)
  if (diff < 0) return 1
  return Math.max(1, Math.min(12, Math.floor(diff / 7) + 1))
}

// ── Pre-build (once, module-level) ────────────────────────────────────────────
const { stars: ALL_STARS, connections: ALL_CONNECTIONS } = buildConstellation()

// ── Component ─────────────────────────────────────────────────────────────────
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
  const [mounted, setMounted] = useState(false)

  const springRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isPlayingRef = useRef(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 120)
    return () => clearTimeout(t)
  }, [])

  // Spring back to actualWeek
  const triggerSpringBack = useCallback(() => {
    if (springRef.current) clearTimeout(springRef.current)
    const start = previewWeekRef.current
    const end = actualWeek
    if (start === end) return
    const dir = end > start ? 1 : -1
    const steps = Math.abs(end - start)
    const stepMs = Math.max(50, Math.round(600 / steps))
    let cur = start
    const tick = () => {
      cur += dir
      setPreviewWeek(cur)
      if (cur !== end) springRef.current = setTimeout(tick, stepMs)
    }
    springRef.current = setTimeout(tick, 80)
  }, [actualWeek, setPreviewWeek])

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (springRef.current) clearTimeout(springRef.current)
    setIsDragging(true)
    setPreviewWeek(parseInt(e.target.value, 10))
  }
  const handleSliderUp = () => {
    setIsDragging(false)
    triggerSpringBack()
  }

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
        playRef.current = setTimeout(step, 750)
      } else {
        isPlayingRef.current = false
        setIsPlaying(false)
        setTimeout(() => triggerSpringBack(), 1400)
      }
    }
    playRef.current = setTimeout(step, 750)
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
    if (playRef.current)   clearTimeout(playRef.current)
  }, [])

  // Week stats
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

  const displayWeek = previewWeek
  const currentDateRange  = WEEK_DATES[`Week ${displayWeek}`] || ''
  const currentWeekStats  = weekStats[`Week ${displayWeek}`] || { done: 0, total: 0 }

  const summaryText = useMemo(() => {
    if (totalDone >= totalTasks) return 'All constellations mapped'
    if (totalDone === 0) return 'The sky is dark — stars await'
    const pct = Math.round((totalDone / totalTasks) * 100)
    return `${pct}% charted — ${totalDone} of ${totalTasks} tasks complete`
  }, [totalDone, totalTasks])

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100vh',
      overflow: 'hidden',
      background: '#080b10',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <style>{`
        @keyframes starAppear {
          from { opacity: 0; transform: scale(0); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes labelFade {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .star-enter {
          animation: starAppear 0.5s cubic-bezier(0.34, 1.4, 0.64, 1) both;
          transform-box: fill-box;
          transform-origin: center;
        }
        .milestone-label {
          animation: labelFade 0.6s 0.3s ease both;
        }
        .scrubber-range {
          -webkit-appearance: none;
          width: 100%;
          height: 1px;
          background: rgba(180,190,210,0.18);
          border-radius: 1px;
          outline: none;
          cursor: pointer;
        }
        .scrubber-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 13px; height: 13px;
          border-radius: 50%;
          background: rgba(210,220,240,0.9);
          cursor: pointer;
          box-shadow: 0 0 8px rgba(180,200,240,0.6), 0 0 2px rgba(180,200,240,1);
          transition: transform 0.15s;
        }
        .scrubber-range::-webkit-slider-thumb:hover { transform: scale(1.3); }
        .scrubber-range::-moz-range-thumb {
          width: 13px; height: 13px;
          border-radius: 50%;
          background: rgba(210,220,240,0.9);
          border: none;
          cursor: pointer;
        }
        .scrub-btn {
          background: none; border: none;
          cursor: pointer; padding: 3px 12px;
          color: rgba(160,170,200,0.4);
          font-size: 11px;
          font-family: 'Inter', system-ui, sans-serif;
          letter-spacing: 0.07em; border-radius: 4px;
          transition: color 0.15s;
        }
        .scrub-btn:hover { color: rgba(200,210,240,0.85); }
        .scrub-btn.playing { color: rgba(210,150,100,0.8); }
      `}</style>

      {/* ── Summary — top center ─────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 20, left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(8,11,16,0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(160,170,210,0.1)',
        borderRadius: 20,
        padding: '6px 22px',
        fontSize: 12,
        color: 'rgba(170,180,210,0.55)',
        letterSpacing: '0.07em',
        whiteSpace: 'nowrap',
        zIndex: 10,
        pointerEvents: 'none',
      }}>
        {summaryText}
      </div>

      {/* ── Constellation SVG ────────────────────────────────────────────────── */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100vh"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block' }}
      >
        <defs>
          {/* Star glow */}
          <filter id="starGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Milestone star — stronger glow */}
          <filter id="milestoneGlow" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Deep space bg gradient */}
          <radialGradient id="spaceBg" cx="50%" cy="45%" r="60%">
            <stop offset="0%"   stopColor="#0d1220" stopOpacity="1" />
            <stop offset="100%" stopColor="#050810" stopOpacity="1" />
          </radialGradient>
        </defs>

        {/* Background */}
        <rect width={W} height={H} fill="url(#spaceBg)" />

        {/* Very faint background star-dust — tiny fixed dots */}
        {Array.from({ length: 60 }).map((_, i) => {
          const r2 = new SeededRandom(i * 17 + 3)
          return (
            <circle
              key={`bg${i}`}
              cx={r2.next() * W}
              cy={r2.next() * H}
              r={r2.next() * 0.6 + 0.2}
              fill="white"
              opacity={r2.next() * 0.18 + 0.04}
            />
          )
        })}

        {/* ── Connection lines ─────────────────────────────────────────────── */}
        {ALL_CONNECTIONS.map((con, i) => {
          const visible = con.week <= displayWeek
          if (!visible) return null
          const isCurrent = con.week === displayWeek
          const opacity = isCurrent ? 0.35 : 0.22

          return (
            <line
              key={`con${i}`}
              x1={con.x1} y1={con.y1}
              x2={con.x2} y2={con.y2}
              stroke="rgba(180,190,220,1)"
              strokeWidth={0.5}
              opacity={opacity}
              style={{
                transition: 'opacity 0.5s ease',
                strokeDasharray: con.len,
                strokeDashoffset: mounted && isCurrent ? 0 : (isCurrent ? con.len : 0),
              }}
            />
          )
        })}

        {/* ── Stars ────────────────────────────────────────────────────────── */}
        {ALL_STARS.map((star, i) => {
          const visible = star.week <= displayWeek
          if (!visible) return null
          const isCurrent = star.week === displayWeek

          const fill = star.isMilestone
            ? (isCurrent ? '#e8c090' : '#c8a878')
            : (isCurrent ? '#dde4f0' : '#aab4cc')

          const age        = displayWeek - star.week
          const opacity    = isCurrent ? 1 : Math.max(0.4, 0.85 - age * 0.04)
          const filter     = star.isMilestone ? 'url(#milestoneGlow)' : 'url(#starGlow)'
          const labelOffX  = star.labelAnchor === 'right' ? star.r + 7 : -(star.r + 7)
          const textAnchor = star.labelAnchor === 'right' ? 'start' : 'end'
          const labelAlpha = isCurrent ? 0.9 : Math.max(0.15, 0.6 - age * 0.05)

          return (
            <g key={`star${i}`}>
              <circle
                cx={star.x} cy={star.y}
                r={star.r}
                fill={fill}
                opacity={opacity}
                filter={filter}
                className={isCurrent && mounted ? 'star-enter' : undefined}
                style={{ transition: 'opacity 0.4s ease' }}
              />
              {star.label && (
                <text
                  x={star.x + labelOffX}
                  y={star.y + 4}
                  fill={`rgba(180,190,225,${labelAlpha})`}
                  fontSize={10}
                  fontFamily="'Inter', system-ui, sans-serif"
                  letterSpacing="0.03em"
                  textAnchor={textAnchor}
                  className={isCurrent && mounted ? 'milestone-label' : undefined}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  {star.label}
                </text>
              )}
            </g>
          )
        })}

        {/* ── Milestone labels ─────────────────────────────────────────────── */}
        {Object.entries(MILESTONES).map(([wkStr, label]) => {
          const wk = parseInt(wkStr, 10)
          if (wk > displayWeek) return null

          // Find the anchor star for this milestone
          const anchor = ALL_STARS.find(s => s.week === wk && s.isMilestone)
          if (!anchor) return null

          const isJustReached = wk === displayWeek
          const offsetX = anchor.labelAnchor === 'right' ? anchor.r + 8 : -(anchor.r + 8)
          const textAnchor = anchor.labelAnchor === 'right' ? 'start' : 'end'

          return (
            <g key={`lbl${wk}`} className={isJustReached && mounted ? 'milestone-label' : undefined}>
              {/* Tiny connecting tick */}
              <line
                x1={anchor.x}
                y1={anchor.y - anchor.r - 2}
                x2={anchor.x}
                y2={anchor.y - anchor.r - 10}
                stroke="rgba(200,180,140,0.5)"
                strokeWidth={0.6}
              />
              {/* Week marker */}
              <text
                x={anchor.x + offsetX}
                y={anchor.y - anchor.r - 4}
                fill="rgba(200,180,140,0.9)"
                fontSize={9}
                fontFamily="'Inter', system-ui, sans-serif"
                letterSpacing="0.12em"
                textAnchor={textAnchor}
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                W{wk} —
              </text>
              {/* Milestone name */}
              <text
                x={anchor.x + offsetX}
                y={anchor.y - anchor.r + 8}
                fill="rgba(220,200,160,0.75)"
                fontSize={11}
                fontWeight={500}
                fontFamily="'Inter', system-ui, sans-serif"
                letterSpacing="0.04em"
                textAnchor={textAnchor}
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {label}
              </text>
            </g>
          )
        })}
      </svg>

      {/* ── Time Scrubber ─────────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        bottom: 22,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(520px, 88vw)',
        background: 'rgba(6, 8, 14, 0.78)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: '1px solid rgba(160,170,210,0.12)',
        borderRadius: 18,
        padding: '12px 22px',
        zIndex: 50,
        boxShadow: '0 4px 40px rgba(0,0,0,0.7)',
      }}>
        <div style={{
          textAlign: 'center', marginBottom: 10, minHeight: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          {isDragging && (
            <span style={{ fontSize: 10, color: 'rgba(160,170,200,0.3)', fontStyle: 'italic' }}>
              preview
            </span>
          )}
          <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(190,200,230,0.8)', letterSpacing: '0.04em' }}>
            Week {displayWeek}{currentDateRange ? ` · ${currentDateRange}` : ''}
            {displayWeek in MILESTONES && (
              <span style={{ color: 'rgba(210,170,100,0.8)', marginLeft: 8 }}>
                · {MILESTONES[displayWeek]}
              </span>
            )}
          </span>
          {currentWeekStats.total > 0 && (
            <span style={{ fontSize: 10, color: 'rgba(160,170,200,0.35)' }}>
              {currentWeekStats.done}/{currentWeekStats.total}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 10, color: 'rgba(160,170,200,0.28)', whiteSpace: 'nowrap' }}>W1</span>
          <input
            type="range" min={1} max={12} value={displayWeek}
            className="scrubber-range"
            onChange={handleSliderChange}
            onMouseUp={handleSliderUp}
            onTouchEnd={handleSliderUp}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: 10, color: 'rgba(160,170,200,0.28)', whiteSpace: 'nowrap' }}>W12</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 8 }}>
          <button className={`scrub-btn${isPlaying ? ' playing' : ''}`} onClick={handlePlay}>
            {isPlaying ? '■ stop' : '▶ play'}
          </button>
          <button className="scrub-btn" onClick={handleReset}>⏮ reset</button>
          <button
            className="scrub-btn"
            onClick={() => onOwnerWeekFilter('All', `Week ${displayWeek}`)}
            style={{ color: 'rgba(210,150,100,0.45)' }}
          >
            view tasks
          </button>
        </div>
      </div>
    </div>
  )
}
