import { useState, useEffect, useCallback } from 'react'
import { ConfigProvider, Select, message, theme } from 'antd'
import { supabase } from './lib/supabase'
import type { Task, TaskStatus } from './types'
import { getOwner, normalizeStatus } from './types'
import { PasswordGate, isAuthenticated } from './components/PasswordGate'
import { KanbanBoard } from './components/KanbanBoard'
import { TaskModal } from './components/TaskModal'
import { CalendarView } from './components/CalendarView'
import { GardenView } from './components/GardenView'

// Collect unique week/month values from tasks
function getFilterOptions(tasks: Task[], field: 'week' | 'month') {
  const vals = new Set<string>()
  for (const t of tasks) {
    if (t[field]) vals.add(t[field]!)
  }
  return Array.from(vals).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, '')) || 0
    const numB = parseInt(b.replace(/\D/g, '')) || 0
    return numA - numB
  })
}

type AppView = 'board' | 'calendar' | 'garden'

function App() {
  const [authed, setAuthed] = useState(isAuthenticated())
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [view, setView] = useState<AppView>('board')

  // Compute current week based on program start date (Feb 24, 2026)
  function getCurrentWeek(): string {
    const programStart = new Date('2026-02-24')
    const now = new Date()
    const diffMs = now.getTime() - programStart.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const weekNum = Math.min(Math.max(Math.floor(diffDays / 7) + 1, 1), 12)
    return `Week ${weekNum}`
  }

  // Filters
  const [ownerFilter, setOwnerFilter] = useState<string>('All')
  const [weekFilter, setWeekFilter] = useState<string>(getCurrentWeek())
  const [monthFilter, setMonthFilter] = useState<string>('All')

  const [messageApi, contextHolder] = message.useMessage()

  const loadTasks = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      messageApi.error('Failed to load tasks')
      console.error(error)
    } else {
      setTasks(data || [])
    }
    setLoading(false)
  }, [messageApi])

  useEffect(() => {
    if (authed) loadTasks()
  }, [authed, loadTasks])

  // Real-time subscription
  useEffect(() => {
    if (!authed) return
    const channel = supabase
      .channel('tasks-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        loadTasks()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [authed, loadTasks])

  // Filter tasks (for board view)
  const filteredTasks = tasks.filter((t) => {
    if (ownerFilter !== 'All' && getOwner(t) !== ownerFilter) return false
    if (weekFilter !== 'All' && t.week !== weekFilter) return false
    if (monthFilter !== 'All' && t.month !== monthFilter) return false
    return true
  })

  const weekOptions = getFilterOptions(tasks, 'week')
  const monthOptions = getFilterOptions(tasks, 'month')

  const handleSave = async (data: Partial<Task>) => {
    if (editTask) {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: data.title,
          description: data.description || null,
          owner: data.owner || null,
          status: data.status || 'todo',
          priority: data.priority || 'normal',
          week: data.week || null,
          month: data.month || null,
          due_date: data.due_date || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editTask.id)

      if (error) { messageApi.error('Failed to update task'); throw error }
      messageApi.success('Task updated')
    } else {
      const { error } = await supabase.from('tasks').insert({
        title: data.title,
        description: data.description || null,
        owner: data.owner || null,
        status: data.status || 'todo',
        priority: data.priority || 'normal',
        week: data.week || null,
        month: data.month || null,
        due_date: data.due_date || null,
        project: 'forage-bali',
      })

      if (error) { messageApi.error('Failed to create task'); throw error }
      messageApi.success('Task added')
    }
    await loadTasks()
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) { messageApi.error('Failed to delete task'); throw error }
    messageApi.success('Task deleted')
    await loadTasks()
  }

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    )
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', taskId)

    if (error) { messageApi.error('Failed to move task'); await loadTasks() }
  }

  const openNewTask = () => { setEditTask(null); setModalOpen(true) }
  const openEditTask = (task: Task) => { setEditTask(task); setModalOpen(true) }
  const handleLogout = () => { localStorage.removeItem('foragebali_auth'); setAuthed(false) }

  if (!authed) {
    return (
      <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm, token: { colorPrimary: '#c97d60' } }}>
        <PasswordGate onUnlock={() => setAuthed(true)} />
      </ConfigProvider>
    )
  }

  const todoCount = filteredTasks.filter((t) => normalizeStatus(t.status) === 'todo').length
  const doneCount = filteredTasks.filter((t) => normalizeStatus(t.status) === 'done').length

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#c97d60',
          borderRadius: 8,
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          colorBorder: '#e2d9d0',
          colorBgContainer: '#ffffff',
          colorText: '#2d2a27',
          colorTextSecondary: '#5c5853',
          colorTextPlaceholder: '#8a8580',
        },
      }}
    >
      {contextHolder}

      {/* ── Header ── */}
      <div
        style={{
          background: 'var(--bg)',
          borderBottom: '1px solid var(--border)',
          padding: '18px 28px 16px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        {/* Top row: wordmark + view toggle + logout */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <span
              style={{
                fontSize: 32,
                fontWeight: 700,
                letterSpacing: '-0.03em',
                color: 'var(--text-primary)',
                lineHeight: 1,
              }}
            >
              Forage Bali
            </span>
            <span
              style={{
                fontSize: 13,
                color: 'var(--text-muted)',
                letterSpacing: '0.02em',
              }}
            >
              <span style={{ color: 'var(--coral)', fontWeight: 600 }}>{todoCount}</span> open · {doneCount} done
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Board / Calendar / Garden toggle */}
            <div className="view-toggle">
              <button
                className={view === 'board' ? 'active' : ''}
                onClick={() => setView('board')}
              >
                Board
              </button>
              <button
                className={view === 'calendar' ? 'active' : ''}
                onClick={() => setView('calendar')}
              >
                Calendar
              </button>
              <button
                className={view === 'garden' ? 'active' : ''}
                onClick={() => setView('garden')}
              >
                Grow
              </button>
            </div>

            {/* Add Task — prominent header button */}
            <button
              onClick={openNewTask}
              className="add-task-btn"
            >
              + Add Task
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px 8px',
                color: 'var(--text-muted)',
                fontSize: 12,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
              title="Sign out"
            >
              Out
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          {/* Owner filter tabs */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['All', 'Iso', 'Yuka', 'Carla', 'Noko'].map((o) => (
              <button
                key={o}
                className={`owner-pill ${ownerFilter === o ? 'active' : ''}`}
                onClick={() => setOwnerFilter(o)}
              >
                {o}
              </button>
            ))}
          </div>

          {/* Divider */}
          {(weekOptions.length > 0 || monthOptions.length > 0) && (
            <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 2px' }} />
          )}

          {/* Week filter */}
          {weekOptions.length > 0 && (
            <Select
              size="small"
              value={weekFilter}
              onChange={setWeekFilter}
              style={{ minWidth: 96 }}
              options={[
                { value: 'All', label: 'All weeks' },
                ...weekOptions.map((w) => ({ value: w, label: w })),
              ]}
            />
          )}

          {/* Month filter */}
          {monthOptions.length > 0 && (
            <Select
              size="small"
              value={monthFilter}
              onChange={setMonthFilter}
              style={{ minWidth: 104 }}
              options={[
                { value: 'All', label: 'All months' },
                ...monthOptions.map((m) => ({ value: m, label: m })),
              ]}
            />
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <div
        style={{
          padding: view === 'board' ? '16px 20px' : '0',
          minHeight: 'calc(100vh - 120px)',
        }}
      >
        {view === 'board' ? (
          <KanbanBoard
            tasks={filteredTasks}
            loading={loading}
            onTaskClick={openEditTask}
            onStatusChange={handleStatusChange}
          />
        ) : view === 'calendar' ? (
          <CalendarView
            tasks={tasks}
            ownerFilter={ownerFilter}
            onTaskClick={openEditTask}
          />
        ) : (
          <GardenView
            tasks={tasks}
            onOwnerWeekFilter={(owner, week) => {
              setOwnerFilter(owner)
              setWeekFilter(week)
              setView('board')
            }}
          />
        )}
      </div>

      {/* ── FAB ── */}
      <button
        onClick={openNewTask}
        title="Add task"
        style={{
          position: 'fixed',
          right: 20,
          bottom: 24,
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'var(--accent)',
          border: 'none',
          color: 'white',
          fontSize: 24,
          lineHeight: 1,
          cursor: 'pointer',
          boxShadow: '0 2px 12px rgba(201,125,96,0.38)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s, box-shadow 0.15s',
          zIndex: 200,
          fontFamily: 'system-ui, sans-serif',
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-hover)'
          ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(201,125,96,0.50)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--accent)'
          ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 12px rgba(201,125,96,0.38)'
        }}
      >
        +
      </button>

      {/* ── Task modal ── */}
      <TaskModal
        task={editTask}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTask(null) }}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </ConfigProvider>
  )
}

export default App
