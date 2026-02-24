export type TaskStatus = 'todo' | 'in-progress' | 'blocked' | 'done'
export type TaskPriority = 'high' | 'normal' | 'low'
export type TaskOwner = 'Iso' | 'Yuka' | 'Carla' | 'Alex'

export interface Task {
  id: string
  title: string
  description?: string | null
  owner?: string | null
  assigned_agent?: string | null
  status: string
  priority: string
  project?: string | null
  week?: string | null
  month?: string | null
  due_date?: string | null
  created_at?: string
  updated_at?: string
}

export const OWNERS: TaskOwner[] = ['Iso', 'Yuka', 'Carla', 'Alex']

export const OWNER_COLORS: Record<string, string> = {
  Iso: '#1677ff',
  Yuka: '#52c41a',
  Carla: '#fa8c16',
  Alex: '#722ed1',
}

export const OWNER_BG: Record<string, string> = {
  Iso: '#e6f4ff',
  Yuka: '#f6ffed',
  Carla: '#fff7e6',
  Alex: '#f9f0ff',
}

export const STATUS_COLUMNS: { key: TaskStatus; label: string; color: string }[] = [
  { key: 'todo', label: 'To Do', color: '#8c8c8c' },
  { key: 'in-progress', label: 'In Progress', color: '#1677ff' },
  { key: 'blocked', label: 'Blocked', color: '#ff4d4f' },
  { key: 'done', label: 'Done', color: '#52c41a' },
]

export const PRIORITY_COLORS: Record<string, string> = {
  high: '#ff4d4f',
  normal: '#faad14',
  low: '#8c8c8c',
  medium: '#faad14',
}

export const PRIORITY_LABELS: Record<string, string> = {
  high: '🔴 High',
  normal: '🟡 Normal',
  low: '⚪ Low',
  medium: '🟡 Normal',
}

// Normalize status for display (legacy 'up-next' → 'todo')
export function normalizeStatus(status: string): TaskStatus {
  if (status === 'up-next') return 'todo'
  if (['todo', 'in-progress', 'blocked', 'done'].includes(status)) return status as TaskStatus
  return 'todo'
}

// Get display owner (check both owner and assigned_agent)
export function getOwner(task: Task): string | null {
  return task.owner || task.assigned_agent || null
}
