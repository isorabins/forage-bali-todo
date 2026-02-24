import { useState, useEffect, useCallback } from 'react'
import {
  ConfigProvider,
  Button,
  Typography,
  Select,
  message,
  FloatButton,
  theme,
} from 'antd'
import { PlusOutlined, LogoutOutlined, FilterOutlined } from '@ant-design/icons'
import { supabase } from './lib/supabase'
import type { Task, TaskStatus } from './types'
import { getOwner, normalizeStatus } from './types'
import { PasswordGate, isAuthenticated } from './components/PasswordGate'
import { KanbanBoard } from './components/KanbanBoard'
import { TaskModal } from './components/TaskModal'

const { Title, Text } = Typography

// Collect unique week/month values from tasks
function getFilterOptions(tasks: Task[], field: 'week' | 'month') {
  const vals = new Set<string>()
  for (const t of tasks) {
    if (t[field]) vals.add(t[field]!)
  }
  // Sort: "Week 1", "Week 2", etc. or "Month 1", "Month 2"
  return Array.from(vals).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, '')) || 0
    const numB = parseInt(b.replace(/\D/g, '')) || 0
    return numA - numB
  })
}

function App() {
  const [authed, setAuthed] = useState(isAuthenticated())
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)

  // Filters
  const [ownerFilter, setOwnerFilter] = useState<string>('All')
  const [weekFilter, setWeekFilter] = useState<string>('All')
  const [monthFilter, setMonthFilter] = useState<string>('All')

  const [messageApi, contextHolder] = message.useMessage()

  // Load tasks from Supabase
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

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (ownerFilter !== 'All' && getOwner(t) !== ownerFilter) return false
    if (weekFilter !== 'All' && t.week !== weekFilter) return false
    if (monthFilter !== 'All' && t.month !== monthFilter) return false
    return true
  })

  const weekOptions = getFilterOptions(tasks, 'week')
  const monthOptions = getFilterOptions(tasks, 'month')

  // Save task (create or update)
  const handleSave = async (data: Partial<Task>) => {
    if (editTask) {
      // Update
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

      if (error) {
        messageApi.error('Failed to update task')
        throw error
      }
      messageApi.success('Task updated')
    } else {
      // Create
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

      if (error) {
        messageApi.error('Failed to create task')
        throw error
      }
      messageApi.success('Task added!')
    }
    await loadTasks()
  }

  // Delete task
  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) {
      messageApi.error('Failed to delete task')
      throw error
    }
    messageApi.success('Task deleted')
    await loadTasks()
  }

  // Drag-and-drop status change
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    )
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', taskId)

    if (error) {
      messageApi.error('Failed to move task')
      await loadTasks() // revert
    }
  }

  const openNewTask = () => {
    setEditTask(null)
    setModalOpen(true)
  }

  const openEditTask = (task: Task) => {
    setEditTask(task)
    setModalOpen(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('foragebali_auth')
    setAuthed(false)
  }

  if (!authed) {
    return (
      <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
        <PasswordGate onUnlock={() => setAuthed(true)} />
      </ConfigProvider>
    )
  }

  // Stats
  const todoCount = filteredTasks.filter((t) => normalizeStatus(t.status) === 'todo').length
  const doneCount = filteredTasks.filter((t) => normalizeStatus(t.status) === 'done').length

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 8,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
      }}
    >
      {contextHolder}

      {/* Header */}
      <div
        style={{
          background: 'white',
          borderBottom: '1px solid #f0f0f0',
          padding: '12px 16px 8px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🌿</span>
            <Title level={5} style={{ margin: 0, color: '#111' }}>
              Forage Bali
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {todoCount} left · {doneCount} done
            </Text>
          </div>
          <Button
            type="text"
            size="small"
            icon={<LogoutOutlined />}
            onClick={handleLogout}
            style={{ color: '#8c8c8c' }}
          />
        </div>

        {/* Filters */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <FilterOutlined style={{ color: '#8c8c8c', fontSize: 13 }} />

          {/* Owner filter */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['All', 'Iso', 'Yuka', 'Carla', 'Alex'].map((o) => (
              <button
                key={o}
                onClick={() => setOwnerFilter(o)}
                style={{
                  padding: '3px 10px',
                  borderRadius: 12,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: ownerFilter === o ? 600 : 400,
                  background:
                    ownerFilter === o
                      ? o === 'All'
                        ? '#1677ff'
                        : o === 'Iso'
                        ? '#1677ff'
                        : o === 'Yuka'
                        ? '#52c41a'
                        : o === 'Carla'
                        ? '#fa8c16'
                        : '#722ed1'
                      : '#f0f0f0',
                  color: ownerFilter === o ? 'white' : '#595959',
                  transition: 'all 0.15s',
                }}
              >
                {o}
              </button>
            ))}
          </div>

          {/* Week filter */}
          {weekOptions.length > 0 && (
            <Select
              size="small"
              value={weekFilter}
              onChange={setWeekFilter}
              style={{ minWidth: 90 }}
              options={[
                { value: 'All', label: 'All Weeks' },
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
              style={{ minWidth: 100 }}
              options={[
                { value: 'All', label: 'All Months' },
                ...monthOptions.map((m) => ({ value: m, label: m })),
              ]}
            />
          )}
        </div>
      </div>

      {/* Board */}
      <div style={{ padding: '16px 12px', minHeight: 'calc(100vh - 120px)' }}>
        <KanbanBoard
          tasks={filteredTasks}
          loading={loading}
          onTaskClick={openEditTask}
          onStatusChange={handleStatusChange}
        />
      </div>

      {/* FAB */}
      <FloatButton
        icon={<PlusOutlined />}
        type="primary"
        onClick={openNewTask}
        style={{
          right: 20,
          bottom: 24,
          width: 52,
          height: 52,
        }}
        tooltip="Add task"
      />

      {/* Task modal */}
      <TaskModal
        task={editTask}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditTask(null)
        }}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </ConfigProvider>
  )
}

export default App
