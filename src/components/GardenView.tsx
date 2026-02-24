import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import type { Task } from '../types'
import { normalizeStatus, WEEK_DATES } from '../types'

interface Props {
  tasks: Task[]
  onOwnerWeekFilter: (owner: string, week: string) => void
}

// ── Palette ────────────────────────────────────────────────────────────────────
const BARK       = '#8b7355'
const GREEN_BUD  = '#7a9e6b'
const GREEN_FULL = '#5a8a4a'
const LEAF_COLOR = '#a8c498'
const CORAL      = '#c97d60'
const BARE_SAND  = '#d4c5b0'

// ── Layout ─────────────────────────────────────────────────────────────────────
const SVG_W        = 800
const SVG_H        = 900
const TRUNK_X      = 400
const TRUNK_BOTTOM = 820
const TRUNK_TOP    = 80
const WEEK_COUNT   = 12
const WEEK_SPACING = (TRUNK_BOTTOM - TRUNK_TOP) / (WEEK_COUNT - 1)  // ≈ 67
const TRUNK_LENGTH = TRUNK_BOTTOM - TRUNK_TOP                        // 740

const MILESTONES: Record<number, string> = {
  1:  'Foundation',
  3:  'Noko goes live',
  6:  'First beta class',
  9:  'First paid class',
  12: 'Scale',
}

// ── Current week from today's date ────────────────────────────────────────────
function computeActualWeek(): number {
  const now          = new Date()
  const weekOneStart = new Date('2026-02-24')
  const diffDays     = Math.floor((now.getTime() - weekOneStart.getTime()) / 86_400_000)
  if (diffDays < 0) return 1
  return Math.max(1, Math.min(12, Math.floor(diffDays / 7) + 1))
}

// ── Seeded PRNG (stable across renders) ───────────────────────────────────────
function seededRand(seed: number) {
  let s = seed | 0
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) | 0
    return (s >>> 0) / 0xffffffff
  }
}

// ── Cubic bezier helpers ───────────────────────────────────────────────────────
function bezierPoint(
  p0x: number, p0y: number,
  p1x: number, p1y: number,
  p2x: number, p2y: number,
  p3x: number, p3y: number,
  t: number,
): [number, number] {
  const mt = 1 - t
  return [
    mt**3*p0x + 3*mt**2*t*p1x + 3*mt*t**2*p2x + t**3*p3x,
    mt**3*p0y + 3*mt**2*t*p1y + 3*mt*t**2*p2y + t**3*p3y,
  ]
}

function branchPath(sx: number, sy: number, ex: number, ey: number, dir: 'left' | 'right') {
  const sign = dir === 'left' ? -1 : 1
  const dx   = Math.abs(ex - sx)
  const cp1x = sx + sign * dx * 0.25;  const cp1y = sy - 18
  const cp2x = sx + sign * dx * 0.75;  const cp2y = ey - 10
  return {
    path: `M ${sx},${sy} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${ex},${ey}`,
    cp1x, cp1y, cp2x, cp2y,
  }
}

// ── Leaf data ──────────────────────────────────────────────────────────────────
interface Leaf { cx: number; cy: number; rx: number; ry: number; angle: number; accent: boolean }

function generateLeaves(
  sx: number, sy: number,
  ex: number, ey: number,
  cp1x: number, cp1y: number,
  cp2x: number, cp2y: number,
  count: number, seedOffset: number,
): Leaf[] {
  const rand = seededRand(seedOffset)
  return Array.from({ length: count }, (_, i) => {
    const t   = Math.max(0, Math.min(1, 0.1 + (i / Math.max(count-1,1)) * 0.75 + (rand()-0.5)*0.08))
    const [bx, by] = bezierPoint(sx, sy, cp1x, cp1y, cp2x, cp2y, ex, ey, t)
    return {
      cx: bx + (rand()-0.5)*10,
      cy: by + (rand()-0.5)*24,
      rx: 5 + rand()*5,
      ry: 2.5 + rand()*3,
      angle: -60 + rand()*120,
      accent: rand() < 0.18,
    }
  })
}

// ── Flower (4-petal SVG) ───────────────────────────────────────────────────────
function flowerPath(cx: number, cy: number, r = 9): string {
  const p = r * 0.55
  return [
    `M ${cx},${cy-r}`,
    `C ${cx+p},${cy-r} ${cx+r},${cy-p} ${cx},${cy}`,
    `C ${cx+r},${cy+p} ${cx+p},${cy+r} ${cx},${cy+r}`,
    `C ${cx-p},${cy+r} ${cx-r},${cy+p} ${cx},${cy}`,
    `C ${cx-r},${cy-p} ${cx-p},${cy-r} ${cx},${cy-r}`,
    'Z',
  ].join(' ')
}

