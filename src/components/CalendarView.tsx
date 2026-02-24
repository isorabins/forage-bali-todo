import { useState } from 'react'
import type { Task } from '../types'
import { PRIORITY_BORDER, WEEK_DATES, stripEmoji, getOwner, normalizeStatus, OWNERS } from '../types'

const ALL_WEEKS = [
  'Week 1', 'Week 2', 'Week 3', 'Week 4',
  'Week 5', 'Week 6', 'Week 7', 'Week 8',
  'Week 9', 'Week 10', 'Week 11', 'Week 12',
]

const MAX_VISIBLE = 5

interface Props {
  tasks: Task[]
  ownerFilter: string
  onTaskClick: (task: Task) => void
}

interface OwnerSectionProps {
  owner: string
  tasks: Task[]
  onTaskClick: (task: Task) => void
}

function OwnerSection({ owner, tasks, onTaskClick }: OwnerSectionProps) {
  const [expanded, setExpanded] = useState(false)

  const visible = expanded ? tasks : tasks.slice(0, MAX_VISIBLE)
  const hidden = tasks.length - MAX_VISIBLE

  return (
    <div className="cal-owner-section">
      <div className="cal-owner-label">{owner}</div>

      {tasks.length === 0 ? (
        <p className="cal-empty">No tasks this week</p>
      ) : (
        <div className="cal-cards">
          {visible.map((task) => {
            const priority = task.priority === 'medium' ? 'normal' : (task.priority || 'normal')
            const borderColor = PRIORITY_BORDER[priority] || 'transparent'
            const isDone = normalizeStatus(task.status) === 'done'

            return (
              <button
                key={task.id}
                className="cal-card"
                onClick={() => onTaskClick(task)}
                style={{
                  borderLeftColor: borderColor,
                  opacity: isDone ? 0.55 : 1,
                }}
              >
                <span
                  className="cal-card-title"
                  style={{
                    textDecoration: isDone ? 'line-through' : 'none',
                  }}
                >
                  {stripEmoji(task.title)}
                </span>
                {isDone && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      flexShrink: 0,
                      marginLeft: 10,
                    }}
                  >
                    Done
                  </span>
                )}
              </button>
            )
          })}

          {!expanded && hidden > 0 && (
            <button
              className="cal-show-more"
              onClick={() => setExpanded(true)}
            >
              + {hidden} more
            </button>
          )}
          {expanded && hidden > 0 && (
            <button
              className="cal-show-more"
              onClick={() => setExpanded(false)}
            >
              Show less
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function CalendarView({ tasks, ownerFilter, onTaskClick }: Props) {
  const [weekIndex, setWeekIndex] = useState(0)

  const currentWeek = ALL_WEEKS[weekIndex]
  const dateRange = WEEK_DATES[currentWeek] || ''

  // Filter by current week
  const weekTasks = tasks.filter(
    (t) => t.week === currentWeek &&
      (ownerFilter === 'All' || getOwner(t) === ownerFilter)
  )

  // Decide which owners to show
  const ownersToShow = ownerFilter === 'All' ? OWNERS : OWNERS.filter((o) => o === ownerFilter)

  const totalThisWeek = weekTasks.length
  const doneThisWeek = weekTasks.filter((t) => normalizeStatus(t.status) === 'done').length

  return (
    <div style={{ paddingBottom: 48 }}>
      {/* Week navigation */}
      <div className="cal-nav">
        <button
          className="cal-nav-btn"
          onClick={() => setWeekIndex((i) => Math.max(0, i - 1))}
          disabled={weekIndex === 0}
          aria-label="Previous week"
        >
          ‹
        </button>

        <div style={{ textAlign: 'center' }}>
          <div className="cal-nav-label">
            {currentWeek}
            <span className="cal-nav-dates">{dateRange}</span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              marginTop: 3,
              letterSpacing: '0.03em',
            }}
          >
            {totalThisWeek} tasks · {doneThisWeek} done
          </div>
        </div>

        <button
          className="cal-nav-btn"
          onClick={() => setWeekIndex((i) => Math.min(ALL_WEEKS.length - 1, i + 1))}
          disabled={weekIndex === ALL_WEEKS.length - 1}
          aria-label="Next week"
        >
          ›
        </button>
      </div>

      {/* Quick-jump week pills */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          padding: '14px 24px 0',
          justifyContent: 'center',
        }}
      >
        {ALL_WEEKS.map((w, i) => {
          const count = tasks.filter(
            (t) => t.week === w && (ownerFilter === 'All' || getOwner(t) === ownerFilter)
          ).length
          const isActive = i === weekIndex
          return (
            <button
              key={w}
              onClick={() => setWeekIndex(i)}
              style={{
                padding: '3px 10px',
                borderRadius: 20,
                border: '1px solid',
                borderColor: isActive ? 'var(--accent)' : 'var(--border)',
                background: isActive ? 'var(--accent)' : 'transparent',
                color: isActive ? 'white' : count > 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
                fontSize: 11,
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                fontFamily: "'Inter', system-ui, sans-serif",
                transition: 'all 0.15s ease',
                opacity: count === 0 ? 0.5 : 1,
              }}
            >
              W{i + 1}
              {count > 0 && (
                <span style={{ marginLeft: 4, opacity: 0.75 }}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Owner sections */}
      <div style={{ marginTop: 16 }}>
        {ownersToShow.map((owner) => {
          const ownerTasks = weekTasks.filter((t) => getOwner(t) === owner)
          return (
            <OwnerSection
              key={owner}
              owner={owner}
              tasks={ownerTasks}
              onTaskClick={onTaskClick}
            />
          )
        })}

        {/* Tasks with no owner */}
        {ownerFilter === 'All' && (() => {
          const unowned = weekTasks.filter((t) => !getOwner(t))
          if (unowned.length === 0) return null
          return (
            <OwnerSection
              owner="Unassigned"
              tasks={unowned}
              onTaskClick={onTaskClick}
            />
          )
        })()}
      </div>
    </div>
  )
}
