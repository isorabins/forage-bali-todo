import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import type { Task } from '../types'
import { normalizeStatus, WEEK_DATES } from '../types'

interface Props {
  tasks: Task[]
  onOwnerWeekFilter: (owner: string, week: string) => void
}

// ── SVG canvas constants ───────────────────────────────────────────────────────
const SVG_W = 1000
const SVG_H = 800

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
  cpx: number; cpy: number   // quadratic bezier control point
  depth: number
  angle: number
  length: number
  weekIndex: number           // 1-12: which week "owns" this branch
}

// ── Recursive fractal tree generator ──────────────────────────────────────────
function generateTree(
  x: number, y: number,
  angle: number,              // degrees, 90 = straight up
  length: number,
  depth: number,
  weekIndex: number,
  branches: Branch[],
  rand: SeededRandom,
): void {
  if (depth === 0 || length < 3) return

  const rad = (angle * Math.PI) / 180
  const curve = rand.next() * 20 - 10                                      // slight S-curve
  const cpx = x + Math.cos(rad + Math.PI / 2) * curve + Math.cos(rad) * length * 0.5
  const cpy = y - Math.sin(rad + Math.PI / 2) * curve - Math.sin(rad) * length * 0.5
  const x2 = x + Math.cos(rad) * length
  const y2 = y - Math.sin(rad) * length

  branches.push({ x1: x, y1: y, x2, y2, cpx, cpy, depth, angle, length, weekIndex })

  const splitCount = depth > 5 && rand.next() > 0.6 ? 3 : 2
  const spreadBase = 25 + rand.next() * 20                                 // 25-45°

  for (let i = 0; i < splitCount; i++) {
    const angleOffset = splitCount === 2
      ? (i === 0 ? -spreadBase : spreadBase)
      : (i - 1) * spreadBase
    const newAngle = angle + angleOffset + (rand.next() * 10 - 5)
    const newLength = length * (0.6 + rand.next() * 0.1)
    // Map depth linearly: depth 9 = week 1, depth 1 = week 12
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
    9: 18, 8: 14, 7: 10, 6: 7, 5: 5, 4: 3.5, 3: 2, 2: 1.2, 1: 0.7,
  }
  return map[depth] ?? 0.7
}

// ── Visual mapping: depth → bark color ────────────────────────────────────────
function getBranchColor(depth: number): string {
  if (depth >= 8) return '#6b5344'   // dark bark — trunk & main
  if (depth >= 6) return '#8b7355'   // warm bark — branches
  if (depth >= 4) return '#a08060'   // lighter bark — sub-branches
  if (depth >= 2) return '#b89070'   // pale bark — twigs
  return '#7a9e6b'                   // transitioning to green — tips
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
  color: string
}

function generateLeafCluster(branch: Branch, rand: SeededRandom): Leaf[] {
  const count = 3 + Math.floor(rand.next() * 5)  // 3-7 per tip
  const leaves: Leaf[] = []
  for (let i = 0; i < count; i++) {
    const spread = rand.next() * 60 - 30           // ±30° around branch direction
    const dist = rand.next() * 14 + 4
    const leafRad = ((branch.angle + spread) * Math.PI) / 180
    const cx = branch.x2 + Math.cos(leafRad) * dist
    const cy = branch.y2 - Math.sin(leafRad) * dist
    const rx = 8 + rand.next() * 6                 // 8-14px
    const ry = 4 + rand.next() * 3                 // 4-7px
    const rotation = rand.next() * 360
    const color = rand.next() > 0.5 ? '#7a9e6b' : '#a8c498'
    leaves.push({ cx, cy, rx, ry, rotation, color })
  }
  return leaves
}

// ── 5-petal flower polygon at a branch tip ────────────────────────────────────
function flowerPoints(cx: number, cy: number, r = 6): string {
  const pts: string[] = []
  for (let i = 0; i < 5; i++) {
    const outerRad = ((i * 72 - 90) * Math.PI) / 180
    const innerRad = (((i * 72 + 36) - 90) * Math.PI) / 180
    pts.push(`${cx + Math.cos(outerRad) * r},${cy + Math.sin(outerRad) * r}`)
    pts.push(`${cx + Math.cos(innerRad) * r * 0.4},${cy + Math.sin(innerRad) * r * 0.4}`)
  }
  return pts.join(' ')
}