// ── Diamond hint for future milestones ────────────────────────────────────────
function diamondPath(cx: number, cy: number, r = 5): string {
  return `M ${cx},${cy-r} L ${cx+r},${cy} L ${cx},${cy+r} L ${cx-r},${cy} Z`
}

// ── Growth stages ─────────────────────────────────────────────────────────────
type Stage = 'bare' | 'budding' | 'growing' | 'lush' | 'bloomed'

function getStage(pct: number, visible: boolean, hasData: boolean): Stage {
  if (!visible || !hasData) return 'bare'
  if (pct >= 1)    return 'bloomed'
  if (pct >= 0.67) return 'lush'
  if (pct >= 0.34) return 'growing'
  if (pct > 0)     return 'budding'
  return 'bare'
}

function stageBranch(s: Stage): { color: string; opacity: number; width: number } {
  if (s === 'bloomed' || s === 'lush') return { color: GREEN_FULL, opacity: 1.0,  width: 2.0 }
  if (s === 'growing')                 return { color: GREEN_BUD,  opacity: 0.85, width: 1.8 }
  if (s === 'budding')                 return { color: BARK,       opacity: 0.55, width: 1.5 }
  return                                      { color: BARE_SAND,  opacity: 0.2,  width: 1.2 }
}

function stageLeafCount(s: Stage): number {
  if (s === 'bloomed') return 12
  if (s === 'lush')    return 8
  if (s === 'growing') return 5
  if (s === 'budding') return 2
  return 0
}

function leafColor(s: Stage, accent: boolean): string {
  if (accent && s === 'bloomed') return CORAL
  if (s === 'lush' || s === 'bloomed') return GREEN_BUD
  if (s === 'growing') return LEAF_COLOR
  return BARE_SAND
}

// ── Tooltip ────────────────────────────────────────────────────────────────────
interface TooltipData { x: number; y: number; week: string; done: number; total: number }

