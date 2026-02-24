import { useMemo, useState } from 'react'
import type { Task } from '../types'
import { getOwner, normalizeStatus, OWNERS } from '../types'

interface Props {
  tasks: Task[]
  onOwnerWeekFilter: (owner: string, week: string) => void
}

interface WeekNode {
  week: string
  weekNum: number
  total: number
  done: number
}

interface OwnerBranch {
  owner: string
  nodes: WeekNode[]
  // cubic bezier control points
  p0: { x: number; y: number }
  p1: { x: number; y: number }
  p2: { x: number; y: number }
  p3: { x: number; y: number }
  labelOffset: { x: number; y: number }
}

// ── Bezier helpers ──────────────────────────────────────────────────────────
function bezierPoint(
  t: number,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
) {
  const mt = 1 - t
  return {
    x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
    y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
  }
}

function bezierPathD(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
) {
  return `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`
}

// Evenly spread t values 0..1 for n nodes, starting slightly off 0 and 1
function spreadT(n: number): number[] {
  if (n === 0) return []
  if (n === 1) return [0.45]
  return Array.from({ length: n }, (_, i) => 0.12 + (i / (n - 1)) * 0.78)
}

// ── Leaf generation (seeded, stable) ────────────────────────────────────────
function seededRand(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function generateLeaves(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  count: number,
  seed: number,
) {
  const rand = seededRand(seed)
  return Array.from({ length: count }, (_, i) => {
    const t = 0.05 + rand() * 0.9
    const pt = bezierPoint(t, p0, p1, p2, p3)
    const angle = -60 + rand() * 120
    const rx = 5 + rand() * 4
    const ry = 2.5 + rand() * 2
    const side = rand() > 0.5 ? 1 : -1
    // offset perpendicular to branch direction
    const dt = bezierPoint(Math.min(t + 0.01, 1), p0, p1, p2, p3)
    const dx = dt.x - pt.x
    const dy = dt.y - pt.y
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const perp = { x: -dy / len, y: dx / len }
    const offset = (8 + rand() * 10) * side
    return {
      key: i,
      cx: pt.x + perp.x * offset,
      cy: pt.y + perp.y * offset,
      rx,
      ry,
      angle,
    }
  })
}

// ── Node styles ──────────────────────────────────────────────────────────────
function getNodeStyle(done: number, total: number) {
  if (total === 0) return { fill: 'transparent', stroke: '#bfa88a', strokeWidth: 1.5 }
  const pct = done / total
  if (pct === 0) return { fill: 'transparent', stroke: '#bfa88a', strokeWidth: 1.5 }
  if (pct >= 1) return { fill: '#5a6847', stroke: 'none', strokeWidth: 0 }
  // growing: partial fill indicated by gradient-ish color
  const r = Math.round(0xd4 + (0x5a - 0xd4) * pct)
  const g = Math.round(0xc5 + (0x68 - 0xc5) * pct)
  const b = Math.round(0xb0 + (0x47 - 0xb0) * pct)
  const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
  return { fill: hex, stroke: '#5a6847', strokeWidth: 1.2 }
}

// 4-petal flower path centered at (cx,cy) with size s
function flowerPath(cx: number, cy: number, s: number) {
  const d = s * 0.55
  return [
    `M ${cx} ${cy}`,
    `C ${cx - d} ${cy - d * 0.3}, ${cx - d} ${cy - d * 1.1}, ${cx} ${cy - s}`,
    `C ${cx + d} ${cy - d * 1.1}, ${cx + d} ${cy - d * 0.3}, ${cx} ${cy}`,
    `C ${cx + d * 0.3} ${cy + d}, ${cx + d * 1.1} ${cy + d}, ${cx + s} ${cy}`,
    `C ${cx + d * 1.1} ${cy - d}, ${cx + d * 0.3} ${cy - d}, ${cx} ${cy}`,
    `C ${cx + d} ${cy + d * 0.3}, ${cx + d} ${cy + d * 1.1}, ${cx} ${cy + s}`,
    `C ${cx - d} ${cy + d * 1.1}, ${cx - d} ${cy + d * 0.3}, ${cx} ${cy}`,
    `C ${cx - d * 0.3} ${cy - d}, ${cx - d * 1.1} ${cy - d}, ${cx - s} ${cy}`,
    `C ${cx - d * 1.1} ${cy + d}, ${cx - d * 0.3} ${cy + d}, ${cx} ${cy}`,
    'Z',
  ].join(' ')
}

// ── Main component ───────────────────────────────────────────────────────────
const VB_W = 900
const VB_H = 680

export function GardenView({ tasks, onOwnerWeekFilter }: Props) {
  const [hoveredNode, setHoveredNode] = useState<{ owner: string; week: string } | null>(null)
  const [hoveredOwner, setHoveredOwner] = useState<string | null>(null)

  // Sorted week list
  const allWeeks = useMemo(() => {
    const ws = new Set<string>()
    for (const t of tasks) if (t.week) ws.add(t.week)
    return Array.from(ws).sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, ''), 10) || 0
      const nb = parseInt(b.replace(/\D/g, ''), 10) || 0
      return na - nb
    })
  }, [tasks])

  // Summary stats
  const totalTasks = tasks.length
  const doneTasks = tasks.filter((t) => normalizeStatus(t.status) === 'done').length
  const numWeeks = allWeeks.length

  // Branch definitions — each owner gets one cubic bezier branch
  // These are tuned to feel organic and asymmetric
  const BRANCH_DEFS: Record<string, {
    p0: { x: number; y: number }
    p1: { x: number; y: number }
    p2: { x: number; y: number }
    p3: { x: number; y: number }
    labelOffset: { x: number; y: number }
  }> = {
    Iso:   {
      p0: { x: 450, y: 410 },
      p1: { x: 390, y: 380 },
      p2: { x: 260, y: 340 },
      p3: { x: 140, y: 295 },
      labelOffset: { x: -30, y: 8 },
    },
    Yuka:  {
      p0: { x: 450, y: 390 },
      p1: { x: 510, y: 360 },
      p2: { x: 590, y: 310 },
      p3: { x: 700, y: 258 },
      labelOffset: { x: 28, y: 8 },
    },
    Carla: {
      p0: { x: 450, y: 360 },
      p1: { x: 380, y: 310 },
      p2: { x: 250, y: 255 },
      p3: { x: 105, y: 195 },
      labelOffset: { x: -30, y: 8 },
    },
    Alex:  {
      p0: { x: 450, y: 330 },
      p1: { x: 510, y: 278 },
      p2: { x: 600, y: 228 },
      p3: { x: 730, y: 168 },
      labelOffset: { x: 28, y: 8 },
    },
  }

  // Build per-owner branches with nodes
  const branches: OwnerBranch[] = useMemo(() => {
    return OWNERS.map((owner) => {
      const def = BRANCH_DEFS[owner]
      const ownerTasks = tasks.filter((t) => getOwner(t) === owner)
      const nodes: WeekNode[] = []
      for (const week of allWeeks) {
        const wt = ownerTasks.filter((t) => t.week === week)
        if (wt.length > 0) {
          nodes.push({
            week,
            weekNum: parseInt(week.replace(/\D/g, ''), 10) || 0,
            total: wt.length,
            done: wt.filter((t) => normalizeStatus(t.status) === 'done').length,
          })
        }
      }
      return { owner, nodes, ...def }
    })
  }, [tasks, allWeeks])

  // Leaves per branch (stable, seeded)
  const branchLeaves = useMemo(() => {
    return branches.map((b, i) => generateLeaves(b.p0, b.p1, b.p2, b.p3, 10, i * 1337 + 42))
  }, [branches])

  // Grass blades (stable)
  const grassBlades = useMemo(() => {
    const rand = seededRand(999)
    return Array.from({ length: 14 }, (_, i) => {
      const x = 80 + rand() * 740
      const h = 10 + rand() * 16
      const lean = (rand() - 0.5) * 18
      return { key: i, x, h, lean }
    })
  }, [])

  return (
    <div
      style={{
        background: 'var(--bg)',
        minHeight: '100vh',
        paddingBottom: 48,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Summary stats */}
      <div
        style={{
          textAlign: 'center',
          padding: '28px 16px 20px',
          color: 'var(--text-muted)',
          fontSize: 13,
          letterSpacing: '0.04em',
        }}
      >
        {totalTasks} tasks · {numWeeks} weeks · {OWNERS.length} contributors · {doneTasks} done
      </div>

      {/* SVG tree */}
      <div style={{ width: '100%' }}>
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          width="100%"
          height="auto"
          preserveAspectRatio="xMidYMid meet"
          style={{ display: 'block', maxHeight: '78vh' }}
        >
          <defs>
            {/* Clip masks for partial-fill nodes */}
            {branches.flatMap((b) =>
              b.nodes.map((node) => {
                const tValues = spreadT(b.nodes.length)
                const idx = b.nodes.indexOf(node)
                const pt = bezierPoint(tValues[idx], b.p0, b.p1, b.p2, b.p3)
                const r = 6 + node.total * 1.5
                const pct = node.total > 0 ? node.done / node.total : 0
                if (pct === 0 || pct >= 1) return null
                const clipH = r * 2 * pct
                const clipY = pt.y + r - clipH
                return (
                  <clipPath key={`clip-${b.owner}-${node.week}`} id={`clip-${b.owner}-${node.week}`}>
                    <rect x={pt.x - r - 2} y={clipY} width={r * 2 + 4} height={clipH + 2} />
                  </clipPath>
                )
              }),
            )}
          </defs>

          {/* ── Ground ─────────────────────────────────────────────────────── */}
          <path
            d={`M 20 ${VB_H - 55} C 150 ${VB_H - 62}, 400 ${VB_H - 58}, 650 ${VB_H - 60} C 780 ${VB_H - 61}, 860 ${VB_H - 56}, 880 ${VB_H - 52}`}
            fill="none"
            stroke="#c8b99a"
            strokeWidth={1.5}
            opacity={0.5}
          />

          {/* Grass blades */}
          {grassBlades.map((g) => (
            <path
              key={g.key}
              d={`M ${g.x} ${VB_H - 55} Q ${g.x + g.lean} ${VB_H - 55 - g.h * 0.6} ${g.x + g.lean * 1.4} ${VB_H - 55 - g.h}`}
              fill="none"
              stroke="#a8b890"
              strokeWidth={1}
              strokeLinecap="round"
              opacity={0.55}
            />
          ))}

          {/* ── Trunk ──────────────────────────────────────────────────────── */}
          {/* Wide base stroke (tapered via two overlapping paths) */}
          <path
            d="M 450 600 C 450 560, 450 510, 450 430"
            fill="none"
            stroke="#735e47"
            strokeWidth={14}
            strokeLinecap="round"
          />
          <path
            d="M 450 490 C 450 470, 450 450, 450 350"
            fill="none"
            stroke="#735e47"
            strokeWidth={7}
            strokeLinecap="round"
          />
          {/* Slight texture line */}
          <path
            d="M 449 580 C 448 540, 451 490, 449 430"
            fill="none"
            stroke="#8b7355"
            strokeWidth={1.5}
            opacity={0.3}
            strokeLinecap="round"
          />

          {/* ── Branches ───────────────────────────────────────────────────── */}
          {branches.map((b) => {
            const isOwnerHov = hoveredOwner === b.owner
            const tValues = spreadT(b.nodes.length)

            return (
              <g
                key={`branch-${b.owner}`}
                onMouseEnter={() => setHoveredOwner(b.owner)}
                onMouseLeave={() => setHoveredOwner(null)}
                style={{ cursor: 'default' }}
              >
                {/* Branch curve */}
                <path
                  d={bezierPathD(b.p0, b.p1, b.p2, b.p3)}
                  fill="none"
                  stroke={isOwnerHov ? '#5a4832' : '#8b7355'}
                  strokeWidth={isOwnerHov ? 5 : 4}
                  strokeLinecap="round"
                  style={{ transition: 'stroke 0.2s, stroke-width 0.15s' }}
                />

                {/* Decorative leaves */}
                {branchLeaves[branches.indexOf(b)].map((leaf) => (
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

                {/* Owner label at branch tip */}
                <text
                  x={b.p3.x + b.labelOffset.x}
                  y={b.p3.y + b.labelOffset.y}
                  textAnchor="middle"
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    fontVariant: 'small-caps',
                    fill: isOwnerHov ? 'var(--text-secondary, #6b5e50)' : 'var(--text-muted, #9a8c7e)',
                    letterSpacing: '0.12em',
                    fontFamily: "'Inter', system-ui, sans-serif",
                    transition: 'fill 0.2s',
                    pointerEvents: 'none',
                  }}
                >
                  {b.owner.toUpperCase()}
                </text>

                {/* ── Nodes along the branch ─────────────────────────────── */}
                {b.nodes.map((node, ni) => {
                  const t = tValues[ni]
                  const pt = bezierPoint(t, b.p0, b.p1, b.p2, b.p3)
                  const r = 6 + node.total * 1.5
                  const pct = node.total > 0 ? node.done / node.total : 0
                  const style = getNodeStyle(node.done, node.total)
                  const isHovNode = hoveredNode?.owner === b.owner && hoveredNode?.week === node.week
                  const isHovBranch = isOwnerHov
                  const displayR = isHovNode ? r + 2.5 : isHovBranch ? r + 1 : r
                  const clipId = `clip-${b.owner}-${node.week}`
                  const bloomed = pct >= 1
                  const weekLabel = node.week.replace('Week ', 'W').replace('week ', 'W')

                  return (
                    <g
                      key={`node-${b.owner}-${node.week}`}
                      onMouseEnter={() => setHoveredNode({ owner: b.owner, week: node.week })}
                      onMouseLeave={() => setHoveredNode(null)}
                      onClick={() => onOwnerWeekFilter(b.owner, node.week)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Hover glow */}
                      {isHovNode && (
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={displayR + 7}
                          fill={bloomed ? '#5a6847' : '#d4c5b0'}
                          opacity={0.18}
                          style={{ pointerEvents: 'none' }}
                        />
                      )}

                      {bloomed ? (
                        /* 100% done → flower shape */
                        <path
                          d={flowerPath(pt.x, pt.y, displayR * 0.85)}
                          fill="#5a6847"
                          style={{
                            transition: 'transform 0.15s',
                            transformOrigin: `${pt.x}px ${pt.y}px`,
                            pointerEvents: 'all',
                          }}
                        />
                      ) : pct > 0 ? (
                        /* 1–99% done → circle with partial fill overlay */
                        <>
                          {/* Base circle (stroke only) */}
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={displayR}
                            fill="transparent"
                            stroke={style.stroke}
                            strokeWidth={style.strokeWidth}
                          />
                          {/* Fill overlay clipped to bottom portion */}
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={displayR}
                            fill={style.fill}
                            clipPath={`url(#${clipId})`}
                            style={{ pointerEvents: 'none' }}
                          />
                        </>
                      ) : (
                        /* 0% done → bud (stroke only) */
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={displayR}
                          fill="transparent"
                          stroke="#bfa88a"
                          strokeWidth={1.5}
                        />
                      )}

                      {/* Week label */}
                      <text
                        x={pt.x}
                        y={pt.y + displayR + 11}
                        textAnchor="middle"
                        style={{
                          fontSize: 9,
                          fill: '#bfa88a',
                          fontFamily: "'Inter', system-ui, sans-serif",
                          pointerEvents: 'none',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {weekLabel}
                      </text>

                      {/* Tooltip */}
                      {isHovNode && (() => {
                        const tw = 130
                        const th = 42
                        const tx = Math.min(Math.max(pt.x - tw / 2, 4), VB_W - tw - 4)
                        const ty = pt.y - displayR - th - 10
                        return (
                          <g style={{ pointerEvents: 'none' }}>
                            <rect
                              x={tx}
                              y={ty}
                              width={tw}
                              height={th}
                              rx={5}
                              fill="#2d251d"
                              opacity={0.93}
                            />
                            <text
                              x={tx + tw / 2}
                              y={ty + 15}
                              textAnchor="middle"
                              style={{
                                fontSize: 10,
                                fill: '#faf8f5',
                                fontWeight: 500,
                                fontFamily: "'Inter', system-ui, sans-serif",
                              }}
                            >
                              {node.week} · {node.done} / {node.total} done
                            </text>
                            <text
                              x={tx + tw / 2}
                              y={ty + 30}
                              textAnchor="middle"
                              style={{
                                fontSize: 9,
                                fill: '#bfa88a',
                                fontFamily: "'Inter', system-ui, sans-serif",
                              }}
                            >
                              click to filter board
                            </text>
                          </g>
                        )
                      })()}
                    </g>
                  )
                })}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
