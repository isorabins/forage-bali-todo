import { useMemo, useState, useEffect } from 'react'
import type { Task } from '../types'
import { normalizeStatus, WEEK_DATES } from '../types'

interface Props {
  tasks: Task[]
  onOwnerWeekFilter: (owner: string, week: string) => void
}

// ── Constants ─────────────────────────────────────────────────────────────────
const SVG_W = 600
const SVG_H = 700
const TRUNK_X = 300
const TRUNK_BOTTOM = 640
const TRUNK_TOP = 90
const WEEK_COUNT = 12
const WEEK_SPACING = (TRUNK_BOTTOM - TRUNK_TOP) / (WEEK_COUNT - 1) // ~50

const MILESTONES: Record<number, string> = {
  1: 'Foundation',
  3: 'Noko goes live',
  6: 'First beta class',
  9: 'First paid class',
  12: 'Scale',
}

const TRUNK_LENGTH = TRUNK_BOTTOM - TRUNK_TOP // 550

// ── Seeded random (stable across renders) ─────────────────────────────────────
function seededRand(seed: number) {
  let s = seed | 0
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) | 0
    return (s >>> 0) / 0xffffffff
  }
}

// ── Bezier point at parameter t ────────────────────────────────────────────────
function bezierPoint(
  p0x: number, p0y: number,
  p1x: number, p1y: number,
  p2x: number, p2y: number,
  p3x: number, p3y: number,
  t: number,
): [number, number] {
  const mt = 1 - t
  const x = mt * mt * mt * p0x + 3 * mt * mt * t * p1x + 3 * mt * t * t * p2x + t * t * t * p3x
  const y = mt * mt * mt * p0y + 3 * mt * mt * t * p1y + 3 * mt * t * t * p2y + t * t * t * p3y
  return [x, y]
}

// ── Branch bezier path builder ─────────────────────────────────────────────────
function branchPath(
  sx: number, sy: number,
  ex: number, ey: number,
  direction: 'left' | 'right',
): { path: string; cp1x: number; cp1y: number; cp2x: number; cp2y: number } {
  const sign = direction === 'left' ? -1 : 1
  const dx = Math.abs(ex - sx)
  const cp1x = sx + sign * dx * 0.25
  const cp1y = sy - 16
  const cp2x = sx + sign * dx * 0.75
  const cp2y = ey - 8
  return {
    path: `M ${sx},${sy} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${ex},${ey}`,
    cp1x, cp1y, cp2x, cp2y,
  }
}

// ── Leaf component ─────────────────────────────────────────────────────────────
interface Leaf {
  cx: number
  cy: number
  rx: number
  ry: number
  angle: number
  accent: boolean
}

function generateLeaves(
  sx: number, sy: number,
  ex: number, ey: number,
  cp1x: number, cp1y: number,
  cp2x: number, cp2y: number,
  count: number,
  seedOffset: number,
): Leaf[] {
  const rand = seededRand(seedOffset)
  return Array.from({ length: count }, (_, i) => {
    const t = 0.1 + (i / Math.max(count - 1, 1)) * 0.75 + (rand() - 0.5) * 0.08
    const tc = Math.max(0, Math.min(1, t))
    const [bx, by] = bezierPoint(sx, sy, cp1x, cp1y, cp2x, cp2y, ex, ey, tc)
    const perp = (rand() - 0.5) * 18
    const perpX = (rand() - 0.5) * 8
    const angle = -60 + rand() * 120
    const rx = 5 + rand() * 4
    const ry = 2.5 + rand() * 2.5
    const accent = rand() < 0.25
    return { cx: bx + perpX, cy: by + perp, rx, ry, angle, accent }
  })
}

// ── Tooltip ────────────────────────────────────────────────────────────────────
interface TooltipData {
  x: number
  y: number
  week: string
  done: number
  total: number
}

