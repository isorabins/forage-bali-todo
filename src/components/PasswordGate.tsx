import { useState } from 'react'

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

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 340,
          animation: shake ? 'shake 0.5s ease' : undefined,
        }}
      >
        {/* Wordmark */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontWeight: 500,
              fontSize: 22,
              letterSpacing: '-0.03em',
              color: 'var(--text-primary)',
              marginBottom: 6,
            }}
          >
            Forage Bali
          </div>
          <div
            style={{
              fontSize: 12,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}
          >
            Team workspace
          </div>
        </div>

        {/* Form */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '28px 24px',
            boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
          }}
        >
          <input
            type="password"
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setError(false)
            }}
            onKeyDown={handleKey}
            placeholder="Password"
            autoFocus
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: 14,
              fontFamily: "'Inter', system-ui, sans-serif",
              border: `1px solid ${error ? '#c0392b' : 'var(--border)'}`,
              borderRadius: 6,
              outline: 'none',
              color: 'var(--text-primary)',
              background: 'var(--bg)',
              marginBottom: error ? 8 : 16,
              transition: 'border-color 0.15s',
            }}
          />

          {error && (
            <div
              style={{
                fontSize: 12,
                color: '#c0392b',
                marginBottom: 12,
              }}
            >
              Incorrect password. Try again.
            </div>
          )}

          <button
            onClick={handleSubmit}
            style={{
              width: '100%',
              padding: '10px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              fontFamily: "'Inter', system-ui, sans-serif",
              fontWeight: 500,
              letterSpacing: '0.04em',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              ;(e.target as HTMLButtonElement).style.background = 'var(--accent-hover)'
            }}
            onMouseLeave={(e) => {
              ;(e.target as HTMLButtonElement).style.background = 'var(--accent)'
            }}
          >
            Enter
          </button>
        </div>
      </div>
    </div>
  )
}

export function isAuthenticated(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true'
}
