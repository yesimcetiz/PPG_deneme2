import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  User,
  History,
  MessageCircle,
  Settings,
  LogOut,
  Activity
} from 'lucide-react'

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard',  path: '/dashboard' },
  { icon: User,            label: 'Profil',     path: '/profile'   },
  { icon: History,         label: 'Geçmiş',     path: '/history'   },
  { icon: MessageCircle,   label: 'AI Asistan', path: '/chat'      },
]

const adminItems = [
  { icon: Settings, label: 'Admin Panel', path: '/admin' },
]

export default function Sidebar() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const [active, setActive] = useState(location.pathname)

  const handleNav = (path: string) => {
    setActive(path)
    navigate(path)
  }

  return (
    <div style={{
      width: '260px',
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #1a1f35 0%, #0d0f1a 100%)',
      borderRight: '1px solid #252d4a',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 16px',
      position: 'fixed',
      left: 0,
      top: 0,
    }}>

      {/* Logo */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '0 8px 32px 8px',
        borderBottom: '1px solid #252d4a',
        marginBottom: '24px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #6c3fd6, #3b6fd4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Activity size={22} color="white" />
        </div>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff' }}>
            StressAI
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>
            Sağlık Asistanı
          </div>
        </div>
      </div>

      {/* Kullanıcı Bilgisi */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '12px',
        marginBottom: '24px'
      }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #c850c0, #6c3fd6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          fontWeight: 800,
          color: '#fff'
        }}>Y</div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>
            Yeşim Çetiz
          </div>
          <div style={{ fontSize: '11px', color: '#00e396', fontWeight: 600 }}>
            🟢 Sensör Bağlı
          </div>
        </div>
      </div>

      {/* Menü */}
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: '10px',
          color: '#475569',
          fontWeight: 700,
          letterSpacing: '1.5px',
          marginBottom: '8px',
          padding: '0 8px'
        }}>MENÜ</div>

        {menuItems.map((item) => {
          const isActive = active === item.path
          return (
            <div
              key={item.path}
              onClick={() => handleNav(item.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '12px',
                marginBottom: '4px',
                cursor: 'pointer',
                background: isActive
                  ? 'linear-gradient(135deg, #6c3fd6, #3b6fd4)'
                  : 'transparent',
                boxShadow: isActive
                  ? '0 4px 15px rgba(108, 63, 214, 0.4)'
                  : 'none',
                transition: 'all 0.2s',
              }}
            >
              <item.icon
                size={18}
                color={isActive ? '#fff' : '#94a3b8'}
              />
              <span style={{
                fontSize: '14px',
                fontWeight: 700,
                color: isActive ? '#fff' : '#94a3b8'
              }}>
                {item.label}
              </span>
            </div>
          )
        })}

        {/* Admin */}
        <div style={{
          fontSize: '10px',
          color: '#475569',
          fontWeight: 700,
          letterSpacing: '1.5px',
          margin: '24px 0 8px 0',
          padding: '0 8px'
        }}>YÖNETİM</div>

        {adminItems.map((item) => {
          const isActive = active === item.path
          return (
            <div
              key={item.path}
              onClick={() => handleNav(item.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '12px',
                marginBottom: '4px',
                cursor: 'pointer',
                background: isActive
                  ? 'linear-gradient(135deg, #6c3fd6, #3b6fd4)'
                  : 'transparent',
                transition: 'all 0.2s',
              }}
            >
              <item.icon
                size={18}
                color={isActive ? '#fff' : '#94a3b8'}
              />
              <span style={{
                fontSize: '14px',
                fontWeight: 700,
                color: isActive ? '#fff' : '#94a3b8'
              }}>
                {item.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Çıkış */}
      <div
        onClick={() => navigate('/login')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          borderRadius: '12px',
          cursor: 'pointer',
          border: '1px solid #252d4a',
          transition: 'all 0.2s',
        }}
      >
        <LogOut size={18} color="#ff4560" />
        <span style={{ fontSize: '14px', fontWeight: 700, color: '#ff4560' }}>
          Çıkış Yap
        </span>
      </div>
    </div>
  )
}
