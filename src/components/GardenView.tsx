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

// ── Canvas size ────────────────────────────────────────────────────────────────
const W = 1000
const H = 780

// ── Week accomplishments shown at branch tips ─────────────────────────────────
// 2-3 per week; milestone weeks get a special header label
const WEEK_LABELS: Record<number, string[]> = {
  1:  ['Website designed', 'Domain + hosting live'],
  2:  ['Booking system set up', 'Guide contract drafted'],
  3:  ['Payment processing ready', 'Legal structure done'],
  4:  ['WhatsApp automation live', 'Content calendar built'],
  5:  ['Bokun integrated', 'Pricing finalized'],
  6:  ['Booking page live', 'First waitlist signups'],
  7:  ['SEO content published', 'Partnerships reached out'],
  8:  ['Founding foragers invited', 'Pre-launch complete'],
  9:  ['Apr 6 — first free class', 'Apr 13 — second class', 'Apr 20 — third class'],
  10: ['Apr 24 — first paid class', 'Feedback gathered'],
  11: ['Operations rhythm found', 'Reviews coming in'],
  12: ['Full season running', 'Revenue flowing'],
}

const MILESTONES: Record<number, string> = {
  3: 'Roots down',
  6: 'Bookings live',
  9: 'First foragers',
  12: 'Full season',
}

// ── Branch / Node data structures ─────────────────────────────────────────────
interface Branch {
  x1: number; y1: number
  cpx: number; cpy: number
  x2: number; y2: number
  week: number
  depth: number
  len: number
}

interface Node {
  x: number; y: number
  week: number
  depth: number
  label?: string
  isMilestone?: boolean
}

// ── Build mycelium network (seeded, deterministic) ────────────────────────────
function buildMycelium(): { branches: Branch[]; nodes: Node[] } {
  const rand = new SeededRandom(42)
  const branches: Branch[] = []
  const nodes: Node[]     = []

  // Root node
  const root: Node = { x: W / 2, y: H - 28, week: 1, depth: 0 }
  nodes.push(root)

  // Track available endpoints (nodes that can sprout new branches)
  // Each entry: { x, y, week, depth }
  const endpoints: Node[] = [root]

  // Week 1 labels queue
  const labelQueue: Record<number, string[]> = {}
  for (let w = 1; w <= 12; w++) {
    labelQueue[w] = [...(WEEK_LABELS[w] || [])]
    if (MILESTONES[w]) labelQueue[w].unshift('— ' + MILESTONES[w] + ' —')
  }

  function popLabel(week: number): string | undefined {
    return labelQueue[week]?.shift()
  }

  // For each week, grow new branches from existing endpoints
  for (let w = 1; w <= 12; w++) {
    // How many new branches to grow this week (more early on to fan out, slower later)
    const count = w <= 3 ? 5 : w <= 6 ? 4 : w <= 9 ? 3 : 2

    for (let i = 0; i < count; i++) {
      // Pick a random endpoint from recent weeks (prefer newer ones)
      const pool = endpoints.filter(e => e.week >= Math.max(1, w - 2))
      const origin = pool[Math.floor(rand.next() * pool.length)]
      if (!origin) continue

      // Angle: bias strongly upward, fan out more at higher depths
      const baseAngle = 90   // pointing up
      const spread    = 55 + origin.depth * 8
      const angle     = baseAngle + (rand.next() - 0.5) * 2 * spread

      // Length: decreases with depth, some randomness
      const baseLen  = Math.max(35, 110 - origin.depth * 8)
      const len      = baseLen * (0.7 + rand.next() * 0.6)

      const rad = (angle * Math.PI) / 180
      const x2  = Math.max(20, Math.min(W - 20, origin.x + Math.cos(rad) * len))
      const y2  = Math.max(20, Math.min(H - 20, origin.y - Math.sin(rad) * len))

      // Bezier control point: slight organic curve
      const curl = (rand.next() - 0.5) * 30
      const cpx  = (origin.x + x2) / 2 + curl
      const cpy  = (origin.y + y2) / 2 - Math.abs(curl) * 0.4

      branches.push({
        x1: origin.x, y1: origin.y,
        cpx, cpy,
        x2, y2,
        week: w,
        depth: origin.depth + 1,
        len: Math.round(len),
      })

      const newNode: Node = {
        x: x2,
        y: y2,
        week: w,
        depth: origin.depth + 1,
        label: popLabel(w),
        isMilestone: MILESTONES[w] !== undefined && labelQueue[w]?.length === (WEEK_LABELS[w]?.length ?? 0),
      }
      nodes.push(newNode)
      endpoints.push(newNode)
    }
  }

  return { branches, nodes }
}

