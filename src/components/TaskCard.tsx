import { Card, Tag, Typography } from 'antd'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from '../types'
import { OWNER_COLORS, OWNER_BG, PRIORITY_COLORS, getOwner } from '../types'

const { Text } = Typography

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
    opacity: isSortableDragging ? 0.4 : 1,
  }

  const owner = getOwner(task)
  const ownerColor = owner ? OWNER_COLORS[owner] : '#8c8c8c'
  const ownerBg = owner ? OWNER_BG[owner] : '#fafafa'
  const priority = task.priority === 'medium' ? 'normal' : task.priority
  const priorityColor = PRIORITY_COLORS[priority] || '#8c8c8c'

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        size="small"
        onClick={() => onClick(task)}
        style={{
          marginBottom: 8,
          borderRadius: 10,
          cursor: isDragging ? 'grabbing' : 'grab',
          border: `1px solid ${isSortableDragging ? ownerColor : '#f0f0f0'}`,
          boxShadow: isSortableDragging
            ? `0 8px 24px rgba(0,0,0,0.15)`
            : '0 1px 4px rgba(0,0,0,0.06)',
          transition: 'box-shadow 0.2s, border-color 0.2s',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          borderLeft: `3px solid ${priorityColor}`,
        }}
        styles={{
          body: { padding: '10px 12px' },
        }}
        hoverable
      >
        {/* Header: owner badge + priority dot */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          {owner ? (
            <span
              style={{
                display: 'inline-block',
                padding: '1px 8px',
                borderRadius: 10,
                background: ownerBg,
                color: ownerColor,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 0.3,
                border: `1px solid ${ownerColor}22`,
              }}
            >
              {owner}
            </span>
          ) : (
            <span />
          )}

          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: priorityColor,
              flexShrink: 0,
            }}
            title={priority}
          />
        </div>

        {/* Title */}
        <Text
          style={{
            fontSize: 13,
            fontWeight: 500,
            lineHeight: 1.4,
            display: 'block',
            color: '#1a1a1a',
          }}
        >
          {task.title}
        </Text>

        {/* Week/month tags */}
        {(task.week || task.month) && (
          <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {task.week && (
              <Tag
                style={{
                  fontSize: 10,
                  padding: '0 5px',
                  borderRadius: 4,
                  margin: 0,
                  lineHeight: '18px',
                  background: '#f5f5f5',
                  border: '1px solid #e0e0e0',
                  color: '#595959',
                }}
              >
                {task.week}
              </Tag>
            )}
            {task.month && (
              <Tag
                style={{
                  fontSize: 10,
                  padding: '0 5px',
                  borderRadius: 4,
                  margin: 0,
                  lineHeight: '18px',
                  background: '#f0f5ff',
                  border: '1px solid #d6e4ff',
                  color: '#1d4ed8',
                }}
              >
                {task.month}
              </Tag>
            )}
          </div>
        )}

        {/* Due date if set */}
        {task.due_date && (
          <div style={{ marginTop: 4 }}>
            <Text style={{ fontSize: 11, color: '#8c8c8c' }}>
              📅 {task.due_date}
            </Text>
          </div>
        )}
      </Card>
    </div>
  )
}
