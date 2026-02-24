import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import type { Task } from '../types'
import { normalizeStatus, WEEK_DATES } from '../types'

interface Props {
  tasks: Task[]
  onOwnerWeekFilter: (owner: string, week: string) => void
}

// ── SVG canvas constants ───────────────────────────────────────────────────────
const SVG_W = 1000
const SVG_H = 820

// ── Seeded PRNG (deterministic — same tree every render) ──────────────────────
class SeededRandom {
  private seed: number
  constructor(seed: number) { this.seed = seed }
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280
    return this.seed / 233280
  }
}

// ── Branch data ────────────────────────────────────────────────────────────────
interface Branch {
  x1: number; y1: number
  x2: number; y2: number
  cpx: number; cpy: number
  depth: number
  angle: number
  length: number
  weekIndex: number
}

// ── Recursive fractal tree generator ──────────────────────────────────────────
function generateTree(
  x: number, y: number,
  angle: number,
  length: number,
  depth: number,
  weekIndex: number,
  branches: Branch[],
  rand: SeededRandom,
): void {
  if (depth === 0 || length < 3) return

  const rad = (angle * Math.PI) / 180
  const curve = rand.next() * 20 - 10
  const cpx = x + Math.cos(rad + Math.PI / 2) * curve + Math.cos(rad) * length * 0.5
  const cpy = y - Math.sin(rad + Math.PI / 2) * curve - Math.sin(rad) * length * 0.5
  const x2 = x + Math.cos(rad) * length
  const y2 = y - Math.sin(rad) * length

  branches.push({ x1: x, y1: y, x2, y2, cpx, cpy, depth, angle, length, weekIndex })

  const splitCount = depth > 5 && rand.next() > 0.6 ? 3 : 2
  const spreadBase = 25 + rand.next() * 20

  for (let i = 0; i < splitCount; i++) {
    const angleOffset = splitCount === 2
      ? (i === 0 ? -spreadBase : spreadBase)
      : (i - 1) * spreadBase
    const newAngle = angle + angleOffset + (rand.next() * 10 - 5)
    const newLength = length * (0.6 + rand.next() * 0.1)
    const childDepth = depth - 1
    const newWeek = childDepth === 0
      ? 12
      : Math.max(1, Math.min(12, Math.round(1 + 11 * (1 - (childDepth - 1) / 8))))
    generateTree(x2, y2, newAngle, newLength, childDepth, newWeek, branches, rand)
  }
}

// ── Visual mapping: depth → stroke width ──────────────────────────────────────
function getBranchWidth(depth: number): number {
  const map: Record<number, number> = {
    9: 16, 8: 12, 7: 9, 6: 6.5, 5: 4.5, 4: 3, 3: 1.8, 2: 1.0, 1: 0.6,
  }
  return map[depth] ?? 0.6
}

// ── Active branch color — ink brushstroke palette ─────────────────────────────
function getActiveBranchColor(depth: number): string {
  if (depth >= 8) return '#4a3a2a'   // deep ink trunk — dark sumi
  if (depth >= 6) return '#3a4a32'   // dark ink, hint of forest
  if (depth >= 4) return '#304030'   // dark grey-green
  if (depth >= 2) return '#2e4a34'   // deep green-black twig
  return '#3a5a40'                   // dark green tip
}

// ── Current week from program start date ──────────────────────────────────────
function computeActualWeek(): number {
  const now = new Date()
  const weekOneStart = new Date('2026-02-24')
  const diffDays = Math.floor((now.getTime() - weekOneStart.getTime()) / 86_400_000)
  if (diffDays < 0) return 1
  return Math.max(1, Math.min(12, Math.floor(diffDays / 7) + 1))
}

// ── Leaf cluster attached to a branch tip ─────────────────────────────────────
interface Leaf {
  cx: number; cy: number
  rx: number; ry: number
  rotation: number
  colorIdx: number
}

