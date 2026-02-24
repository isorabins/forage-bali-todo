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
import { OWNERS, OWNER_COLORS, STATUS_COLUMNS, normalizeStatus } from '../types'

const { TextArea } = Input
const { Text } = Typography

interface Props {
  task?: Task | null
  open: boolean
  onClose: () => void
  onSave: (data: Partial<Task>) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

const WEEK_OPTIONS = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7', 'Week 8', 'Week 9', 'Week 10', 'Week 11', 'Week 12']
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
    } catch (e) {
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
      title={isEditing ? 'Edit Task' : 'New Task'}
      open={open}
      onCancel={onClose}
      footer={null}
      width="min(96vw, 480px)"
      style={{ top: 20 }}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
        <Form.Item
          name="title"
          label="Title"
          rules={[{ required: true, message: 'Title is required' }]}
        >
          <Input placeholder="What needs to be done?" size="large" autoFocus />
        </Form.Item>

        <Form.Item name="description" label="Description">
          <TextArea
            rows={3}
            placeholder="Optional details..."
            style={{ resize: 'none' }}
          />
        </Form.Item>

        <Space style={{ width: '100%' }} direction="vertical" size={0}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="owner" label="Owner">
              <Select placeholder="Assign to..." allowClear>
                {OWNERS.map((o) => (
                  <Select.Option key={o} value={o}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: OWNER_COLORS[o],
                        marginRight: 6,
                      }}
                    />
                    {o}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item name="priority" label="Priority">
              <Select>
                <Select.Option value="high">🔴 High</Select.Option>
                <Select.Option value="normal">🟡 Normal</Select.Option>
                <Select.Option value="low">⚪ Low</Select.Option>
              </Select>
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="status" label="Status">
              <Select>
                {STATUS_COLUMNS.map((s) => (
                  <Select.Option key={s.key} value={s.key}>
                    {s.label}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item name="due_date" label="Due Date">
              <Input type="date" />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="week" label="Week">
              <Select placeholder="Week..." allowClear>
                {WEEK_OPTIONS.map((w) => (
                  <Select.Option key={w} value={w}>{w}</Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item name="month" label="Month">
              <Select placeholder="Month..." allowClear>
                {MONTH_OPTIONS.map((m) => (
                  <Select.Option key={m} value={m}>{m}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          </div>
        </Space>

        {isEditing && (
          <>
            <Divider style={{ margin: '8px 0 16px' }} />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Created {task?.created_at ? new Date(task.created_at).toLocaleDateString() : '—'}
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
              onConfirm={handleDelete}
              okText="Delete"
              okButtonProps={{ danger: true }}
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                loading={deleting}
              >
                Delete
              </Button>
            </Popconfirm>
          ) : (
            <div />
          )}

          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" onClick={handleSave} loading={saving}>
              {isEditing ? 'Save Changes' : 'Add Task'}
            </Button>
          </Space>
        </div>
      </Form>
    </Modal>
  )
}
