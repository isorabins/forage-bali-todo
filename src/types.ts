export type TaskStatus = 'todo' | 'done'
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

// Owner badge colors — warm terracotta palette
export const OWNER_COLORS: Record<string, string> = {
  Iso: '#4a3728',
  Yuka: '#523530',
  Carla: '#4a4642',
  Alex: '#3d3028',
}

export const OWNER_BG: Record<string, string> = {
  Iso: '#f0ebe4',
  Yuka: '#f2e8e4',
  Carla: '#efeeec',
  Alex: '#f0ece6',
}

// Dot colors for calendar chips
export const OWNER_DOT: Record<string, string> = {
  Iso: '#c97d60',
  Yuka: '#b86b50',
  Carla: '#8a8580',
  Alex: '#a87060',
}

export const STATUS_COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: 'todo', label: 'TO DO' },
  { key: 'done', label: 'DONE' },
]

export const PRIORITY_LABELS: Record<string, string> = {
  high: 'High',
  normal: 'Normal',
  low: 'Low',
  medium: 'Normal',
}

// Left border colors for priority
export const PRIORITY_BORDER: Record<string, string> = {
  high: '#d4693a',
  normal: '#e2d9d0',
  low: 'transparent',
  medium: '#e2d9d0',
}

// Normalize status for display (legacy 'up-next', 'in-progress', 'blocked' → 'todo')
export function normalizeStatus(status: string): TaskStatus {
  if (status === 'done') return 'done'
  // All other statuses collapse to 'todo'
  return 'todo'
}

// Strip emoji from task titles for display
export function stripEmoji(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[\u{FE00}-\u{FEFF}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// Get display owner (check both owner and assigned_agent)
export function getOwner(task: Task): string | null {
  return task.owner || task.assigned_agent || null
}

export const WEEK_DATES: Record<string, string> = {
  'Week 1': 'Feb 24 – Mar 1',
  'Week 2': 'Mar 2–8',
  'Week 3': 'Mar 9–15',
  'Week 4': 'Mar 16–22',
  'Week 5': 'Mar 23–29',
  'Week 6': 'Mar 30 – Apr 5',
  'Week 7': 'Apr 6–12',
  'Week 8': 'Apr 13–19',
  'Week 9': 'Apr 20–26',
  'Week 10': 'Apr 27 – May 3',
  'Week 11': 'May 4–10',
  'Week 12': 'May 11–17',
}
