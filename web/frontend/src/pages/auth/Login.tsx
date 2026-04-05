import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Mail, Lock, Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    navigate('/dashboard')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d0f1a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        padding: '40px',
        background: 'linear-gradient(135deg, #1e2540 0%, #131629 100%)',
        borderRadius: '24px',
        border: '1px solid #252d4a',
        boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #6c3fd6, #3b6fd4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto',
            boxShadow: '0 8px 24px rgba(108, 63, 214, 0.4)',
          }}>
            <Activity size={28} color="white" />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
            StressAI
          </h1>
          <p style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 500 }}>
            Hesabınıza giriş yapın
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin}>

          {/* Email */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 700,
              color: '#94a3b8',
              marginBottom: '8px'
            }}>
              E-posta
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} color="#475569" style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)'
              }} />
              <input
                type="email"
                placeholder="ornek@mail.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 42px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid #252d4a',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Şifre */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 700,
              color: '#94a3b8',
              marginBottom: '8px'
            }}>
              Şifre
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="#475569" style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)'
              }} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px 42px 12px 42px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid #252d4a',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <div
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  cursor: 'pointer'
                }}
              >
                {showPassword
                  ? <EyeOff size={16} color="#475569" />
                  : <Eye size={16} color="#475569" />
                }
              </div>
            </div>
          </div>

          {/* Giriş Butonu */}
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '14px',
              background: 'linear-gradient(135deg, #6c3fd6, #3b6fd4)',
              border: 'none',
              borderRadius: '12px',
              color: '#fff',
              fontSize: '15px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(108, 63, 214, 0.4)',
              marginBottom: '16px',
            }}
          >
            Giriş Yap
          </button>

          {/* Kayıt ol linki */}
          <p style={{ textAlign: 'center', fontSize: '14px', color: '#94a3b8', fontWeight: 600 }}>
            Hesabınız yok mu?{' '}
            <span
              onClick={() => navigate('/register')}
              style={{ color: '#6c3fd6', cursor: 'pointer', fontWeight: 800 }}
            >
              Kayıt Ol
            </span>
          </p>
        </form>
      </div>
    </div>
  )
}