// Muted ink-wash greens — no neon
const LEAF_COLORS = ['#3a6a42', '#2e5c38', '#4a7a52', '#3d6645', '#527a5a']

function generateLeafCluster(branch: Branch, rand: SeededRandom): Leaf[] {
  // Sparse — 2-4 leaves per tip, small, delicate
  const count = 2 + Math.floor(rand.next() * 3)
  const leaves: Leaf[] = []
  for (let i = 0; i < count; i++) {
    const spread = rand.next() * 60 - 30
    const dist = rand.next() * 10 + 3
    const leafRad = ((branch.angle + spread) * Math.PI) / 180
    const cx = branch.x2 + Math.cos(leafRad) * dist
    const cy = branch.y2 - Math.sin(leafRad) * dist
    const rx = 5 + rand.next() * 5   // small: 5-10px
    const ry = 2 + rand.next() * 3   // thin: 2-5px
    const rotation = rand.next() * 360
    const colorIdx = Math.floor(rand.next() * LEAF_COLORS.length)
    leaves.push({ cx, cy, rx, ry, rotation, colorIdx })
  }
  return leaves
}

// ── Milestone flower ───────────────────────────────────────────────────────────
function flowerPoints(cx: number, cy: number, r = 7): string {
  const pts: string[] = []
  for (let i = 0; i < 5; i++) {
    const outerRad = ((i * 72 - 90) * Math.PI) / 180
    const innerRad = (((i * 72 + 36) - 90) * Math.PI) / 180
    pts.push(`${cx + Math.cos(outerRad) * r},${cy + Math.sin(outerRad) * r}`)
    pts.push(`${cx + Math.cos(innerRad) * r * 0.38},${cy + Math.sin(innerRad) * r * 0.38}`)
  }
  return pts.join(' ')
}