function Tooltip({ data }: { data: TooltipData }) {
  const n = parseInt(data.week.replace(/\D/g,''), 10)
  const dr = WEEK_DATES[`Week ${n}`] || ''
  return (
    <g style={{ pointerEvents: 'none' }}>
      <rect x={data.x-72} y={data.y-42} width={144} height={36} rx={6} fill="#2d2a27" opacity={0.93}/>
      <text x={data.x} y={data.y-26} textAnchor="middle"
        style={{ fontSize: 11, fill: '#f8f5f2', fontFamily: "'Inter',system-ui,sans-serif", fontWeight: 500 }}>
        {data.week} · {data.done}/{data.total} done
      </text>
      {dr && (
        <text x={data.x} y={data.y-12} textAnchor="middle"
          style={{ fontSize: 9, fill: BARE_SAND, fontFamily: "'Inter',system-ui,sans-serif" }}>
          {dr}
        </text>
      )}
    </g>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function GardenView({ tasks, onOwnerWeekFilter }: Props) {
  const actualWeek = useMemo(() => computeActualWeek(), [])

  // previewWeek: what the slider/play shows. Starts at actualWeek (bare tree).
  const [previewWeek, setPreviewWeekState] = useState(actualWeek)
  const previewWeekRef = useRef(actualWeek)
  const setPreviewWeek = useCallback((w: number) => {
    previewWeekRef.current = w
    setPreviewWeekState(w)
  }, [])

  const [isDragging, setIsDragging]  = useState(false)
  const [isPlaying,  setIsPlaying]   = useState(false)
  const [tooltip,    setTooltip]     = useState<TooltipData | null>(null)
  const [hoveredMs,  setHoveredMs]   = useState<number | null>(null)

  const springRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Week stats ───────────────────────────────────────────────────────────────
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
  const totalTasks = tasks.length

  const maxWeekTasks = useMemo(() => {
    const vals = Object.values(weekStats).map(w => w.total)
    return Math.max(...vals, 1)
  }, [weekStats])

  // ── Summary text ─────────────────────────────────────────────────────────────
  const summaryText = useMemo(() => {
    const total = totalTasks || 220
    if (totalDone >= total) return 'The Forage Bali forest is complete. 🌿'
    if (totalDone / total > 0.5) return `Your garden is in full bloom — ${totalDone} of ${total} tasks done`
    return `Your garden is just beginning to grow — ${totalDone} of ${total} tasks done`
  }, [totalDone, totalTasks])

  // ── Spring-back: step previewWeek toward actualWeek over ~600ms ──────────────
  const triggerSpringBack = useCallback(() => {
    if (springRef.current) clearTimeout(springRef.current)
    const start = previewWeekRef.current
    const end   = actualWeek
    if (start === end) return
    const steps   = Math.abs(end - start)
    const stepMs  = Math.max(40, Math.round(600 / steps))
    const dir     = end > start ? 1 : -1
    let   current = start
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

  // ── Play / Reset ──────────────────────────────────────────────────────────────
  const handlePlay = () => {
    if (isPlaying) {
      if (playRef.current) clearTimeout(playRef.current)
      setIsPlaying(false)
      triggerSpringBack()
      return
    }
    if (springRef.current) clearTimeout(springRef.current)
    setIsPlaying(true)
    setPreviewWeek(1)
    let wk = 1
    const advance = () => {
      wk++
      if (wk > 12) { setIsPlaying(false); triggerSpringBack(); return }
      setPreviewWeek(wk)
      playRef.current = setTimeout(advance, 800)
    }
    playRef.current = setTimeout(advance, 800)
  }

  const handleReset = () => {
    if (playRef.current)   clearTimeout(playRef.current)
    if (springRef.current) clearTimeout(springRef.current)
    setIsPlaying(false)
    setIsDragging(false)
    setPreviewWeek(actualWeek)
  }

  // Cleanup timers on unmount
  useEffect(() => () => {
    if (springRef.current) clearTimeout(springRef.current)
    if (playRef.current)   clearTimeout(playRef.current)
  }, [])

  // ── Node data ─────────────────────────────────────────────────────────────────
  const nodes = useMemo(() =>
    Array.from({ length: WEEK_COUNT }, (_, i) => {
      const weekNum  = i + 1
      const weekLabel = `Week ${weekNum}`
      const y        = TRUNK_BOTTOM - i * WEEK_SPACING
      const stats    = weekStats[weekLabel] || { done: 0, total: 0 }
      const pct      = stats.total > 0 ? stats.done / stats.total : 0
      return { weekNum, weekLabel, y, stats, pct }
    }),
  [weekStats])

  const currentDateRange = WEEK_DATES[`Week ${previewWeek}`] || ''

  return (
    <div style={{
      background: '#f8f5f2',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* ── Inline styles ─────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes trunkDraw {
          from { stroke-dashoffset: ${TRUNK_LENGTH}; }
          to   { stroke-dashoffset: 0; }
        }
        .g-branch, .g-node, .g-leaf {
          transition: all 0.4s ease;
        }
        .g-leaf {
          transition: opacity 0.4s ease, transform 0.4s ease;
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
        .ms-label { transition: font-size 0.15s, fill 0.15s; }
      `}</style>

      {/* ── Summary text ─────────────────────────────────────────────────────── */}
      <div style={{
        textAlign: 'center', paddingTop: 22, paddingBottom: 2,
        color: '#8a8580', fontSize: 13, letterSpacing: '0.04em',
      }}>
        {summaryText}
      </div>

      {/* ── Tree SVG — fills viewport ─────────────────────────────────────────── */}
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        width="100%"
        height="100vh"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', flex: '1 1 auto' }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Ground line */}
        <line x1={180} y1={TRUNK_BOTTOM+18} x2={620} y2={TRUNK_BOTTOM+18}
          stroke={BARE_SAND} strokeWidth={1} strokeLinecap="round"/>

        {/* Roots */}
        {[
          `M ${TRUNK_X},${TRUNK_BOTTOM+2} C ${TRUNK_X-24},${TRUNK_BOTTOM+22} ${TRUNK_X-64},${TRUNK_BOTTOM+20} ${TRUNK_X-90},${TRUNK_BOTTOM+26}`,
          `M ${TRUNK_X},${TRUNK_BOTTOM+2} C ${TRUNK_X+24},${TRUNK_BOTTOM+22} ${TRUNK_X+64},${TRUNK_BOTTOM+20} ${TRUNK_X+90},${TRUNK_BOTTOM+26}`,
          `M ${TRUNK_X-20},${TRUNK_BOTTOM+10} C ${TRUNK_X-40},${TRUNK_BOTTOM+24} ${TRUNK_X-54},${TRUNK_BOTTOM+34} ${TRUNK_X-72},${TRUNK_BOTTOM+36}`,
          `M ${TRUNK_X+20},${TRUNK_BOTTOM+10} C ${TRUNK_X+40},${TRUNK_BOTTOM+24} ${TRUNK_X+54},${TRUNK_BOTTOM+34} ${TRUNK_X+72},${TRUNK_BOTTOM+36}`,
        ].map((d, i) => (
          <path key={i} d={d} stroke={BARE_SAND}
            strokeWidth={i < 2 ? 1.5 : 1} fill="none" strokeLinecap="round"/>
        ))}

        {/* Trunk */}
        <line
          x1={TRUNK_X} y1={TRUNK_TOP} x2={TRUNK_X} y2={TRUNK_BOTTOM}
          stroke={BARK} strokeWidth={4} strokeLinecap="round"
          strokeDasharray={TRUNK_LENGTH} strokeDashoffset={0}
          style={{ animation: `trunkDraw 1.4s cubic-bezier(0.4,0,0.2,1) forwards` }}
        />

        {/* ── Week nodes ──────────────────────────────────────────────────────── */}
        {nodes.map(({ weekNum, weekLabel, y, stats, pct }) => {
          const visible     = weekNum <= previewWeek
          const isCurrent   = weekNum === previewWeek
          const isMilestone = MILESTONES[weekNum] !== undefined
          const isHovMs     = hoveredMs === weekNum

          // Determine stage — weeks after previewWeek are forced bare
          const displayPct   = visible ? pct   : 0
          const displayTotal = visible ? stats.total : 0
          const stage        = getStage(displayPct, visible, displayTotal > 0)
          const br           = stageBranch(stage)
          const leafCount    = stageLeafCount(stage)

          const seed       = weekNum * 137
          // Branch length scales with task count, but always render ghost branches
          const branchLen  = Math.round(50 + (Math.max(stats.total, 1) / maxWeekTasks) * 75)

          // Left branch + leaves
          const lEnd  = { x: TRUNK_X - branchLen, y: y - 5 }
          const lBr   = branchPath(TRUNK_X, y, lEnd.x, lEnd.y, 'left')
          const lLeaves = leafCount > 0
            ? generateLeaves(TRUNK_X, y, lEnd.x, lEnd.y, lBr.cp1x, lBr.cp1y, lBr.cp2x, lBr.cp2y, leafCount, seed)
            : []

          // Right branch + leaves
          const rEnd  = { x: TRUNK_X + branchLen, y: y - 5 }
          const rBr   = branchPath(TRUNK_X, y, rEnd.x, rEnd.y, 'right')
          const rLeaves = leafCount > 0
            ? generateLeaves(TRUNK_X, y, rEnd.x, rEnd.y, rBr.cp1x, rBr.cp1y, rBr.cp2x, rBr.cp2y, leafCount, seed + 999)
            : []

          // Node fill/stroke
          const isBloomed = stage === 'bloomed'
          const nodeFill =
            isBloomed   ? CORAL :
            stage === 'lush'    ? GREEN_FULL :
            stage === 'growing' ? GREEN_BUD  :
            stage === 'budding' ? BARE_SAND  : 'none'
          const nodeStroke =
            isBloomed   ? '#b86b50' :
            stage === 'lush'    ? '#3d6b3a' :
            stage === 'growing' ? '#5a8a4a' :
            stage === 'budding' ? BARK       : BARE_SAND
          const nodeR = isBloomed ? 9 : 6

          // Glow on current week
          const glow = isCurrent
            ? { filter: 'drop-shadow(0 0 6px #c97d60)' } as React.CSSProperties
            : {}

          const nodeEvents = {
            onMouseEnter: () => setTooltip({ x: TRUNK_X, y, week: weekLabel, done: stats.done, total: stats.total }),
            onMouseLeave: () => setTooltip(null),
            onClick:      () => onOwnerWeekFilter('All', weekLabel),
          }

          return (
            <g key={weekLabel}>
              {/* Ghost / live branches — always rendered, opacity drives presence */}
              <path d={lBr.path} stroke={br.color} strokeWidth={br.width}
                fill="none" strokeLinecap="round" opacity={br.opacity} className="g-branch"/>
              <path d={rBr.path} stroke={br.color} strokeWidth={br.width}
                fill="none" strokeLinecap="round" opacity={br.opacity} className="g-branch"/>

              {/* Leaves */}
              {[...lLeaves, ...rLeaves].map((leaf, li) => (
                <ellipse key={li}
                  cx={leaf.cx} cy={leaf.cy} rx={leaf.rx} ry={leaf.ry}
                  fill={leafColor(stage, leaf.accent)}
                  opacity={leaf.accent ? 0.72 : 0.88}
                  transform={`rotate(${leaf.angle}, ${leaf.cx}, ${leaf.cy})`}
                  className="g-leaf"
                  style={{ pointerEvents: 'none' }}
                />
              ))}

              {/* Milestone tick mark */}
              {isMilestone && (
                <line x1={TRUNK_X-8} y1={y} x2={TRUNK_X+8} y2={y}
                  stroke={BARK} strokeWidth={2} strokeLinecap="round"/>
              )}

              {/* Milestone future-hint diamond */}
              {isMilestone && !isBloomed && (
                <path d={diamondPath(TRUNK_X, y, 5)}
                  fill="none" stroke={BARE_SAND} strokeWidth={1} opacity={0.45}
                  style={{ pointerEvents: 'none' }}/>
              )}

              {/* Milestone label */}
              {isMilestone && (
                <g
                  onMouseEnter={() => setHoveredMs(weekNum)}
                  onMouseLeave={() => setHoveredMs(null)}
                  style={{ cursor: 'default' }}
                >
                  <text x={TRUNK_X + 18} y={y + 4} className="ms-label"
                    style={{
                      fontSize: isHovMs ? 12 : 11,
                      fontWeight: 500,
                      fill: isHovMs ? CORAL : BARK,
                      fontFamily: "'Inter', system-ui, sans-serif",
                    }}>
                    {MILESTONES[weekNum]}
                  </text>
                  {isHovMs && WEEK_DATES[`Week ${weekNum}`] && (
                    <text x={TRUNK_X + 18} y={y + 17}
                      style={{ fontSize: 9, fill: '#8a8580', fontFamily: "'Inter', system-ui, sans-serif" }}>
                      {WEEK_DATES[`Week ${weekNum}`]}
                    </text>
                  )}
                </g>
              )}

              {/* Week number (left of branch end) */}
              <text
                x={TRUNK_X - branchLen - 10} y={y + 4}
                textAnchor="end"
                style={{ fontSize: 9, fill: '#b0a89e', fontFamily: "'Inter', system-ui, sans-serif", pointerEvents: 'none' }}
              >
                W{weekNum}
              </text>

              {/* Node — flower when milestone bloomed, circle otherwise */}
              {isBloomed && isMilestone ? (
                <path d={flowerPath(TRUNK_X, y, 9)} fill={CORAL} stroke="#b86b50" strokeWidth={1}
                  className="g-node" style={{ cursor: 'pointer', ...glow }} {...nodeEvents}/>
              ) : (
                <circle cx={TRUNK_X} cy={y} r={nodeR}
                  fill={nodeFill} stroke={nodeStroke} strokeWidth={1.5}
                  className="g-node" style={{ cursor: 'pointer', ...glow }} {...nodeEvents}/>
              )}
            </g>
          )
        })}

        {/* Tooltip */}
        {tooltip && <Tooltip data={tooltip}/>}
      </svg>

      {/* ── Legend ───────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 20, justifyContent: 'center',
        paddingTop: 8, paddingBottom: 100,
        fontSize: 11, color: '#8a8580', alignItems: 'center',
      }}>
        {[
          { fill: 'none', stroke: BARE_SAND, label: 'Upcoming' },
          { fill: GREEN_BUD,  stroke: 'none', label: 'In progress' },
          { fill: GREEN_FULL, stroke: 'none', label: 'Lush' },
          { fill: CORAL,      stroke: 'none', label: 'Complete' },
        ].map(({ fill, stroke, label }) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width={12} height={12}>
              <circle cx={6} cy={6} r={5} fill={fill} stroke={stroke} strokeWidth={fill === 'none' ? 1.5 : 0}/>
            </svg>
            {label}
          </span>
        ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width={12} height={12}>
            <path d={diamondPath(6, 6, 4)} fill="none" stroke={BARE_SAND} strokeWidth={1}/>
          </svg>
          Milestone ahead
        </span>
      </div>

      <div style={{ textAlign: 'center', paddingBottom: 6, fontSize: 11, color: '#b0a89e' }}>
        Click any node to filter board view
      </div>

      {/* ── Time Scrubber — fixed at bottom ──────────────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(248,245,242,0.97)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderTop: '1px solid #e2d9d0',
        padding: '10px 28px 16px',
        zIndex: 50,
      }}>
        {/* Label row */}
        <div style={{
          textAlign: 'center', marginBottom: 7, minHeight: 20,
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
          {previewWeek === actualWeek && !isDragging && !isPlaying && (
            <span style={{ fontSize: 10, color: '#b0a89e', fontStyle: 'italic' }}>current</span>
          )}
        </div>

        {/* Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, maxWidth: 600, margin: '0 auto' }}>
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
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <button className="scrub-btn" onClick={handleReset}>⏮ Reset</button>
        </div>
      </div>
    </div>
  )
}
