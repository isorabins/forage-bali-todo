import type { Task } from '../types'
import { OWNER_DOT, WEEK_DATES, stripEmoji, getOwner } from '../types'

const ALL_WEEKS = [
  'Week 1', 'Week 2', 'Week 3', 'Week 4',
  'Week 5', 'Week 6', 'Week 7', 'Week 8',
  'Week 9', 'Week 10', 'Week 11', 'Week 12',
]

interface Props {
  tasks: Task[]
  ownerFilter: string
  onTaskClick: (task: Task) => void
}

export function CalendarView({ tasks, ownerFilter, onTaskClick }: Props) {
  // Group tasks by week
  const tasksByWeek: Record<string, Task[]> = {}
  for (const week of ALL_WEEKS) {
    tasksByWeek[week] = []
  }

  for (const task of tasks) {
    if (!task.week || !ALL_WEEKS.includes(task.week)) continue
    if (ownerFilter !== 'All' && getOwner(task) !== ownerFilter) continue
    tasksByWeek[task.week].push(task)
  }

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* Header row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '140px 1fr',
          borderBottom: '2px solid var(--border)',
          marginBottom: 0,
          padding: '8px 14px 8px 14px',
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}
        >
          Week
        </div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            paddingLeft: 12,
          }}
        >
          Tasks
        </div>
      </div>

      {/* Week rows */}
      {ALL_WEEKS.map((week, idx) => {
        const weekTasks = tasksByWeek[week]
        const dateRange = WEEK_DATES[week] || ''
        const isEven = idx % 2 === 0

        return (
          <div
            key={week}
            className="calendar-week-row"
            style={{ background: isEven ? 'var(--surface)' : 'var(--bg)' }}
          >
            {/* Week label */}
            <div className="calendar-week-label">
              <span className="week-num">{week}</span>
              <span className="week-dates">{dateRange}</span>
            </div>

            {/* Tasks */}
            <div className="calendar-tasks">
              {weekTasks.length === 0 ? (
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    fontStyle: 'italic',
                  }}
                >
                  —
                </span>
              ) : (
                weekTasks.map((task) => {
                  const owner = getOwner(task)
                  const dotColor = owner ? (OWNER_DOT[owner] || '#bfa88a') : '#bfa88a'
                  const title = stripEmoji(task.title)

                  return (
                    <button
                      key={task.id}
                      className="calendar-task-chip"
                      onClick={() => onTaskClick(task)}
                      title={title}
                    >
                      <span
                        className="owner-dot"
                        style={{ background: dotColor }}
                      />
                      <span className="chip-title">{title}</span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )
      })}

      {/* Unassigned to week — tasks with no week field */}
      {(() => {
        const unweekly = tasks.filter(
          (t) =>
            (!t.week || !ALL_WEEKS.includes(t.week)) &&
            (ownerFilter === 'All' || getOwner(t) === ownerFilter)
        )
        if (unweekly.length === 0) return null
        return (
          <div
            className="calendar-week-row"
            style={{ background: 'var(--surface)' }}
          >
            <div className="calendar-week-label">
              <span className="week-num">No week</span>
              <span className="week-dates">unscheduled</span>
            </div>
            <div className="calendar-tasks">
              {unweekly.map((task) => {
                const owner = getOwner(task)
                const dotColor = owner ? (OWNER_DOT[owner] || '#bfa88a') : '#bfa88a'
                const title = stripEmoji(task.title)
                return (
                  <button
                    key={task.id}
                    className="calendar-task-chip"
                    onClick={() => onTaskClick(task)}
                    title={title}
                  >
                    <span className="owner-dot" style={{ background: dotColor }} />
                    <span className="chip-title">{title}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
