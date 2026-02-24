import { useState } from 'react'
import { Button, Input, Typography, Card } from 'antd'
import { LockOutlined } from '@ant-design/icons'

const { Title, Text } = Typography
const PASSWORD = 'foragebali2026'
const STORAGE_KEY = 'foragebali_auth'

interface Props {
  onUnlock: () => void
}

export function PasswordGate({ onUnlock }: Props) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  const handleSubmit = () => {
    if (value === PASSWORD) {
      localStorage.setItem(STORAGE_KEY, 'true')
      onUnlock()
    } else {
      setError(true)
      setShake(true)
      setTimeout(() => setShake(false), 600)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 24,
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 380,
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          animation: shake ? 'shake 0.5s ease' : undefined,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🌿</div>
          <Title level={3} style={{ margin: 0, color: '#1a1a1a' }}>
            Forage Bali
          </Title>
          <Text type="secondary">Team Task Board</Text>
        </div>

        <Input.Password
          prefix={<LockOutlined style={{ color: '#8c8c8c' }} />}
          placeholder="Enter password"
          size="large"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError(false)
          }}
          onPressEnter={handleSubmit}
          status={error ? 'error' : undefined}
          style={{ marginBottom: 8, borderRadius: 8 }}
          autoFocus
        />

        {error && (
          <Text type="danger" style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
            Incorrect password. Try again.
          </Text>
        )}

        <Button
          type="primary"
          size="large"
          block
          onClick={handleSubmit}
          style={{
            borderRadius: 8,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            marginTop: error ? 0 : 16,
          }}
        >
          Enter
        </Button>
      </Card>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-8px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  )
}

export function isAuthenticated(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true'
}
