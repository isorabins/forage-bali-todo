import { useState, useEffect } from 'react'
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Space,
  Typography,
  Divider,
  Popconfirm,
} from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import type { Task } from '../types'
import { OWNERS, OWNER_COLORS, OWNER_BG, STATUS_COLUMNS, normalizeStatus } from '../types'

const { TextArea } = Input
const { Text } = Typography

interface Props {
  task?: Task | null
  open: boolean
  onClose: () => void
  onSave: (data: Partial<Task>) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

const WEEK_OPTIONS = [
  'Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6',
  'Week 7', 'Week 8', 'Week 9', 'Week 10', 'Week 11', 'Week 12',
]
const MONTH_OPTIONS = ['Month 1', 'Month 2', 'Month 3']

export function TaskModal({ task, open, onClose, onSave, onDelete }: Props) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isEditing = !!task

  useEffect(() => {
    if (open) {
      if (task) {
        form.setFieldsValue({
          title: task.title,
          description: task.description || '',
          owner: task.owner || task.assigned_agent || undefined,
          status: normalizeStatus(task.status),
          priority: task.priority === 'medium' ? 'normal' : (task.priority || 'normal'),
          week: task.week || undefined,
          month: task.month || undefined,
          due_date: task.due_date || '',
        })
      } else {
        form.resetFields()
        form.setFieldsValue({ status: 'todo', priority: 'normal' })
      }
    }
  }, [open, task, form])

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      await onSave(values)
      onClose()
    } catch {
      // validation failed
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!task?.id || !onDelete) return
    setDeleting(true)
    await onDelete(task.id)
    setDeleting(false)
    onClose()
  }

  return (
    <Modal
      title={
        <span
          style={{
            fontSize: 15,
            fontWeight: 500,
            letterSpacing: '-0.01em',
            color: 'var(--text-primary)',
          }}
        >
          {isEditing ? 'Edit task' : 'New task'}
        </span>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width="min(96vw, 480px)"
      style={{ top: 20 }}
      destroyOnClose
      styles={{
        header: { borderBottom: '1px solid var(--border)', paddingBottom: 12 },
      }}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="title"
          label={<MetaLabel>Title</MetaLabel>}
          rules={[{ required: true, message: 'Title is required' }]}
        >
          <Input
            placeholder="What needs to be done?"
            size="large"
            autoFocus
            style={{ borderRadius: 6 }}
          />
        </Form.Item>

        <Form.Item name="description" label={<MetaLabel>Description</MetaLabel>}>
          <TextArea
            rows={3}
            placeholder="Optional notes..."
            style={{ resize: 'none', borderRadius: 6 }}
          />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="owner" label={<MetaLabel>Owner</MetaLabel>}>
            <Select placeholder="Assign to..." allowClear>
              {OWNERS.map((o) => (
                <Select.Option key={o} value={o}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '1px 7px',
                        borderRadius: 10,
                        background: OWNER_BG[o],
                        color: OWNER_COLORS[o],
                        fontSize: 11,
                        fontWeight: 500,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {o}
                    </span>
                  </span>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="priority" label={<MetaLabel>Priority</MetaLabel>}>
            <Select>
              <Select.Option value="high">High</Select.Option>
              <Select.Option value="normal">Normal</Select.Option>
              <Select.Option value="low">Low</Select.Option>
            </Select>
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="status" label={<MetaLabel>Status</MetaLabel>}>
            <Select>
              {STATUS_COLUMNS.map((s) => (
                <Select.Option key={s.key} value={s.key}>
                  {s.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="due_date" label={<MetaLabel>Due date</MetaLabel>}>
            <Input type="date" style={{ borderRadius: 6 }} />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="week" label={<MetaLabel>Week</MetaLabel>}>
            <Select placeholder="Week..." allowClear>
              {WEEK_OPTIONS.map((w) => (
                <Select.Option key={w} value={w}>{w}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="month" label={<MetaLabel>Month</MetaLabel>}>
            <Select placeholder="Month..." allowClear>
              {MONTH_OPTIONS.map((m) => (
                <Select.Option key={m} value={m}>{m}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </div>

        {isEditing && (
          <>
            <Divider style={{ margin: '4px 0 14px', borderColor: 'var(--border)' }} />
            <Text style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
              Created {task?.created_at ? new Date(task.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
            </Text>
          </>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 20,
          }}
        >
          {isEditing && onDelete ? (
            <Popconfirm
              title="Delete this task?"
              description="This cannot be undone."
              onConfirm={handleDelete}
              okText="Delete"
              okButtonProps={{ danger: true }}
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                loading={deleting}
                size="small"
              >
                Delete
              </Button>
            </Popconfirm>
          ) : (
            <div />
          )}

          <Space>
            <Button onClick={onClose} size="small">Cancel</Button>
            <Button type="primary" onClick={handleSave} loading={saving} size="small">
              {isEditing ? 'Save changes' : 'Add task'}
            </Button>
          </Space>
        </div>
      </Form>
    </Modal>
  )
}

function MetaLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
      }}
    >
      {children}
    </span>
  )
}
