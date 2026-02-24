import { useMemo, useState } from 'react'
import type { Task } from '../types'
import { getOwner, normalizeStatus, OWNERS } from '../types'

interface Props {
  tasks: Task[]
  onOwnerWeekFilter: (owner: string, week: string) => void
}

// ── Constants ─────────────────────────────────────────────────────────────────
const STEM_X = 110          // x of the vertical stem within each tree SVG
const SVG_W = 220           // width of each tree's SVG
const TOP_PAD = 70          // space above first branch (for owner label + progress bar)
const BOTTOM_PAD = 36       // space below last branch (for root dot)
const BRANCH_LEN = 80       // horizontal line length from stem to card
const CARD_W = 90           // card width
const CARD_H = 44           // card height
const CARD_RX = 8           // card border radius
const WEEK_COUNT = 12

// Dynamic SVG height based on number of weeks
function svgHeight(weekCount: number) {
  return TOP_PAD + (weekCount - 1) * 46 + CARD_H + BOTTOM_PAD + 20
}

// ── Seeded random (stable) ────────────────────────────────────────────────────
function seededRand(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

// ── Leaf generation along branch line ────────────────────────────────────────
function generateBranchLeaves(
  x1: number, y1: number,
  x2: number, y2: number,
  count: number,
  seed: number,
) {
  const rand = seededRand(seed)
  return Array.from({ length: count }, (_, i) => {
    const t = 0.15 + (i / (count - 1 || 1)) * 0.65 + (rand() - 0.5) * 0.08
    const lx = x1 + (x2 - x1) * t
    const ly = y1 + (y2 - y1) * t
    const angle = -50 + rand() * 100
    const rx = 5 + rand() * 4
    const ry = 2.5 + rand() * 2
    const perpY = (rand() - 0.5) * 14
    return { key: i, cx: lx, cy: ly + perpY, rx, ry, angle }
  })
}

// ── Mini progress arc (pie slice using SVG path) ──────────────────────────────
function MiniProgressCircle({ pct, r, cx, cy }: { pct: number; r: number; cx: number; cy: number }) {
  const full = pct >= 1
  const empty = pct <= 0

  if (full) {
    return <circle cx={cx} cy={cy} r={r} fill="#c97d60" />
  }
  if (empty) {
    return <circle cx={cx} cy={cy} r={r} fill="#e2d9d0" stroke="#8a8580" strokeWidth={1} />
  }

  // Pie slice arc
  const angle = pct * 2 * Math.PI - Math.PI / 2
  const x = cx + r * Math.cos(angle)
  const y = cy + r * Math.sin(angle)
  const largeArc = pct > 0.5 ? 1 : 0

  // Start from top (12 o'clock)
  const startX = cx
  const startY = cy - r

  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#e2d9d0" stroke="#8a8580" strokeWidth={1} />
      <path
        d={`M ${cx} ${cy} L ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${x} ${y} Z`}
        fill="#c97d60"
      />
    </g>
  )
}

// ── Single owner tree ─────────────────────────────────────────────────────────
interface WeekData {
  week: string
  weekNum: number
  total: number
  done: number
}

interface OwnerTreeProps {
  owner: string
  weeks: WeekData[]
  allWeeks: string[]
  onOwnerWeekFilter: (owner: string, week: string) => void
}