function computeActualWeek(): number {
  const now   = new Date()
  const start = new Date('2026-02-24')
  const diff  = Math.floor((now.getTime() - start.getTime()) / 86_400_000)
  if (diff < 0) return 1
  return Math.max(1, Math.min(12, Math.floor(diff / 7) + 1))
}

// ── Pre-build once ─────────────────────────────────────────────────────────────
const { branches: ALL_BRANCHES, nodes: ALL_NODES } = buildMycelium()

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
  const [isPlaying, setIsPlaying]   = useState(false)
  const [mounted, setMounted]       = useState(false)

  const springRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isPlayingRef = useRef(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80)
    return () => clearTimeout(t)
  }, [])

  const triggerSpringBack = useCallback(() => {
    if (springRef.current) clearTimeout(springRef.current)
    const start = previewWeekRef.current
    const end   = actualWeek
    if (start === end) return
    const dir   = end > start ? 1 : -1
    const steps = Math.abs(end - start)
    const ms    = Math.max(50, Math.round(600 / steps))
    let cur     = start
    const tick  = () => {
      cur += dir
      setPreviewWeek(cur)
      if (cur !== end) springRef.current = setTimeout(tick, ms)
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
        playRef.current = setTimeout(step, 800)
      } else {
        isPlayingRef.current = false
        setIsPlaying(false)
        setTimeout(() => triggerSpringBack(), 1400)
      }
    }
    playRef.current = setTimeout(step, 800)
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

  // Stats
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

  const displayWeek       = previewWeek
  const currentDateRange  = WEEK_DATES[`Week ${displayWeek}`] || ''
  const currentWeekStats  = weekStats[`Week ${displayWeek}`] || { done: 0, total: 0 }

  const summaryText = useMemo(() => {
    if (totalDone >= totalTasks) return 'Full mycelium — the network is alive'
    if (totalDone === 0)        return 'Spores in the soil — network awakening'
    const pct = Math.round((totalDone / totalTasks) * 100)
    return `${pct}% grown — ${totalDone} of ${totalTasks} complete`
  }, [totalDone, totalTasks])

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100vh',
      overflow: 'hidden', background: '#08100a',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <style>{`
        @keyframes sprout {
          from { stroke-dashoffset: var(--len, 200); opacity: 0; }
          to   { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes nodeAppear {
          from { opacity: 0; r: 0; }
          to   { opacity: 1; }
        }
        @keyframes labelIn {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .branch-new {
          animation: sprout 0.7s cubic-bezier(0.4, 0, 0.2, 1) both;
        }
        .node-new {
          animation: nodeAppear 0.4s 0.5s ease both;
          transform-box: fill-box; transform-origin: center;
        }
        .label-new {
          animation: labelIn 0.5s 0.6s ease both;
        }
        .scrubber-range {
          -webkit-appearance: none; width: 100%;
          height: 1px; background: rgba(120,160,100,0.2);
          border-radius: 1px; outline: none; cursor: pointer;
        }
        .scrubber-range::-webkit-slider-thumb {
          -webkit-appearance: none; width: 13px; height: 13px;
          border-radius: 50%; background: rgba(160,210,140,0.9);
          cursor: pointer; box-shadow: 0 0 8px rgba(140,200,120,0.55);
          transition: transform 0.15s;
        }
        .scrubber-range::-webkit-slider-thumb:hover { transform: scale(1.3); }
        .scrubber-range::-moz-range-thumb {
          width: 13px; height: 13px; border-radius: 50%;
          background: rgba(160,210,140,0.9); border: none; cursor: pointer;
        }
        .scrub-btn {
          background: none; border: none; cursor: pointer; padding: 3px 12px;
          color: rgba(140,180,120,0.4); font-size: 11px;
          font-family: 'Inter', system-ui, sans-serif;
          letter-spacing: 0.06em; border-radius: 4px; transition: color 0.15s;
        }
        .scrub-btn:hover { color: rgba(160,210,140,0.85); }
        .scrub-btn.playing { color: rgba(200,140,80,0.8); }
      `}</style>

      {/* Summary */}
      <div style={{
        position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(6,12,7,0.6)', backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(100,160,80,0.12)',
        borderRadius: 20, padding: '6px 22px',
        fontSize: 12, color: 'rgba(140,190,120,0.55)',
        letterSpacing: '0.07em', whiteSpace: 'nowrap',
        zIndex: 10, pointerEvents: 'none',
      }}>
        {summaryText}
      </div>

      {/* ── SVG Mycelium ──────────────────────────────────────────────────────── */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%" height="100vh"
        preserveAspectRatio="xMidYMax meet"
        style={{ display: 'block' }}
      >
        <defs>
          <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="labelGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="milestoneGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="bg" cx="50%" cy="80%" r="70%">
            <stop offset="0%" stopColor="#0d1a0e" />
            <stop offset="100%" stopColor="#060d07" />
          </radialGradient>
        </defs>

        <rect width={W} height={H} fill="url(#bg)" />

        {/* Root glow */}
        <circle cx={W / 2} cy={H - 28} r={32}
          fill="radial-gradient"
          opacity={0.06}
          style={{ filter: 'blur(18px)' }}
        />
        <circle cx={W / 2} cy={H - 28} r={4}
          fill="#7ab86a" opacity={0.7} filter="url(#glow)"
        />

        {/* ── Branches ──────────────────────────────────────────────────────── */}
        {ALL_BRANCHES.map((b, i) => {
          const visible   = b.week <= displayWeek
          if (!visible) return null
          const isCurrent = b.week === displayWeek

          // Color: brighter and warmer for shallow/recent; fades for older
          const age   = displayWeek - b.week
          const alpha = isCurrent ? 0.9 : Math.max(0.25, 0.85 - age * 0.06)

          // Thin fine threads — thicker near root
          const sw = Math.max(0.4, 1.8 - b.depth * 0.12)

          const col = b.depth <= 3
            ? `rgba(200,230,180,${alpha})`     // bright near root
            : b.depth <= 7
              ? `rgba(160,200,140,${alpha})`   // mid network
              : `rgba(120,170,100,${alpha})`   // fine tips

          const d = `M${b.x1},${b.y1} Q${b.cpx},${b.cpy} ${b.x2},${b.y2}`

          return (
            <path
              key={`br${i}`}
              d={d}
              stroke={col}
              strokeWidth={sw}
              strokeLinecap="round"
              fill="none"
              className={isCurrent && mounted ? 'branch-new' : undefined}
              style={{
                transition: 'opacity 0.4s ease',
                ...(isCurrent && mounted
                  ? ({ '--len': b.len, strokeDasharray: b.len } as React.CSSProperties)
                  : {}),
              }}
            />
          )
        })}

        {/* ── Nodes + Labels ────────────────────────────────────────────────── */}
        {ALL_NODES.filter(n => n.week <= displayWeek).map((n, i) => {
          const isCurrent    = n.week === displayWeek
          const isMilestone  = n.isMilestone && MILESTONES[n.week]
          const age          = displayWeek - n.week
          const nodeAlpha    = isCurrent ? 1 : Math.max(0.3, 0.9 - age * 0.06)

          const nodeR    = isMilestone ? 4 : n.depth === 0 ? 4 : 2
          const nodeFill = isMilestone ? '#d4a870' : isCurrent ? '#b8e090' : '#7aaa60'
          const filter   = isMilestone ? 'url(#milestoneGlow)' : isCurrent ? 'url(#glow)' : undefined

          // Label placement: alternate sides based on x position
          const labelRight  = n.x < W * 0.6
          const labelX      = labelRight ? n.x + nodeR + 7 : n.x - nodeR - 7
          const labelAnchor = labelRight ? 'start' : 'end'

          const labelAlpha = isCurrent
            ? 1
            : n.isMilestone
              ? Math.max(0.5, 0.9 - age * 0.05)
              : Math.max(0.2, 0.7 - age * 0.06)

          const labelColor = isMilestone
            ? `rgba(220,180,110,${labelAlpha})`
            : `rgba(160,200,130,${labelAlpha})`

          return (
            <g key={`nd${i}`}>
              <circle
                cx={n.x} cy={n.y} r={nodeR}
                fill={nodeFill}
                opacity={nodeAlpha}
                filter={filter}
                className={isCurrent && mounted ? 'node-new' : undefined}
              />
              {n.label && (
                <text
                  x={labelX}
                  y={n.y + 4}
                  fill={labelColor}
                  fontSize={isMilestone ? 12 : 10}
                  fontWeight={isMilestone ? 600 : 400}
                  fontFamily="'Inter', system-ui, sans-serif"
                  letterSpacing={isMilestone ? '0.06em' : '0.03em'}
                  textAnchor={labelAnchor}
                  className={isCurrent && mounted ? 'label-new' : undefined}
                  filter={isMilestone ? 'url(#labelGlow)' : undefined}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  {n.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* ── Scrubber ─────────────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 22, left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(520px, 88vw)',
        background: 'rgba(5, 10, 6, 0.8)',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        border: '1px solid rgba(100,160,80,0.15)',
        borderRadius: 18, padding: '12px 22px',
        zIndex: 50, boxShadow: '0 4px 40px rgba(0,0,0,0.7)',
      }}>
        <div style={{
          textAlign: 'center', marginBottom: 10, minHeight: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          {isDragging && (
            <span style={{ fontSize: 10, color: 'rgba(140,180,120,0.3)', fontStyle: 'italic' }}>
              preview
            </span>
          )}
          <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(160,210,130,0.8)', letterSpacing: '0.04em' }}>
            Week {displayWeek}{currentDateRange ? ` · ${currentDateRange}` : ''}
            {MILESTONES[displayWeek] && (
              <span style={{ color: 'rgba(210,170,90,0.85)', marginLeft: 8 }}>
                · {MILESTONES[displayWeek]}
              </span>
            )}
          </span>
          {currentWeekStats.total > 0 && (
            <span style={{ fontSize: 10, color: 'rgba(140,180,120,0.38)' }}>
              {currentWeekStats.done}/{currentWeekStats.total}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 10, color: 'rgba(120,160,100,0.28)', whiteSpace: 'nowrap' }}>W1</span>
          <input
            type="range" min={1} max={12} value={displayWeek}
            className="scrubber-range"
            onChange={handleSliderChange}
            onMouseUp={handleSliderUp}
            onTouchEnd={handleSliderUp}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: 10, color: 'rgba(120,160,100,0.28)', whiteSpace: 'nowrap' }}>W12</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 8 }}>
          <button className={`scrub-btn${isPlaying ? ' playing' : ''}`} onClick={handlePlay}>
            {isPlaying ? '■ stop' : '▶ play'}
          </button>
          <button className="scrub-btn" onClick={handleReset}>⏮ reset</button>
          <button
            className="scrub-btn"
            onClick={() => onOwnerWeekFilter('All', `Week ${displayWeek}`)}
            style={{ color: 'rgba(200,140,80,0.4)' }}
          >
            view tasks
          </button>
        </div>
      </div>
    </div>
  )
}
