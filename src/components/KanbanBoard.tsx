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
  collapsed?: boolean
}

function Column({ id, label, tasks, onCardClick, collapsed = false }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  if (collapsed) {
    // Slim sidebar — just the header, no cards
    return (
      <div
        style={{
          width: 180,
          flexShrink: 0,
          background: isOver ? '#fdf0eb' : 'transparent',
          borderRadius: 10,
          padding: '12px 12px',
          border: isOver ? '1px dashed var(--accent)' : '1px solid transparent',
          transition: 'background 0.15s, border-color 0.15s',
        }}
        ref={setNodeRef}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 10,
            padding: '0 2px',
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.12em',
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
              color: 'var(--text-muted)',
              fontSize: 10,
              fontWeight: 600,
              padding: '0 4px',
            }}
          >
            {tasks.length}
          </span>
        </div>

        {/* Drop target when empty */}
        <div
          style={{
            borderRadius: 8,
            border: '1.5px dashed var(--border)',
            minHeight: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--border)',
            fontSize: 11,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          Drop here
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        background: isOver ? '#fdf0eb' : 'transparent',
        borderRadius: 10,
        padding: '10px 8px 12px',
        flex: '1 1 0',
        minWidth: 280,
        border: isOver ? '1px dashed var(--accent)' : '1px solid transparent',
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {/* Column header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 14,
          padding: '0 4px',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.12em',
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
            background: id === 'todo' ? 'var(--coral-bg)' : 'var(--border)',
            color: id === 'todo' ? 'var(--coral)' : 'var(--text-secondary)',
            fontSize: 10,
            fontWeight: 700,
            padding: '0 4px',
          }}
        >
          {tasks.length}
        </span>
      </div>

      {/* 2-column card grid */}
      <div ref={setNodeRef} style={{ minHeight: 60 }}>
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.length > 0 ? (
            <div className="card-grid">
              {tasks.map((task) => (
                <TaskCard key={task.id} task={task} onClick={onCardClick} />
              ))}
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '28px 0 16px',
                color: 'var(--border)',
                fontSize: 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Nothing here
            </div>
          )}
        </SortableContext>
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
    const map: Record<TaskStatus, Task[]> = { todo: [], done: [] }
    for (const task of tasks) {
      map[normalizeStatus(task.status)].push(task)
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

    const targetColumn = STATUS_COLUMNS.find((c) => c.key === overId)
    if (targetColumn) {
      await onStatusChange(taskId, targetColumn.key)
      return
    }

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
        Loading…
      </div>
    )
  }

  const doneIsEmpty = tasksByStatus.done.length === 0

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
          gap: 24,
          padding: '4px 0 24px',
          alignItems: 'flex-start',
        }}
      >
        {/* TO DO — always full flex */}
        <Column
          key="todo"
          id="todo"
          label="To Do"
          tasks={tasksByStatus.todo}
          onCardClick={onTaskClick}
        />

        {/* DONE — collapsed when empty */}
        <Column
          key="done"
          id="done"
          label="Done"
          tasks={tasksByStatus.done}
          onCardClick={onTaskClick}
          collapsed={doneIsEmpty}
        />
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