function OwnerTree({ owner, weeks, allWeeks, onOwnerWeekFilter }: OwnerTreeProps) {
  const [hoveredWeek, setHoveredWeek] = useState<string | null>(null)

  const weekCount = allWeeks.length || WEEK_COUNT
  const STEM_SPACING = 46
  const svgH = svgHeight(weekCount)
  const stemTop = TOP_PAD
  const stemBottom = svgH - BOTTOM_PAD

  // Overall owner completion
  const totalTasks = weeks.reduce((s, w) => s + w.total, 0)
  const doneTasks = weeks.reduce((s, w) => s + w.done, 0)
  const overallPct = totalTasks > 0 ? doneTasks / totalTasks : 0

  // Map by week label for quick lookup
  const weekMap = useMemo(() => {
    const m: Record<string, WeekData> = {}
    for (const w of weeks) m[w.week] = w
    return m
  }, [weeks])

  return (
    <svg
      width={SVG_W}
      height={svgH}
      viewBox={`0 0 ${SVG_W} ${svgH}`}
      style={{ display: 'block', overflow: 'visible', flexShrink: 0 }}
    >
      {/* ── Owner label ──────────────────────────────────────────────── */}
      <text
        x={STEM_X}
        y={18}
        textAnchor="middle"
        style={{
          fontSize: 13,
          fontVariant: 'small-caps',
          fontWeight: 600,
          fill: '#c97d60',
          letterSpacing: '0.1em',
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        {owner}
      </text>

      {/* ── Overall progress bar ─────────────────────────────────────── */}
      {/* background */}
      <rect x={STEM_X - 40} y={26} width={80} height={3} rx={1.5} fill="#e2d9d0" />
      {/* fill */}
      <rect
        x={STEM_X - 40}
        y={26}
        width={80 * overallPct}
        height={3}
        rx={1.5}
        fill="#c97d60"
      />
      {/* pct label */}
      <text
        x={STEM_X}
        y={42}
        textAnchor="middle"
        style={{
          fontSize: 10,
          fill: '#8a7060',
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        {Math.round(overallPct * 100)}% done
      </text>

      {/* ── Vertical stem ────────────────────────────────────────────── */}
      <line
        x1={STEM_X}
        y1={stemTop}
        x2={STEM_X}
        y2={stemBottom}
        stroke="#8a7060"
        strokeWidth={2}
        strokeLinecap="round"
      />

      {/* ── Root dot ─────────────────────────────────────────────────── */}
      <circle cx={STEM_X} cy={stemBottom} r={5} fill="#8a7060" />

      {/* ── Branches ─────────────────────────────────────────────────── */}
      {allWeeks.map((weekLabel, wi) => {
        const data = weekMap[weekLabel]
        const total = data?.total ?? 0
        const done = data?.done ?? 0
        const pct = total > 0 ? done / total : 0

        const branchY = stemTop + wi * STEM_SPACING
        const isLeft = wi % 2 === 0
        const branchEndX = isLeft ? STEM_X - BRANCH_LEN : STEM_X + BRANCH_LEN
        const cardX = isLeft ? STEM_X - BRANCH_LEN - CARD_W : STEM_X + BRANCH_LEN
        const cardCY = branchY

        const weekShort = weekLabel.replace(/week\s*/i, 'W')
        const isHovered = hoveredWeek === weekLabel
        const hasData = total > 0

        // Leaves along branch line
        const leaves = generateBranchLeaves(
          STEM_X, branchY,
          branchEndX, branchY,
          3,
          wi * 977 + weekLabel.length * 13,
        )

        return (
          <g key={weekLabel}>
            {/* Branch horizontal line */}
            <line
              x1={STEM_X}
              y1={branchY}
              x2={branchEndX}
              y2={branchY}
              stroke="#8a7060"
              strokeWidth={1.5}
              strokeLinecap="round"
            />

            {/* Leaves */}
            {leaves.map((leaf) => (
              <ellipse
                key={leaf.key}
                cx={leaf.cx}
                cy={leaf.cy}
                rx={leaf.rx}
                ry={leaf.ry}
                fill="#d3d9c8"
                opacity={0.7}
                transform={`rotate(${leaf.angle}, ${leaf.cx}, ${leaf.cy})`}
                style={{ pointerEvents: 'none' }}
              />
            ))}

            {/* Card */}
            {hasData && (
              <g
                onMouseEnter={() => setHoveredWeek(weekLabel)}
                onMouseLeave={() => setHoveredWeek(null)}
                onClick={() => onOwnerWeekFilter(owner, weekLabel)}
                style={{ cursor: 'pointer' }}
              >
                {/* Card shadow on hover */}
                {isHovered && (
                  <rect
                    x={cardX + 2}
                    y={cardCY - CARD_H / 2 + 3}
                    width={CARD_W}
                    height={CARD_H}
                    rx={CARD_RX}
                    fill="#8a7060"
                    opacity={0.12}
                  />
                )}

                {/* Card body */}
                <rect
                  x={cardX}
                  y={cardCY - CARD_H / 2}
                  width={CARD_W}
                  height={CARD_H}
                  rx={CARD_RX}
                  fill={isHovered ? '#fff' : '#f8f5f2'}
                  stroke={isHovered ? '#8a8580' : '#e2d9d0'}
                  strokeWidth={1}
                />

                {/* Week label */}
                <text
                  x={cardX + 10}
                  y={cardCY - CARD_H / 2 + 14}
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    fill: '#8a7060',
                    letterSpacing: '0.08em',
                    fontFamily: "'Inter', system-ui, sans-serif",
                    textTransform: 'uppercase',
                  }}
                >
                  {weekShort}
                </text>

                {/* Task count */}
                <text
                  x={cardX + 10}
                  y={cardCY + 4}
                  style={{
                    fontSize: 11,
                    fill: '#2d2a27',
                    fontFamily: "'Inter', system-ui, sans-serif",
                  }}
                >
                  {total} task{total !== 1 ? 's' : ''}
                </text>

                {/* Mini done count */}
                <text
                  x={cardX + 10}
                  y={cardCY + CARD_H / 2 - 6}
                  style={{
                    fontSize: 9,
                    fill: '#8a7060',
                    fontFamily: "'Inter', system-ui, sans-serif",
                  }}
                >
                  {done} done
                </text>

                {/* Progress circle */}
                <MiniProgressCircle
                  pct={pct}
                  r={8}
                  cx={cardX + CARD_W - 16}
                  cy={cardCY}
                />
              </g>
            )}

            {/* Empty week — small dot on stem */}
            {!hasData && (
              <circle
                cx={STEM_X}
                cy={branchY}
                r={3}
                fill="#e2d9d0"
                stroke="#8a8580"
                strokeWidth={1}
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ── Main GardenView ───────────────────────────────────────────────────────────
export function GardenView({ tasks, onOwnerWeekFilter }: Props) {
  // Sorted week list
  const allWeeks = useMemo(() => {
    const ws = new Set<string>()
    for (const t of tasks) if (t.week) ws.add(t.week)
    const sorted = Array.from(ws).sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, ''), 10) || 0
      const nb = parseInt(b.replace(/\D/g, ''), 10) || 0
      return na - nb
    })
    return sorted
  }, [tasks])

  // Summary stats
  const totalTasks = tasks.length
  const doneTasks = tasks.filter((t) => normalizeStatus(t.status) === 'done').length
  const numWeeks = allWeeks.length

  // Per-owner week data
  const ownerWeeks = useMemo(() => {
    const result: Record<string, { week: string; weekNum: number; total: number; done: number }[]> = {}
    for (const owner of OWNERS) {
      const ownerTasks = tasks.filter((t) => getOwner(t) === owner)
      result[owner] = allWeeks.map((week) => {
        const wt = ownerTasks.filter((t) => t.week === week)
        return {
          week,
          weekNum: parseInt(week.replace(/\D/g, ''), 10) || 0,
          total: wt.length,
          done: wt.filter((t) => normalizeStatus(t.status) === 'done').length,
        }
      }).filter((w) => w.total > 0)
    }
    return result
  }, [tasks, allWeeks])

  return (
    <div
      style={{
        background: '#f8f5f2',
        minHeight: '100vh',
        paddingBottom: 48,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Summary stats */}
      <div
        style={{
          textAlign: 'center',
          padding: '28px 16px 24px',
          color: '#8a7060',
          fontSize: 13,
          letterSpacing: '0.04em',
        }}
      >
        {totalTasks} tasks · {numWeeks} weeks · {OWNERS.length} contributors · {doneTasks} done
      </div>

      {/* Four trees row */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'flex-start',
          gap: 24,
          overflowX: 'auto',
          padding: '0 24px 24px',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {OWNERS.map((owner) => (
          <OwnerTree
            key={owner}
            owner={owner}
            weeks={ownerWeeks[owner]}
            allWeeks={allWeeks}
            onOwnerWeekFilter={onOwnerWeekFilter}
          />
        ))}
      </div>
    </div>
  )
}
