import { useEffect, useMemo, useRef, useState } from 'react'
import type { Task } from '../types'
import { getOwner, normalizeStatus, OWNERS } from '../types'

interface Props {
  tasks: Task[]
  onOwnerWeekFilter: (owner: string, week: string) => void
}

interface WeekNode {
  week: string
  total: number
  done: number
}

interface OwnerData {
  owner: string
  nodesByWeek: Record<string, WeekNode>
}

const OWNER_STEM_COLORS: Record<string, string> = {
  Iso: '#7a8c65',
  Yuka: '#9c7060',
  Carla: '#8a8780',
  Alex: '#8a7262',
}

// Interpolate between two hex colors
function lerpColor(hexA: string, hexB: string, t: number): string {
  const a = parseInt(hexA.slice(1), 16)
  const b = parseInt(hexB.slice(1), 16)
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bv = Math.round(ab + (bb - ab) * t)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bv.toString(16).padStart(2, '0')}`
}

function getNodeStyle(done: number, total: number): { fill: string; stroke: string; strokeWidth: number } {
  if (total === 0) return { fill: '#f5f0ea', stroke: '#d4c5b0', strokeWidth: 1 }
  const pct = done / total
  if (pct === 0) return { fill: '#e6ddd0', stroke: '#bfa88a', strokeWidth: 1.5 }
  const fill = lerpColor('#d4c5b0', '#5a6847', pct)
  return { fill, stroke: fill, strokeWidth: 0 }
}

export function GardenView({ tasks, onOwnerWeekFilter }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svgWidth, setSvgWidth] = useState(720)
  const [hovered, setHovered] = useState<{ owner: string; week: string } | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80)
    return () => clearTimeout(t)
  }, [])

  // Measure container
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(() => {
      setSvgWidth(Math.max(480, el.clientWidth))
    })
    obs.observe(el)
    setSvgWidth(Math.max(480, el.clientWidth))
    return () => obs.disconnect()
  }, [])

  // Sorted weeks
  const allWeeks = useMemo(() => {
    const ws = new Set<string>()
    for (const t of tasks) {
      if (t.week) ws.add(t.week)
    }
    return Array.from(ws).sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, '')) || 0
      const nb = parseInt(b.replace(/\D/g, '')) || 0
      return na - nb
    })
  }, [tasks])

  // Build per-owner data
  const ownerData: OwnerData[] = useMemo(() => {
    return OWNERS.map((owner) => {
      const ownerTasks = tasks.filter((t) => getOwner(t) === owner)
      const nodesByWeek: Record<string, WeekNode> = {}
      for (const week of allWeeks) {
        const wt = ownerTasks.filter((t) => t.week === week)
        if (wt.length > 0) {
          nodesByWeek[week] = {
            week,
            total: wt.length,
            done: wt.filter((t) => normalizeStatus(t.status) === 'done').length,
          }
        }
      }
      return { owner, nodesByWeek }
    })
  }, [tasks, allWeeks])

  // Summary stats
  const totalTasks = tasks.length
  const doneTasks = tasks.filter((t) => normalizeStatus(t.status) === 'done').length
  const remainingTasks = totalTasks - doneTasks
  const numContributors = OWNERS.filter((o) => tasks.some((t) => getOwner(t) === o)).length

  // Layout constants
  const NODE_STEP = 56   // vertical spacing per week
  const SVG_PAD_TOP = 56
  const SVG_PAD_BOTTOM = 56
  const maxTotal = Math.max(...ownerData.flatMap((od) =>
    Object.values(od.nodesByWeek).map((n) => n.total)
  ), 1)

  const numWeeks = allWeeks.length || 1
  const svgHeight = SVG_PAD_TOP + (numWeeks - 1) * NODE_STEP + SVG_PAD_BOTTOM + 20

  // Column centers: split the SVG width into 4 equal parts
  const colWidth = svgWidth / 4
  function colCx(colIdx: number) {
    return colWidth * colIdx + colWidth / 2
  }

  // Y position for a week index (week 0 = oldest = bottom, last = top)
  function weekY(weekIdx: number) {
    const reversedIdx = numWeeks - 1 - weekIdx
    return SVG_PAD_TOP + reversedIdx * NODE_STEP
  }

  // Node radius: 6–18px based on task count
  function nodeR(total: number) {
    return 6 + ((total / maxTotal) ** 0.6) * 12
  }

  // Stem path: slightly curved quadratic bezier
  function stemPath(cx: number, colIdx: number) {
    const y0 = weekY(numWeeks - 1)  // top (latest week)
    const y1 = weekY(0)              // bottom (oldest week)
    const cpx = cx + (colIdx % 2 === 0 ? 10 : -10)
    const cpy = (y0 + y1) / 2
    return `M ${cx} ${y0 - 20} Q ${cpx} ${cpy} ${cx} ${y1 + 20}`
  }

  let nodeAnimIdx = 0

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', paddingBottom: 48 }}>
      {/* Summary strip */}
      <div
        style={{
          textAlign: 'center',
          padding: '28px 16px 20px',
          color: 'var(--text-muted)',
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: 14, letterSpacing: '0.02em' }}>
          {totalTasks} tasks · {allWeeks.length} weeks · {numContributors} contributors
        </div>
        <div style={{ marginTop: 5, fontSize: 12, color: '#bfa88a' }}>
          {doneTasks} done · {remainingTasks} remaining
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)', margin: '0 24px 8px' }} />

      {/* SVG garden */}
      <div ref={containerRef} style={{ width: '100%', overflowX: 'auto', overflowY: 'visible' }}>
        <svg
          width={svgWidth}
          height={svgHeight}
          style={{ display: 'block' }}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        >
          {/* Owner column labels */}
          {ownerData.map((od, colIdx) => (
            <text
              key={`label-${od.owner}`}
              x={colCx(colIdx)}
              y={SVG_PAD_TOP - 20}
              textAnchor="middle"
              style={{
                fontSize: 11,
                fontWeight: 600,
                fill: OWNER_STEM_COLORS[od.owner] || '#8b7355',
                fontFamily: "'Inter', system-ui, sans-serif",
                letterSpacing: '0.12em',
              }}
            >
              {od.owner.toUpperCase()}
            </text>
          ))}

          {/* Week labels on the left */}
          {allWeeks.map((week, weekIdx) => (
            <text
              key={`wlabel-${week}`}
              x={8}
              y={weekY(weekIdx) + 4}
              style={{
                fontSize: 9,
                fill: '#bfa88a',
                fontFamily: "'Inter', system-ui, sans-serif",
                letterSpacing: '0.04em',
              }}
            >
              {week}
            </text>
          ))}

          {/* Horizontal week grid lines (very faint) */}
          {allWeeks.map((week, weekIdx) => (
            <line
              key={`grid-${week}`}
              x1={32}
              y1={weekY(weekIdx)}
              x2={svgWidth - 8}
              y2={weekY(weekIdx)}
              stroke="#e6ddd0"
              strokeWidth={0.5}
              opacity={0.4}
            />
          ))}

          {/* Stems and nodes per owner */}
          {ownerData.map((od, colIdx) => {
            const cx = colCx(colIdx)
            const stemColor = OWNER_STEM_COLORS[od.owner] || '#d4c5b0'

            return (
              <g key={`owner-${od.owner}`}>
                {/* Curved stem */}
                {numWeeks > 1 && (
                  <path
                    d={stemPath(cx, colIdx)}
                    fill="none"
                    stroke={stemColor}
                    strokeWidth={1.5}
                    opacity={0.35}
                    strokeLinecap="round"
                  />
                )}

                {/* Nodes — one per week (if tasks exist) */}
                {allWeeks.map((week, weekIdx) => {
                  const node = od.nodesByWeek[week]
                  if (!node) return null

                  const ny = weekY(weekIdx)
                  const r = nodeR(node.total)
                  const { fill, stroke, strokeWidth } = getNodeStyle(node.done, node.total)
                  const isHov = hovered?.owner === od.owner && hovered?.week === week
                  const currentAnimIdx = nodeAnimIdx++
                  const delayMs = currentAnimIdx * 50 + 100

                  return (
                    <g key={`node-${od.owner}-${week}`}>
                      {/* Outer glow on hover */}
                      {isHov && (
                        <circle
                          cx={cx}
                          cy={ny}
                          r={r + 6}
                          fill={fill}
                          opacity={0.2}
                        />
                      )}

                      <circle
                        cx={cx}
                        cy={ny}
                        r={isHov ? r + 2 : r}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        style={{
                          cursor: 'pointer',
                          opacity: mounted ? 1 : 0,
                          transition: `opacity 0.4s ${delayMs}ms, r 0.15s`,
                        }}
                        onMouseEnter={() => setHovered({ owner: od.owner, week })}
                        onMouseLeave={() => setHovered(null)}
                        onClick={() => onOwnerWeekFilter(od.owner, week)}
                      />

                      {/* Small done count inside large nodes */}
                      {r >= 12 && node.total > 0 && (
                        <text
                          x={cx}
                          y={ny + 3.5}
                          textAnchor="middle"
                          style={{
                            fontSize: 9,
                            fill: node.done / node.total > 0.5 ? 'rgba(255,255,255,0.9)' : '#8b7355',
                            fontFamily: "'Inter', system-ui, sans-serif",
                            fontWeight: 600,
                            pointerEvents: 'none',
                            opacity: mounted ? 1 : 0,
                            transition: `opacity 0.4s ${delayMs + 100}ms`,
                          }}
                        >
                          {node.done}/{node.total}
                        </text>
                      )}

                      {/* Tooltip */}
                      {isHov && (
                        <g>
                          <rect
                            x={cx - 58}
                            y={ny - r - 46}
                            width={116}
                            height={38}
                            rx={5}
                            fill="#2d251d"
                            opacity={0.92}
                          />
                          <text
                            x={cx}
                            y={ny - r - 30}
                            textAnchor="middle"
                            style={{
                              fontSize: 10,
                              fill: '#faf8f5',
                              fontFamily: "'Inter', system-ui, sans-serif",
                              fontWeight: 500,
                            }}
                          >
                            {node.week} · {node.done}/{node.total} done
                          </text>
                          <text
                            x={cx}
                            y={ny - r - 16}
                            textAnchor="middle"
                            style={{
                              fontSize: 9,
                              fill: '#bfa88a',
                              fontFamily: "'Inter', system-ui, sans-serif",
                            }}
                          >
                            tap to filter board
                          </text>
                        </g>
                      )}
                    </g>
                  )
                })}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 28,
          marginTop: 24,
          fontSize: 11,
          color: 'var(--text-muted)',
          letterSpacing: '0.04em',
          fontFamily: "'Inter', system-ui, sans-serif",
          flexWrap: 'wrap',
          padding: '0 16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#5a6847' }} />
          All done
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#9ab086' }} />
          Partial
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#e6ddd0', border: '1.5px solid #bfa88a' }} />
          Not started
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#e6ddd0', transform: 'scale(0.7)' }} />
          Node size = task count
        </div>
      </div>
    </div>
  )
}
