import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import type { Task } from '../types'
import { normalizeStatus, WEEK_DATES } from '../types'

interface Props {
  tasks: Task[]
  onOwnerWeekFilter: (owner: string, week: string) => void
}

const MILESTONE_WEEKS = new Set([3, 6, 9, 12])

function computeActualWeek(): number {
  const now = new Date()
  const start = new Date('2026-02-24')
  const diff = Math.floor((now.getTime() - start.getTime()) / 86_400_000)
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
  const [isPlaying, setIsPlaying] = useState(false)

  const springRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isPlayingRef = useRef(false)

  const triggerSpringBack = useCallback(() => {
    if (springRef.current) clearTimeout(springRef.current)
    const start = previewWeekRef.current
    const end = actualWeek
    if (start === end) return
    const dir = end > start ? 1 : -1
    const steps = Math.abs(end - start)
    const stepMs = Math.max(40, Math.round(600 / steps))
    let current = start
    const tick = () => {
      current += dir
      setPreviewWeek(current)
      if (current !== end) springRef.current = setTimeout(tick, stepMs)
    }
    springRef.current = setTimeout(tick, 60)
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
  const totalTasks = tasks.length || 220

  const displayWeek = previewWeek
  const progress = (displayWeek - 1) / 11   // 0 → 1

  // ── Image filter: dim + desaturated at W1, full vivid at W12 ─────────────────
  const brightness = 0.25 + progress * 0.8   // 0.25 → 1.05
  const saturate   = 0.1  + progress * 1.1   // 0.1  → 1.2
  const imageFilter = `brightness(${brightness.toFixed(2)}) saturate(${saturate.toFixed(2)})`

  // ── Overlay darkness: heavy veil at W1, transparent at W12 ───────────────────
  const veilOpacity = 0.55 - progress * 0.55  // 0.55 → 0

  // ── Milestone bloom: radial glow from center when at a milestone week ─────────
  const isMilestone = MILESTONE_WEEKS.has(displayWeek)

  const currentDateRange = WEEK_DATES[`Week ${displayWeek}`] || ''
  const currentWeekStats = weekStats[`Week ${displayWeek}`] || { done: 0, total: 0 }

  const summaryText = useMemo(() => {
    if (totalDone >= totalTasks) return 'The forest is complete'
    if (totalDone / totalTasks > 0.5) return `In full bloom — ${totalDone} of ${totalTasks} done`
    if (totalDone === 0) return 'The forest stirs'
    return `Growing — ${totalDone} of ${totalTasks} done`
  }, [totalDone, totalTasks])

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100vh',
      overflow: 'hidden',
      background: '#080e08',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <style>{`
        @keyframes bloomPulse {
          0%   { opacity: 0; transform: scale(0.6); }
          40%  { opacity: 0.22; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.4); }
        }
        .milestone-bloom {
          animation: bloomPulse 1.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .scrubber-range {
          -webkit-appearance: none;
          width: 100%;
          height: 2px;
          background: rgba(160,180,150,0.2);
          border-radius: 2px;
          outline: none;
          cursor: pointer;
        }
        .scrubber-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px; height: 14px;
          border-radius: 50%;
          background: rgba(200,220,190,0.9);
          cursor: pointer;
          box-shadow: 0 0 6px rgba(180,210,170,0.5);
          transition: transform 0.15s;
        }
        .scrubber-range::-webkit-slider-thumb:hover { transform: scale(1.3); }
        .scrubber-range::-moz-range-thumb {
          width: 14px; height: 14px;
          border-radius: 50%;
          background: rgba(200,220,190,0.9);
          border: none;
          cursor: pointer;
        }
        .scrub-btn {
          background: none; border: none;
          cursor: pointer; padding: 3px 12px;
          color: rgba(180,200,170,0.45);
          font-size: 11px;
          font-family: 'Inter', system-ui, sans-serif;
          letter-spacing: 0.06em; border-radius: 4px;
          transition: color 0.15s;
        }
        .scrub-btn:hover { color: rgba(180,200,170,0.85); }
        .scrub-btn.playing { color: rgba(210,120,80,0.8); }
      `}</style>

      {/* ── Tree image — full screen ──────────────────────────────────────────── */}
      <img
        src="/tree-bg.png"
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          filter: imageFilter,
          transition: 'filter 0.6s ease',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />

      {/* ── Dark veil — lifts as progress grows ──────────────────────────────── */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: '#080e08',
        opacity: veilOpacity,
        transition: 'opacity 0.5s ease',
        pointerEvents: 'none',
      }} />

      {/* ── Milestone radial bloom — warm amber light ─────────────────────────── */}
      {isMilestone && (
        <div
          key={`bloom-${displayWeek}`}
          className="milestone-bloom"
          style={{
            position: 'absolute',
            left: '50%',
            top: '60%',
            transform: 'translate(-50%, -50%)',
            width: '60vmin',
            height: '60vmin',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(210,150,80,0.35) 0%, rgba(180,120,60,0.1) 50%, transparent 75%)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* ── Summary — top center ─────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 20, left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(6, 12, 6, 0.55)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(140,170,130,0.12)',
        borderRadius: 20,
        padding: '6px 20px',
        fontSize: 12,
        color: 'rgba(160,190,150,0.6)',
        letterSpacing: '0.06em',
        whiteSpace: 'nowrap',
        zIndex: 10,
        pointerEvents: 'none',
      }}>
        {summaryText}
      </div>

      {/* ── Time Scrubber ─────────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        bottom: 22,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(540px, 88vw)',
        background: 'rgba(6, 12, 6, 0.72)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: '1px solid rgba(140,170,130,0.15)',
        borderRadius: 18,
        padding: '12px 22px',
        zIndex: 50,
        boxShadow: '0 4px 32px rgba(0,0,0,0.6)',
      }}>
        {/* Label row */}
        <div style={{
          textAlign: 'center', marginBottom: 10, minHeight: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          {isDragging && (
            <span style={{ fontSize: 10, color: 'rgba(160,190,150,0.35)', fontStyle: 'italic' }}>
              preview
            </span>
          )}
          <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(180,210,165,0.85)', letterSpacing: '0.04em' }}>
            Week {displayWeek}{currentDateRange ? ` · ${currentDateRange}` : ''}
          </span>
          {currentWeekStats.total > 0 && (
            <span style={{ fontSize: 10, color: 'rgba(160,190,150,0.4)' }}>
              {currentWeekStats.done}/{currentWeekStats.total}
            </span>
          )}
          {displayWeek === actualWeek && !isDragging && !isPlaying && (
            <span style={{ fontSize: 10, color: 'rgba(160,190,150,0.25)', fontStyle: 'italic' }}>now</span>
          )}
        </div>

        {/* Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 10, color: 'rgba(160,190,150,0.3)', whiteSpace: 'nowrap' }}>W1</span>
          <input
            type="range" min={1} max={12} value={displayWeek}
            className="scrubber-range"
            onChange={handleSliderChange}
            onMouseUp={handleSliderUp}
            onTouchEnd={handleSliderUp}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: 10, color: 'rgba(160,190,150,0.3)', whiteSpace: 'nowrap' }}>W12</span>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 8 }}>
          <button className={`scrub-btn${isPlaying ? ' playing' : ''}`} onClick={handlePlay}>
            {isPlaying ? '■ stop' : '▶ play'}
          </button>
          <button className="scrub-btn" onClick={handleReset}>⏮ reset</button>
          <button
            className="scrub-btn"
            onClick={() => onOwnerWeekFilter('All', `Week ${displayWeek}`)}
            style={{ color: 'rgba(210,120,80,0.5)' }}
          >
            view tasks
          </button>
        </div>
      </div>
    </div>
  )
}
