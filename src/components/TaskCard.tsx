import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from '../types'
import { OWNER_COLORS, OWNER_BG, getOwner, stripEmoji, normalizeStatus } from '../types'

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

  const [hovered, setHovered] = useState(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.3 : 1,
  }

  const owner      = getOwner(task)
  const ownerColor = owner ? (OWNER_COLORS[owner] ?? '#8b5e4a') : undefined
  const ownerBg    = owner ? (OWNER_BG[owner]    ?? '#f0e8e2') : undefined
  const priority   = task.priority === 'medium' ? 'normal' : (task.priority || 'normal')
  const isDone     = normalizeStatus(task.status) === 'done'

  // Only high priority gets the coral left border — others get none
  const borderLeft = priority === 'high' ? '3px solid #d4693a' : 'none'

  const rawTitle = stripEmoji(task.title)
  const title    = isDone ? `✓ ${rawTitle}` : rawTitle

  // Compact week label
  const weekShort = task.week ? task.week.replace(/week\s*/i, 'W') : null

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div
        className="task-card"
        onClick={() => onClick(task)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          cursor: isDragging || isSortableDragging ? 'grabbing' : 'grab',
          borderLeft,
          background: hovered ? '#fdf9f7' : '#ffffff',
          boxShadow: isSortableDragging
            ? '0 8px 24px rgba(0,0,0,0.12)'
            : '0 1px 3px rgba(0,0,0,0.06), 0 1px 0 #e2d9d0',
          opacity: isDone ? 0.65 : 1,
          transition: 'background 0.15s, box-shadow 0.15s, opacity 0.15s',
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
                color: '#8a8580',
                fontSize: 11,
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
            fontSize: 14,
            fontWeight: 500,
            lineHeight: 1.5,
            color: isDone ? 'var(--text-secondary)' : 'var(--text-primary)',
            letterSpacing: '-0.005em',
            textDecoration: isDone ? 'line-through' : 'none',
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
