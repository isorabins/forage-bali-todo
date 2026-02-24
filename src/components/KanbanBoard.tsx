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
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Badge, Typography, Spin } from 'antd'
import type { Task, TaskStatus } from '../types'
import { STATUS_COLUMNS, normalizeStatus } from '../types'
import { TaskCard } from './TaskCard'

const { Text } = Typography

interface ColumnProps {
  id: TaskStatus
  label: string
  color: string
  tasks: Task[]
  onCardClick: (task: Task) => void
}

function Column({ id, label, color, tasks, onCardClick }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      style={{
        background: isOver ? '#f0f7ff' : '#f8f9fa',
        borderRadius: 12,
        padding: '12px 10px',
        minWidth: 260,
        flex: '1 0 260px',
        maxWidth: 320,
        border: isOver ? '2px dashed #1677ff' : '2px solid transparent',
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
          padding: '0 2px',
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: color,
            flexShrink: 0,
          }}
        />
        <Text strong style={{ fontSize: 13, color: '#374151' }}>
          {label}
        </Text>
        <Badge
          count={tasks.length}
          style={{
            backgroundColor: '#e5e7eb',
            color: '#6b7280',
            fontSize: 11,
            fontWeight: 600,
            boxShadow: 'none',
          }}
        />
      </div>

      <div
        ref={setNodeRef}
        style={{
          minHeight: 80,
        }}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={onCardClick} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '20px 0',
              color: '#d1d5db',
              fontSize: 12,
            }}
          >
            Drop tasks here
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
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    })
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

    // Check if dropped over a column
    const targetColumn = STATUS_COLUMNS.find((c) => c.key === overId)
    if (targetColumn) {
      await onStatusChange(taskId, targetColumn.key)
      return
    }

    // Dropped over another task — find which column that task is in
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
      <div style={{ textAlign: 'center', paddingTop: 80 }}>
        <Spin size="large" />
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
            color={col.color}
            tasks={tasksByStatus[col.key]}
            onCardClick={onTaskClick}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? (
          <div style={{ transform: 'rotate(2deg)' }}>
            <TaskCard task={activeTask} onClick={() => {}} isDragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