// ── Milestones (flower weeks) ──────────────────────────────────────────────────
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

  // Trigger the trunk draw animation on mount
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80)
    return () => clearTimeout(t)
  }, [])

  // ── Generate all fractal branches (fixed seed = same tree every time) ────────
  const branches = useMemo(() => {
    const rand = new SeededRandom(42)
    const result: Branch[] = []
    generateTree(
      SVG_W / 2,         // center x
      SVG_H - 60,        // near bottom
      90,                // pointing straight up
      SVG_H * 0.22,      // trunk ≈ 22% of height
      9,                 // 9 levels deep
      1,                 // starts at week 1
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

  // ── Week stats from tasks ─────────────────────────────────────────────────────
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
    if (totalDone >= total) return 'The Forage Bali forest is complete. 🌿'
    if (totalDone / total > 0.5) return `Full bloom — ${totalDone} of ${total} tasks complete`
    return `Your garden is growing — ${totalDone} of ${total} tasks complete`
  }, [totalDone, totalTasks])

  // ── Spring-back: animate previewWeek → actualWeek ────────────────────────────
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
        setTimeout(() => triggerSpringBack(), 1000)
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

  // ── Sorted branches: render deepest (thickest) first ─────────────────────────
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
      background: '#f8f5f2',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* ── CSS ───────────────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes drawTrunk {
          from { stroke-dashoffset: 300; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes drawBranch {
          from { stroke-dashoffset: var(--brlen, 200); }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes flowerPop {
          0%   { opacity: 0; transform: scale(0) rotate(-20deg); }
          60%  { opacity: 1; transform: scale(1.2) rotate(5deg); }
          100% { opacity: 0.9; transform: scale(1) rotate(0deg); }
        }
        .trunk-anim {
          stroke-dasharray: 300;
          animation: drawTrunk 1.4s cubic-bezier(0.4, 0, 0.2, 1) both;
        }
        .branch-anim-8 {
          animation: drawBranch 1.1s 0.1s cubic-bezier(0.4, 0, 0.2, 1) both;
        }
        .branch-anim-7 {
          animation: drawBranch 0.9s 0.2s cubic-bezier(0.4, 0, 0.2, 1) both;
        }
        .branch-anim-6 {
          animation: drawBranch 0.7s 0.3s cubic-bezier(0.4, 0, 0.2, 1) both;
        }
        .branch-anim-5 {
          animation: drawBranch 0.6s 0.4s cubic-bezier(0.4, 0, 0.2, 1) both;
        }
        .branch-anim-4 {
          animation: drawBranch 0.5s 0.5s cubic-bezier(0.4, 0, 0.2, 1) both;
        }
        .branch-anim-3 {
          animation: drawBranch 0.4s 0.6s cubic-bezier(0.4, 0, 0.2, 1) both;
        }
        .branch-anim-2 {
          animation: drawBranch 0.35s 0.7s cubic-bezier(0.4, 0, 0.2, 1) both;
        }
        .branch-anim-1 {
          animation: drawBranch 0.3s 0.8s cubic-bezier(0.4, 0, 0.2, 1) both;
        }
        .flower-pop {
          animation: flowerPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          transform-box: fill-box;
          transform-origin: center;
        }
        .scrubber-range {
          -webkit-appearance: none;
          width: 100%;
          height: 3px;
          background: #e2d9d0;
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
          box-shadow: 0 1px 4px rgba(201,125,96,0.4);
          transition: transform 0.15s;
        }
        .scrubber-range::-webkit-slider-thumb:hover { transform: scale(1.2); }
        .scrubber-range::-moz-range-thumb {
          width: 16px; height: 16px;
          border-radius: 50%;
          background: #c97d60;
          cursor: pointer;
          border: none;
          box-shadow: 0 1px 4px rgba(201,125,96,0.4);
        }
        .scrub-btn {
          background: none; border: none;
          cursor: pointer; padding: 4px 10px;
          color: #8a8580; font-size: 12px;
          font-family: 'Inter', system-ui, sans-serif;
          letter-spacing: 0.03em; border-radius: 4px;
          transition: color 0.15s;
        }
        .scrub-btn:hover { color: #5c5853; }
        .scrub-btn.playing { color: #c97d60; }
      `}</style>

      {/* ── Summary — top center, floats over tree ──────────────────────────── */}
      <div style={{
        position: 'absolute', top: 18, left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(248,245,242,0.9)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderRadius: 12,
        padding: '8px 20px',
        fontSize: 13,
        color: '#8a8580',
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
        zIndex: 10,
        pointerEvents: 'none',
      }}>
        {summaryText}
      </div>

      {/* ── Tree SVG — fills the viewport ───────────────────────────────────── */}
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        width="100%"
        height="100vh"
        preserveAspectRatio="xMidYMax meet"
        style={{ display: 'block' }}
      >
        {/* Warm beige background */}
        <rect width={SVG_W} height={SVG_H} fill="#f8f5f2" />

        {/* Soft ground shadow */}
        <ellipse
          cx={SVG_W / 2} cy={SVG_H - 48}
          rx={140} ry={9}
          fill="#ddd6cc" opacity={0.5}
        />

        {/* ── Fractal branches (thickest first) ────────────────────────────── */}
        {sortedBranches.map((branch, i) => {
          const isFuture  = branch.weekIndex > displayWeek
          const isCurrent = branch.weekIndex === displayWeek

          const opacity: number = isFuture ? 0.06 : isCurrent ? 0.7 : 1
          const stroke: string  = isFuture ? '#d4c5b0' : getBranchColor(branch.depth)
          const sw = getBranchWidth(branch.depth)

          const pathD = `M ${branch.x1} ${branch.y1} Q ${branch.cpx} ${branch.cpy} ${branch.x2} ${branch.y2}`

          // Approximate path length for dash animation
          const approxLen = Math.round(branch.length * 1.08)

          const shouldAnimate = mounted && branch.depth >= 8

          // For trunk/main branches animate in; stagger by depth
          const animClass = shouldAnimate
            ? branch.depth === 9
              ? 'trunk-anim'
              : `branch-anim-${branch.depth}`
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
              className={animClass}
              style={{
                transition: 'opacity 0.45s ease, stroke 0.45s ease',
                ...(animClass
                  ? ({ '--brlen': approxLen, strokeDasharray: approxLen } as React.CSSProperties)
                  : {}),
              }}
            />
          )
        })}

        {/* ── Leaves & flowers on shallow branches ─────────────────────────── */}
        {leafClusters.map(({ branch, leaves, isFlower }, ci) => {
          const visible = branch.weekIndex <= displayWeek
          const alpha   = visible ? (branch.weekIndex === displayWeek ? 0.55 : 1) : 0

          if (alpha === 0) return null

          if (isFlower) {
            return (
              <g key={`f${ci}`}>
                {/* Small background leaf cluster */}
                {leaves.slice(0, 3).map((lf, li) => (
                  <ellipse
                    key={li}
                    cx={lf.cx} cy={lf.cy}
                    rx={lf.rx * 0.75} ry={lf.ry * 0.75}
                    fill="#a8c498"
                    opacity={0.65 * alpha}
                    transform={`rotate(${lf.rotation}, ${lf.cx}, ${lf.cy})`}
                    style={{ pointerEvents: 'none' }}
                  />
                ))}
                {/* 5-petal coral flower */}
                <polygon
                  points={flowerPoints(branch.x2, branch.y2, 6)}
                  fill="#c97d60"
                  opacity={0.9 * alpha}
                  className={visible && branch.weekIndex === displayWeek ? 'flower-pop' : undefined}
                  style={{ pointerEvents: 'none' }}
                />
                {/* Tiny center dot */}
                <circle
                  cx={branch.x2} cy={branch.y2} r={1.5}
                  fill="#f0e0d0"
                  opacity={alpha}
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
                  fill={lf.color}
                  opacity={0.82 * alpha}
                  transform={`rotate(${lf.rotation}, ${lf.cx}, ${lf.cy})`}
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

      {/* ── Time Scrubber — fixed bottom center, floats over tree ──────────── */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(580px, 90vw)',
        background: 'rgba(248,245,242,0.9)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderRadius: 16,
        padding: '12px 24px',
        zIndex: 50,
        boxShadow: '0 2px 24px rgba(0,0,0,0.08)',
      }}>
        {/* Label row */}
        <div style={{
          textAlign: 'center', marginBottom: 8, minHeight: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          {isDragging && (
            <span style={{ fontSize: 11, color: '#b0a89e', fontStyle: 'italic' }}>
              Preview — release to return
            </span>
          )}
          <span style={{ fontSize: 12, fontWeight: 500, color: '#5c5853' }}>
            Week {previewWeek}{currentDateRange ? ` · ${currentDateRange}` : ''}
          </span>
          {currentWeekStats.total > 0 && (
            <span style={{ fontSize: 11, color: '#b0a89e' }}>
              {currentWeekStats.done}/{currentWeekStats.total} done
            </span>
          )}
          {previewWeek === actualWeek && !isDragging && !isPlaying && (
            <span style={{ fontSize: 10, color: '#b0a89e', fontStyle: 'italic' }}>current</span>
          )}
        </div>

        {/* Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: '#b0a89e', whiteSpace: 'nowrap' }}>Week 1</span>
          <input
            type="range" min={1} max={12} value={previewWeek}
            className="scrubber-range"
            onChange={handleSliderChange}
            onMouseUp={handleSliderUp}
            onTouchEnd={handleSliderUp}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: 11, color: '#b0a89e', whiteSpace: 'nowrap' }}>Week 12</span>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 6 }}>
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