function Tooltip({ data }: { data: TooltipData }) {
  const weekNum = parseInt(data.week.replace(/\D/g, ''), 10)
  const dateRange = WEEK_DATES[`Week ${weekNum}`] || ''
  return (
    <g style={{ pointerEvents: 'none' }}>
      <rect
        x={data.x - 72}
        y={data.y - 38}
        width={144}
        height={32}
        rx={6}
        fill="#2d2a27"
        opacity={0.92}
      />
      <text
        x={data.x}
        y={data.y - 22}
        textAnchor="middle"
        style={{ fontSize: 11, fill: '#f8f5f2', fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 500 }}
      >
        {data.week} · {data.done} done / {data.total} total
      </text>
      {dateRange && (
        <text
          x={data.x}
          y={data.y - 10}
          textAnchor="middle"
          style={{ fontSize: 9, fill: '#d4c5b0', fontFamily: "'Inter', system-ui, sans-serif" }}
        >
          {dateRange}
        </text>
      )}
    </g>
  )
}

// ── Main GardenView ────────────────────────────────────────────────────────────
export function GardenView({ tasks, onOwnerWeekFilter }: Props) {
  const [leavesVisible, setLeavesVisible] = useState(false)
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const [hoveredMilestone, setHoveredMilestone] = useState<number | null>(null)

  // Kick off animation sequence
  useEffect(() => {
    const trunkDuration = 1200 // ms
    const t2 = setTimeout(() => setLeavesVisible(true), trunkDuration + 500)
    return () => { clearTimeout(t2) }
  }, [])

  // Build week stats (all owners combined)
  const weekStats = useMemo(() => {
    const map: Record<string, { done: number; total: number }> = {}
    for (const task of tasks) {
      if (!task.week) continue
      if (!map[task.week]) map[task.week] = { done: 0, total: 0 }
      map[task.week].total++
      if (normalizeStatus(task.status) === 'done') map[task.week].done++
    }
    return map
  }, [tasks])

  const totalDone = tasks.filter(t => normalizeStatus(t.status) === 'done').length
  const totalTasks = tasks.length

  // Max tasks across weeks (for branch length scaling)
  const maxWeekTasks = useMemo(() => {
    const vals = Object.values(weekStats).map(w => w.total)
    return Math.max(...vals, 1)
  }, [weekStats])

  // Node positions
  const nodes = useMemo(() =>
    Array.from({ length: WEEK_COUNT }, (_, i) => {
      const weekNum = i + 1
      const weekLabel = `Week ${weekNum}`
      const y = TRUNK_BOTTOM - i * WEEK_SPACING
      const stats = weekStats[weekLabel] || { done: 0, total: 0 }
      const isDone = stats.total > 0 && stats.done >= stats.total
      const pct = stats.total > 0 ? stats.done / stats.total : 0
      return { weekNum, weekLabel, y, stats, isDone, pct }
    }), [weekStats])

  return (
    <div
      style={{
        background: '#f8f5f2',
        minHeight: '100vh',
        paddingBottom: 48,
        fontFamily: "'Inter', system-ui, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Inline keyframe styles */}
      <style>{`
        @keyframes trunkDraw {
          from { stroke-dashoffset: ${TRUNK_LENGTH}; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes leafFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .garden-leaf {
          transition: opacity 0.6s ease;
        }
        .milestone-label {
          transition: font-size 0.15s ease, fill 0.15s ease;
        }
      `}</style>

      {/* Completion counter */}
      <div
        style={{
          textAlign: 'center',
          paddingTop: 24,
          paddingBottom: 4,
          color: '#8a8580',
          fontSize: 13,
          letterSpacing: '0.04em',
        }}
      >
        {totalDone} of {totalTasks || 220} tasks complete
      </div>

      {/* The tree SVG */}
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        width="100%"
        height="auto"
        style={{ maxWidth: 600, display: 'block' }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* ── Ground line ──────────────────────────────────────────────── */}
        <line
          x1={160} y1={TRUNK_BOTTOM + 14}
          x2={440} y2={TRUNK_BOTTOM + 14}
          stroke="#d4c5b0"
          strokeWidth={1}
          strokeLinecap="round"
        />

        {/* ── Roots (decorative) ────────────────────────────────────────── */}
        <path
          d={`M ${TRUNK_X},${TRUNK_BOTTOM + 2} C ${TRUNK_X - 20},${TRUNK_BOTTOM + 18} ${TRUNK_X - 50},${TRUNK_BOTTOM + 16} ${TRUNK_X - 70},${TRUNK_BOTTOM + 22}`}
          stroke="#d4c5b0" strokeWidth={1.5} fill="none" strokeLinecap="round"
        />
        <path
          d={`M ${TRUNK_X},${TRUNK_BOTTOM + 2} C ${TRUNK_X + 20},${TRUNK_BOTTOM + 18} ${TRUNK_X + 50},${TRUNK_BOTTOM + 16} ${TRUNK_X + 70},${TRUNK_BOTTOM + 22}`}
          stroke="#d4c5b0" strokeWidth={1.5} fill="none" strokeLinecap="round"
        />
        <path
          d={`M ${TRUNK_X - 15},${TRUNK_BOTTOM + 8} C ${TRUNK_X - 30},${TRUNK_BOTTOM + 20} ${TRUNK_X - 40},${TRUNK_BOTTOM + 28} ${TRUNK_X - 55},${TRUNK_BOTTOM + 30}`}
          stroke="#d4c5b0" strokeWidth={1} fill="none" strokeLinecap="round"
        />
        <path
          d={`M ${TRUNK_X + 15},${TRUNK_BOTTOM + 8} C ${TRUNK_X + 30},${TRUNK_BOTTOM + 20} ${TRUNK_X + 40},${TRUNK_BOTTOM + 28} ${TRUNK_X + 55},${TRUNK_BOTTOM + 30}`}
          stroke="#d4c5b0" strokeWidth={1} fill="none" strokeLinecap="round"
        />

        {/* ── Trunk ─────────────────────────────────────────────────────── */}
        <line
          x1={TRUNK_X} y1={TRUNK_TOP}
          x2={TRUNK_X} y2={TRUNK_BOTTOM}
          stroke="#5c5853"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={TRUNK_LENGTH}
          strokeDashoffset={0}
          style={{
            animation: `trunkDraw 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards`,
          }}
        />

        {/* ── Branches, leaves, nodes ───────────────────────────────────── */}
        {nodes.map(({ weekNum, weekLabel, y, stats, isDone, pct }) => {
          const { done, total } = stats
          const seed = weekNum * 137

          // Branch length: 40–90px based on task count
          const branchLen = total > 0
            ? Math.round(40 + (total / maxWeekTasks) * 55)
            : 30

          // Leaf count along branch: 0 to 5 based on completion
          const leafCount = total > 0 ? Math.max(1, Math.round(pct * 5)) : 0

          // Left branch
          const leftEnd = { x: TRUNK_X - branchLen, y: y - 4 }
          const leftBranch = branchPath(TRUNK_X, y, leftEnd.x, leftEnd.y, 'left')
          const leftLeaves = leafCount > 0
            ? generateLeaves(TRUNK_X, y, leftEnd.x, leftEnd.y, leftBranch.cp1x, leftBranch.cp1y, leftBranch.cp2x, leftBranch.cp2y, leafCount, seed)
            : []

          // Right branch
          const rightEnd = { x: TRUNK_X + branchLen, y: y - 4 }
          const rightBranch = branchPath(TRUNK_X, y, rightEnd.x, rightEnd.y, 'right')
          const rightLeaves = leafCount > 0
            ? generateLeaves(TRUNK_X, y, rightEnd.x, rightEnd.y, rightBranch.cp1x, rightBranch.cp1y, rightBranch.cp2x, rightBranch.cp2y, leafCount, seed + 999)
            : []

          const isMilestone = MILESTONES[weekNum] !== undefined
          const isHovMilestone = hoveredMilestone === weekNum

          return (
            <g key={weekLabel}>
              {/* ── Branches ──────────────────────────────────────────── */}
              {total > 0 && (
                <>
                  <path d={leftBranch.path} stroke="#8a8580" strokeWidth={1.5} fill="none" strokeLinecap="round" />
                  <path d={rightBranch.path} stroke="#8a8580" strokeWidth={1.5} fill="none" strokeLinecap="round" />

                  {/* Filled dots along branch (done tasks feel) */}
                  {done > 0 && (() => {
                    const dotCount = Math.min(done, 4)
                    const rand = seededRand(seed + 42)
                    const dots = []
                    for (let d = 0; d < dotCount; d++) {
                      const t = 0.2 + (d / Math.max(dotCount - 1, 1)) * 0.6
                      const [lx, ly] = bezierPoint(TRUNK_X, y, leftBranch.cp1x, leftBranch.cp1y, leftBranch.cp2x, leftBranch.cp2y, leftEnd.x, leftEnd.y, t)
                      const [rx2, ry2] = bezierPoint(TRUNK_X, y, rightBranch.cp1x, rightBranch.cp1y, rightBranch.cp2x, rightBranch.cp2y, rightEnd.x, rightEnd.y, t)
                      const r = 2 + rand() * 1.5
                      dots.push(
                        <circle key={`ld${d}`} cx={lx} cy={ly} r={r} fill="#c97d60" opacity={0.7} />,
                        <circle key={`rd${d}`} cx={rx2} cy={ry2} r={r} fill="#c97d60" opacity={0.7} />,
                      )
                    }
                    return dots
                  })()}
                </>
              )}

              {/* ── Leaves ─────────────────────────────────────────────── */}
              {leavesVisible && [...leftLeaves, ...rightLeaves].map((leaf, li) => (
                <ellipse
                  key={li}
                  cx={leaf.cx}
                  cy={leaf.cy}
                  rx={leaf.rx}
                  ry={leaf.ry}
                  fill={leaf.accent ? '#c97d60' : '#d4c5b0'}
                  opacity={leaf.accent ? 0.4 : 0.75}
                  transform={`rotate(${leaf.angle}, ${leaf.cx}, ${leaf.cy})`}
                  className="garden-leaf"
                  style={{ pointerEvents: 'none' }}
                />
              ))}

              {/* ── Milestone tick ─────────────────────────────────────── */}
              {isMilestone && (
                <line
                  x1={TRUNK_X - 6} y1={y}
                  x2={TRUNK_X + 6} y2={y}
                  stroke="#5c5853" strokeWidth={2} strokeLinecap="round"
                />
              )}

              {/* ── Milestone label ────────────────────────────────────── */}
              {isMilestone && (
                <g
                  onMouseEnter={() => setHoveredMilestone(weekNum)}
                  onMouseLeave={() => setHoveredMilestone(null)}
                  style={{ cursor: 'default' }}
                >
                  <text
                    x={TRUNK_X + 14}
                    y={y + 4}
                    className="milestone-label"
                    style={{
                      fontSize: isHovMilestone ? 12 : 11,
                      fontWeight: 500,
                      fill: isHovMilestone ? '#c97d60' : '#5c5853',
                      fontFamily: "'Inter', system-ui, sans-serif",
                      transition: 'font-size 0.15s, fill 0.15s',
                    }}
                  >
                    {MILESTONES[weekNum]}
                  </text>
                  {isHovMilestone && WEEK_DATES[`Week ${weekNum}`] && (
                    <text
                      x={TRUNK_X + 14}
                      y={y + 16}
                      style={{
                        fontSize: 9,
                        fill: '#8a8580',
                        fontFamily: "'Inter', system-ui, sans-serif",
                      }}
                    >
                      {WEEK_DATES[`Week ${weekNum}`]}
                    </text>
                  )}
                </g>
              )}

              {/* ── Trunk node (clickable circle) ───────────────────────── */}
              <circle
                cx={TRUNK_X}
                cy={y}
                r={6}
                fill={isDone ? '#c97d60' : pct > 0 ? '#e8c5b4' : '#e2d9d0'}
                stroke={isDone ? '#c97d60' : '#8a8580'}
                strokeWidth={1.5}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() =>
                  setTooltip({ x: TRUNK_X, y, week: weekLabel, done, total })
                }
                onMouseLeave={() => setTooltip(null)}
                onClick={() => onOwnerWeekFilter('All', weekLabel)}
              />
            </g>
          )
        })}

        {/* ── Tooltip ───────────────────────────────────────────────────── */}
        {tooltip && <Tooltip data={tooltip} />}
      </svg>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: 20,
          marginTop: 8,
          fontSize: 11,
          color: '#8a8580',
          alignItems: 'center',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width={12} height={12}>
            <circle cx={6} cy={6} r={5} fill="#e2d9d0" stroke="#8a8580" strokeWidth={1.5} />
          </svg>
          Upcoming
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width={12} height={12}>
            <circle cx={6} cy={6} r={5} fill="#c97d60" />
          </svg>
          Complete
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width={12} height={12}>
            <circle cx={6} cy={6} r={3} fill="#c97d60" opacity={0.7} />
          </svg>
          Progress dots
        </span>
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: '#b0a89e' }}>
        Click any week node to filter board view
      </div>
    </div>
  )
}
