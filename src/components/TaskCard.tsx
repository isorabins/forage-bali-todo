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
  const borderLeft = PRIORITY_BORDER[priority] || 'transparent'

  const title = stripEmoji(task.title)

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div
        className="task-card"
        onClick={() => onClick(task)}
        style={{
          cursor: isDragging ? 'grabbing' : isSortableDragging ? 'grabbing' : 'grab',
          borderLeft: `3px solid ${borderLeft}`,
          boxShadow: isSortableDragging
            ? '0 8px 24px rgba(0,0,0,0.12)'
            : '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        {/* Owner badge */}
        {owner && (
          <div style={{ marginBottom: 7 }}>
            <span
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: 20,
                background: ownerBg,
                color: ownerColor,
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {owner}
            </span>
          </div>
        )}

        {/* Title */}
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            lineHeight: 1.45,
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </div>

        {/* Meta: week / month */}
        {(task.week || task.month) && (
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            {task.week && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                }}
              >
                {task.week}
              </span>
            )}
            {task.week && task.month && (
              <span style={{ color: 'var(--border)', fontSize: 10 }}>·</span>
            )}
            {task.month && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                }}
              >
                {task.month}
              </span>
            )}
          </div>
        )}

        {/* Due date */}
        {task.due_date && (
          <div style={{ marginTop: 5 }}>
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
              }}
            >
              {task.due_date}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
