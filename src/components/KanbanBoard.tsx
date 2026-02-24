import { useState, useMemo } from 'react'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Task, TaskStatus } from '../types'
import { STATUS_COLUMNS, normalizeStatus } from '../types'
import { TaskCard } from './TaskCard'

interface ColumnProps {
  id: TaskStatus
  label: string
  tasks: Task[]
  onCardClick: (task: Task) => void
}

function Column({ id, label, tasks, onCardClick }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      style={{
        background: isOver ? '#f2f4ef' : 'transparent',
        borderRadius: 8,
        padding: '10px 8px 12px',
        minWidth: 260,
        flex: '1 0 260px',
        maxWidth: 320,
        border: isOver ? '1px dashed #5a6847' : '1px solid transparent',
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {/* Column header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
          padding: '0 4px',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}
        >
          {label}
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 18,
            height: 18,
            borderRadius: 4,
            background: 'var(--border)',
            color: 'var(--text-secondary)',
            fontSize: 10,
            fontWeight: 600,
            padding: '0 4px',
          }}
        >
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div ref={setNodeRef} style={{ minHeight: 60 }}>
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={onCardClick} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '18px 0',
              color: 'var(--border)',
              fontSize: 11,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Empty
          </div>
        )}
      </div>
    </div>
  )
}

interface Props {
  tasks: Task[]
  loading: boolean
  onTaskClick: (task: Task) => void
  onStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>
}

export function KanbanBoard({ tasks, loading, onTaskClick, onStatusChange }: Props) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  const tasksByStatus = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      todo: [],
      'in-progress': [],
      blocked: [],
      done: [],
    }
    for (const task of tasks) {
      const col = normalizeStatus(task.status)
      map[col].push(task)
    }
    return map
  }, [tasks])

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id)
    if (task) setActiveTask(task)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null)
    const { active, over } = event
    if (!over) return

    const overId = over.id as string
    const taskId = active.id as string

    // Dropped over a column
    const targetColumn = STATUS_COLUMNS.find((c) => c.key === overId)
    if (targetColumn) {
      await onStatusChange(taskId, targetColumn.key)
      return
    }

    // Dropped over another task — find its column
    for (const col of STATUS_COLUMNS) {
      if (tasksByStatus[col.key].find((t) => t.id === overId)) {
        const task = tasks.find((t) => t.id === taskId)
        if (task && normalizeStatus(task.status) !== col.key) {
          await onStatusChange(taskId, col.key)
        }
        return
      }
    }
  }

  if (loading) {
    return (
      <div
        style={{
          textAlign: 'center',
          paddingTop: 80,
          color: 'var(--text-muted)',
          fontSize: 13,
          letterSpacing: '0.06em',
        }}
      >
        Loading...
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        style={{
          display: 'flex',
          gap: 12,
          overflowX: 'auto',
          padding: '4px 0 16px',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {STATUS_COLUMNS.map((col) => (
          <Column
            key={col.key}
            id={col.key}
            label={col.label}
            tasks={tasksByStatus[col.key]}
            onCardClick={onTaskClick}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? (
          <div style={{ transform: 'rotate(1.5deg)', opacity: 0.95 }}>
            <TaskCard task={activeTask} onClick={() => {}} isDragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
