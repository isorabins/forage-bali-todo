import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from '../types'
import { OWNER_COLORS, OWNER_BG, PRIORITY_BORDER, getOwner, stripEmoji } from '../types'

interface Props {
  task: Task
  onClick: (task: Task) => void
  isDragging?: boolean
}

export function TaskCard({ task, onClick, isDragging }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.3 : 1,
  }

  const owner = getOwner(task)
  const ownerColor = owner ? OWNER_COLORS[owner] : undefined
  const ownerBg = owner ? OWNER_BG[owner] : undefined
  const priority = task.priority === 'medium' ? 'normal' : (task.priority || 'normal')
  const borderColor = PRIORITY_BORDER[priority] || 'transparent'

  const title = stripEmoji(task.title)

  // Compact week label: "Week 3" → "W3"
  const weekShort = task.week
    ? task.week.replace(/week\s*/i, 'W')
    : null

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div
        className="task-card"
        onClick={() => onClick(task)}
        style={{
          cursor: isDragging ? 'grabbing' : isSortableDragging ? 'grabbing' : 'grab',
          borderLeft: `3px solid ${borderColor}`,
          boxShadow: isSortableDragging
            ? '0 8px 24px rgba(0,0,0,0.12)'
            : '0 1px 2px rgba(0,0,0,0.05)',
        }}
      >
        {/* Top row: owner badge + week pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: owner || weekShort ? 7 : 0,
            gap: 6,
          }}
        >
          {owner && (
            <span
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: 20,
                background: ownerBg,
                color: ownerColor,
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.01em',
                whiteSpace: 'nowrap',
              }}
            >
              {owner}
            </span>
          )}
          {weekShort && (
            <span
              style={{
                display: 'inline-block',
                padding: '1px 6px',
                borderRadius: 4,
                background: 'var(--bg)',
                color: 'var(--text-muted)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.05em',
                flexShrink: 0,
                marginLeft: 'auto',
              }}
            >
              {weekShort}
            </span>
          )}
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            lineHeight: 1.4,
            color: 'var(--text-primary)',
            letterSpacing: '-0.005em',
          }}
        >
          {title}
        </div>

        {/* Due date (optional) */}
        {task.due_date && (
          <div style={{ marginTop: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {task.due_date}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