const MILESTONE_WEEKS = new Set([3, 6, 9, 12])

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
  const [mounted, setMounted] = useState(false)

  const springRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isPlayingRef = useRef(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80)
    return () => clearTimeout(t)
  }, [])

  // ── Generate all fractal branches ─────────────────────────────────────────────
  const branches = useMemo(() => {
    const rand = new SeededRandom(42)
    const result: Branch[] = []
    generateTree(
      SVG_W / 2,
      SVG_H - 50,
      90,
      SVG_H * 0.23,
      9,
      1,
      result,
      rand,
    )
    return result
  }, [])

  // ── Pre-generate leaf clusters for shallow branches ───────────────────────────
  const leafClusters = useMemo(() => {
    const rand = new SeededRandom(137)
    return branches
      .filter(b => b.depth <= 3)
      .map(b => ({
        branch: b,
        leaves: generateLeafCluster(b, rand),
        isFlower: MILESTONE_WEEKS.has(b.weekIndex) && b.depth <= 2,
      }))
  }, [branches])

  // ── Week stats ────────────────────────────────────────────────────────────────
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

  const totalDone = tasks.filter(t => normalizeStatus(t.status) === 'done').length
  const totalTasks = tasks.length

  const summaryText = useMemo(() => {
    const total = totalTasks || 220
    if (totalDone >= total) return 'The forest is complete'
    if (totalDone / total > 0.5) return `In full bloom — ${totalDone} of ${total} tasks complete`
    if (totalDone === 0) return 'Just beginning — the forest stirs'
    return `Growing — ${totalDone} of ${total} tasks complete`
  }, [totalDone, totalTasks])

  // ── Spring-back ───────────────────────────────────────────────────────────────
  const triggerSpringBack = useCallback(() => {
    if (springRef.current) clearTimeout(springRef.current)
    const start = previewWeekRef.current
    const end = actualWeek
    if (start === end) return
    const steps = Math.abs(end - start)
    const stepMs = Math.max(40, Math.round(600 / steps))
    const dir = end > start ? 1 : -1
    let current = start
    const tick = () => {
      current += dir
      setPreviewWeek(current)
      if (current !== end) springRef.current = setTimeout(tick, stepMs)
    }
    springRef.current = setTimeout(tick, 60)
  }, [actualWeek, setPreviewWeek])

  // ── Slider handlers ───────────────────────────────────────────────────────────
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (springRef.current) clearTimeout(springRef.current)
    setIsDragging(true)
    setPreviewWeek(parseInt(e.target.value, 10))
  }
  const handleSliderUp = () => {
    setIsDragging(false)
    triggerSpringBack()
  }

  // ── Play animation ────────────────────────────────────────────────────────────
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
        setTimeout(() => triggerSpringBack(), 1200)
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
    if (playRef.current) clearTimeout(playRef.current)
  }, [])

  const displayWeek = previewWeek
  const currentDateRange = WEEK_DATES[`Week ${previewWeek}`] || ''
  const currentWeekStats = weekStats[`Week ${previewWeek}`] || { done: 0, total: 0 }

  const sortedBranches = useMemo(
    () => [...branches].sort((a, b) => b.depth - a.depth),
    [branches],
  )

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100vh',
      overflow: 'hidden',
      background: '#0a1409',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <style>{`
        @keyframes trunkGrow {
          from { stroke-dashoffset: 300; opacity: 0; }
          to   { stroke-dashoffset: 0;   opacity: 1; }
        }
        @keyframes leafBloom {
          0%   { opacity: 0; transform: scale(0.2); }
          70%  { opacity: 1; transform: scale(1.1); }
          100% { opacity: 0.88; transform: scale(1); }
        }
        @keyframes flowerPop {
          0%   { opacity: 0; transform: scale(0) rotate(-20deg); }
          65%  { opacity: 1; transform: scale(1.3) rotate(5deg); }
          100% { opacity: 0.95; transform: scale(1) rotate(0deg); }
        }
        .trunk-anim {
          stroke-dasharray: 300;
          animation: trunkGrow 1.5s cubic-bezier(0.4, 0, 0.2, 1) both;
        }
        .flower-pop {
          animation: flowerPop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          transform-box: fill-box;
          transform-origin: center;
        }
        .leaf-bloom {
          animation: leafBloom 0.5s cubic-bezier(0.34, 1.3, 0.64, 1) both;
          transform-box: fill-box;
          transform-origin: center;
        }
        .scrubber-range {
          -webkit-appearance: none;
          width: 100%;
          height: 2px;
          background: rgba(74,122,60,0.3);
          border-radius: 2px;
          outline: none;
          cursor: pointer;
        }
        .scrubber-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 15px; height: 15px;
          border-radius: 50%;
          background: #5ab870;
          cursor: pointer;
          box-shadow: 0 0 8px rgba(90,184,112,0.6), 0 0 2px rgba(90,184,112,0.9);
          transition: transform 0.15s;
        }
        .scrubber-range::-webkit-slider-thumb:hover { transform: scale(1.25); }
        .scrubber-range::-moz-range-thumb {
          width: 15px; height: 15px;
          border-radius: 50%;
          background: #5ab870;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 8px rgba(90,184,112,0.6);
        }
        .scrub-btn {
          background: none; border: none;
          cursor: pointer; padding: 4px 12px;
          color: rgba(168,196,152,0.6);
          font-size: 11px;
          font-family: 'Inter', system-ui, sans-serif;
          letter-spacing: 0.05em; border-radius: 4px;
          transition: color 0.15s;
        }
        .scrub-btn:hover { color: rgba(168,196,152,0.95); }
        .scrub-btn.playing { color: #d4693a; }
      `}</style>

      {/* ── Summary — top center ─────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 20, left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(10, 20, 9, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(74,122,60,0.2)',
        borderRadius: 20,
        padding: '7px 22px',
        fontSize: 12,
        color: 'rgba(168,196,152,0.75)',
        letterSpacing: '0.06em',
        whiteSpace: 'nowrap',
        zIndex: 10,
        pointerEvents: 'none',
      }}>
        {summaryText}
      </div>

      {/* ── Tree SVG ─────────────────────────────────────────────────────────── */}
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        width="100%"
        height="100vh"
        preserveAspectRatio="xMidYMax meet"
        style={{ display: 'block' }}
      >
        <defs>
          {/* Subtle ink-bleed for active branches */}
          <filter id="branchGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Slightly stronger for current-week tip branches */}
          <filter id="branchGlowStrong" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Flower glow — coral accent only */}
          <filter id="flowerGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Ground mist gradient */}
          <radialGradient id="groundMist" cx="50%" cy="100%" r="50%">
            <stop offset="0%" stopColor="#1a3a1a" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0a1409" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Dark background */}
        <rect width={SVG_W} height={SVG_H} fill="#0a1409" />

        {/* Ground mist glow at base */}
        <ellipse
          cx={SVG_W / 2} cy={SVG_H}
          rx={380} ry={120}
          fill="url(#groundMist)"
        />

        {/* Very faint sky gradient — top of canvas is slightly less dark */}
        <rect
          width={SVG_W} height={SVG_H * 0.6}
          fill="url(#skyGrad)"
          style={{ pointerEvents: 'none' }}
        />

        {/* ── Fractal branches ─────────────────────────────────────────────── */}
        {sortedBranches.map((branch, i) => {
          const isFuture  = branch.weekIndex > displayWeek
          const isCurrent = branch.weekIndex === displayWeek
          const isPast    = branch.weekIndex < displayWeek

          // Dormant skeleton (future) — faintly visible, cool dark
          // Past — warm lit bark
          // Current — brightest, slight glow pulse
          const stroke = isFuture
            ? '#1e3a20'  // barely visible dark green skeleton
            : getActiveBranchColor(branch.depth)

          const opacity = isFuture ? 0.35 : isCurrent ? 1.0 : 0.85
          const sw = getBranchWidth(branch.depth)
          const pathD = `M ${branch.x1} ${branch.y1} Q ${branch.cpx} ${branch.cpy} ${branch.x2} ${branch.y2}`
          const approxLen = Math.round(branch.length * 1.08)
          const shouldAnimTrunk = mounted && branch.depth === 9

          const glowFilter = isFuture ? undefined
            : isCurrent && branch.depth >= 5 ? 'url(#branchGlowStrong)'
            : isPast && branch.depth >= 4 ? 'url(#branchGlow)'
            : undefined

          return (
            <path
              key={i}
              d={pathD}
              stroke={stroke}
              strokeWidth={sw}
              strokeLinecap="round"
              fill="none"
              opacity={opacity}
              filter={glowFilter}
              className={shouldAnimTrunk ? 'trunk-anim' : undefined}
              style={{
                transition: 'opacity 0.5s ease, stroke 0.5s ease',
                ...(shouldAnimTrunk
                  ? ({ '--brlen': approxLen, strokeDasharray: approxLen } as React.CSSProperties)
                  : {}),
              }}
            />
          )
        })}

        {/* ── Leaves & flowers ─────────────────────────────────────────────── */}
        {leafClusters.map(({ branch, leaves, isFlower }, ci) => {
          const isFuture  = branch.weekIndex > displayWeek
          const isCurrent = branch.weekIndex === displayWeek

          if (isFuture) return null

          const baseAlpha = isCurrent ? 0.7 : 0.88

          if (isFlower) {
            return (
              <g key={`f${ci}`} filter="url(#flowerGlow)">
                {leaves.slice(0, 4).map((lf, li) => (
                  <ellipse
                    key={li}
                    cx={lf.cx} cy={lf.cy}
                    rx={lf.rx * 0.8} ry={lf.ry * 0.8}
                    fill={LEAF_COLORS[lf.colorIdx]}
                    opacity={0.6 * baseAlpha}
                    transform={`rotate(${lf.rotation}, ${lf.cx}, ${lf.cy})`}
                    style={{ pointerEvents: 'none' }}
                  />
                ))}
                <polygon
                  points={flowerPoints(branch.x2, branch.y2, 7)}
                  fill="#d4693a"
                  opacity={0.95 * baseAlpha}
                  className={isCurrent ? 'flower-pop' : undefined}
                  style={{ pointerEvents: 'none' }}
                />
                <circle
                  cx={branch.x2} cy={branch.y2} r={2}
                  fill="#f5d4b0"
                  opacity={baseAlpha}
                  style={{ pointerEvents: 'none' }}
                />
              </g>
            )
          }

          return (
            <g key={`l${ci}`}>
              {leaves.map((lf, li) => (
                <ellipse
                  key={li}
                  cx={lf.cx} cy={lf.cy}
                  rx={lf.rx} ry={lf.ry}
                  fill={LEAF_COLORS[lf.colorIdx]}
                  opacity={0.55 * baseAlpha}
                  transform={`rotate(${lf.rotation}, ${lf.cx}, ${lf.cy})`}
                  className={isCurrent ? 'leaf-bloom' : undefined}
                  style={{
                    pointerEvents: 'none',
                    transition: 'opacity 0.4s ease',
                  }}
                />
              ))}
            </g>
          )
        })}
      </svg>

      {/* ── Time Scrubber — dark frosted glass, bottom center ───────────────── */}
      <div style={{
        position: 'absolute',
        bottom: 22,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(560px, 88vw)',
        background: 'rgba(8, 18, 8, 0.82)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(74,122,60,0.25)',
        borderRadius: 18,
        padding: '12px 22px',
        zIndex: 50,
        boxShadow: '0 4px 32px rgba(0,0,0,0.5), 0 0 60px rgba(42,90,40,0.08)',
      }}>
        {/* Label row */}
        <div style={{
          textAlign: 'center', marginBottom: 10, minHeight: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          {isDragging && (
            <span style={{ fontSize: 10, color: 'rgba(168,196,152,0.4)', fontStyle: 'italic' }}>
              preview
            </span>
          )}
          <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(168,196,152,0.9)', letterSpacing: '0.04em' }}>
            Week {previewWeek}{currentDateRange ? ` · ${currentDateRange}` : ''}
          </span>
          {currentWeekStats.total > 0 && (
            <span style={{ fontSize: 10, color: 'rgba(168,196,152,0.45)' }}>
              {currentWeekStats.done}/{currentWeekStats.total}
            </span>
          )}
          {previewWeek === actualWeek && !isDragging && !isPlaying && (
            <span style={{ fontSize: 10, color: 'rgba(168,196,152,0.3)', fontStyle: 'italic' }}>now</span>
          )}
        </div>

        {/* Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 10, color: 'rgba(168,196,152,0.35)', whiteSpace: 'nowrap' }}>W1</span>
          <input
            type="range" min={1} max={12} value={previewWeek}
            className="scrubber-range"
            onChange={handleSliderChange}
            onMouseUp={handleSliderUp}
            onTouchEnd={handleSliderUp}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: 10, color: 'rgba(168,196,152,0.35)', whiteSpace: 'nowrap' }}>W12</span>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 8 }}>
          <button className={`scrub-btn${isPlaying ? ' playing' : ''}`} onClick={handlePlay}>
            {isPlaying ? '■ stop' : '▶ play'}
          </button>
          <button className="scrub-btn" onClick={handleReset}>⏮ reset</button>
          <button
            className="scrub-btn"
            onClick={() => onOwnerWeekFilter('All', `Week ${previewWeek}`)}
            style={{ color: 'rgba(212,105,58,0.7)' }}
          >
            view tasks
          </button>
        </div>
      </div>
    </div>
  )
}
