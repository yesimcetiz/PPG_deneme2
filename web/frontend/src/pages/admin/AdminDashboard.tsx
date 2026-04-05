import { useState } from 'react'
import {
  Activity, Users, Server, AlertTriangle,
  CheckCircle, Wifi, Database, Cpu
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

const apiData = Array.from({ length: 20 }, (_, i) => ({
  time: `${i}:00`,
  requests: Math.floor(Math.random() * 200 + 50),
  errors: Math.floor(Math.random() * 10),
}))

const logs = [
  { type: 'error',   time: '03:41:55', message: 'Sensör E4-002 bağlantısı kesildi. Retry: 3/5'        },
  { type: 'warning', time: '03:41:30', message: 'Yüksek stres algılandı. User: yesim@mail.com %91'     },
  { type: 'success', time: '03:41:00', message: 'Model inference başarılı. Süre: 18ms'                 },
  { type: 'error',   time: '03:40:45', message: '/predict 422 Validation Error: MeanNN_base sıfır'     },
  { type: 'success', time: '03:40:30', message: 'Kullanıcı girişi başarılı. User: yesim@mail.com'      },
  { type: 'warning', time: '03:40:00', message: 'Yüksek hareket gürültüsü algılandı. E4-001'          },
  { type: 'success', time: '03:39:45', message: 'WebSocket bağlantısı kuruldu. Device: E4-001'        },
]

const logColor: Record<string, string> = {
  error:   '#ff4560',
  warning: '#feb019',
  success: '#00e396',
}

const logIcon: Record<string, string> = {
  error:   '��',
  warning: '🟡',
  success: '🟢',
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview')

  const tabs = [
    { key: 'overview', label: '📊 Genel Bakış' },
    { key: 'sensors',  label: '🔌 Sensörler'   },
    { key: 'logs',     label: '📋 Loglar'       },
    { key: 'users',    label: '👥 Kullanıcılar' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
            Admin Panel ⚙️
          </h1>
          <p style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 600 }}>
            Sistem durumu ve yönetim
          </p>
        </div>
        <div style={{
          padding: '8px 16px', borderRadius: '12px',
          background: 'rgba(0, 227, 150, 0.1)',
          border: '1px solid rgba(0, 227, 150, 0.3)',
          fontSize: '13px', fontWeight: 700, color: '#00e396',
        }}>
          🟢 Sistem Aktif
        </div>
      </div>

      {/* Sistem Durumu Kartları */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {[
          { label: 'Backend',   value: 'Aktif',  sub: '45ms',    icon: Server,   color: '#00e396', ok: true  },
          { label: 'Database',  value: 'Aktif',  sub: '12ms',    icon: Database, color: '#00e396', ok: true  },
          { label: 'ML Model',  value: 'Yüklü',  sub: 'v2.1',    icon: Cpu,      color: '#00e396', ok: true  },
          { label: 'Sensörler', value: '1/2',    sub: 'Bağlı',   icon: Wifi,     color: '#feb019', ok: false },
        ].map((item, i) => (
          <div key={i} style={{
            padding: '24px',
            background: 'linear-gradient(135deg, #1e2540, #131629)',
            borderRadius: '20px', border: '1px solid #252d4a',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8' }}>
                {item.label}
              </span>
              <item.icon size={18} color={item.color} />
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: item.color, marginBottom: '4px' }}>
              {item.value}
            </div>
            <div style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>
              {item.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px', borderRadius: '12px', cursor: 'pointer',
              background: activeTab === tab.key
                ? 'linear-gradient(135deg, #6c3fd6, #3b6fd4)'
                : 'rgba(255,255,255,0.05)',
              border: activeTab === tab.key ? 'none' : '1px solid #252d4a',
              color: '#fff', fontSize: '14px', fontWeight: 700,
              boxShadow: activeTab === tab.key
                ? '0 4px 16px rgba(108, 63, 214, 0.4)' : 'none',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Genel Bakış */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* API İstatistikleri */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            {[
              { label: 'Toplam İstek',  value: '1,247', color: '#00d4ff' },
              { label: 'Başarılı',      value: '1,198', color: '#00e396' },
              { label: 'Hatalı',        value: '49',    color: '#ff4560' },
              { label: 'Ort. Response', value: '23ms',  color: '#feb019' },
            ].map((item, i) => (
              <div key={i} style={{
                padding: '20px',
                background: 'linear-gradient(135deg, #1e2540, #131629)',
                borderRadius: '16px', border: '1px solid #252d4a',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '28px', fontWeight: 900, color: item.color, marginBottom: '8px' }}>
                  {item.value}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8' }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>

          {/* API Grafiği */}
          <div style={{
            padding: '24px',
            background: 'linear-gradient(135deg, #1e2540, #131629)',
            borderRadius: '20px', border: '1px solid #252d4a',
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#fff', marginBottom: '24px' }}>
              API İstek Trendi
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={apiData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#252d4a" />
                <XAxis dataKey="time" stroke="#475569" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis stroke="#475569" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{
                  background: '#1e2540', border: '1px solid #252d4a',
                  borderRadius: '12px', color: '#fff', fontWeight: 700
                }} />
                <Line type="monotone" dataKey="requests" stroke="#6c3fd6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="errors"   stroke="#ff4560" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Son Loglar */}
          <div style={{
            padding: '24px',
            background: 'linear-gradient(135deg, #1e2540, #131629)',
            borderRadius: '20px', border: '1px solid #252d4a',
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#fff', marginBottom: '20px' }}>
              Son Sistem Logları
            </h3>
            {logs.slice(0, 4).map((log, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                padding: '12px 16px', borderRadius: '12px', marginBottom: '8px',
                background: `${logColor[log.type]}10`,
                border: `1px solid ${logColor[log.type]}30`,
              }}>
                <span style={{ fontSize: '16px' }}>{logIcon[log.type]}</span>
                <span style={{ fontSize: '12px', color: '#475569', fontWeight: 700, minWidth: '60px' }}>
                  {log.time}
                </span>
                <span style={{ fontSize: '13px', color: logColor[log.type], fontWeight: 600 }}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sensörler */}
      {activeTab === 'sensors' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            padding: '24px',
            background: 'linear-gradient(135deg, #1e2540, #131629)',
            borderRadius: '20px', border: '1px solid #252d4a',
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#fff', marginBottom: '20px' }}>
              Bağlı Cihazlar
            </h3>

            {[
              { id: 'E4-001', user: 'Yeşim Çetiz',  status: true,  lastData: '0.5sn önce', meanNN: '0.692', sdnn: '0.045', rmssd: '0.038', stress: 78 },
              { id: 'E4-002', user: 'Test Kullanıcı', status: false, lastData: '5dk önce',   meanNN: '-',     sdnn: '-',     rmssd: '-',     stress: 0  },
            ].map((device, i) => (
              <div key={i} style={{
                padding: '20px', borderRadius: '16px', marginBottom: '12px',
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${device.status ? '#00e39640' : '#ff456040'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Wifi size={20} color={device.status ? '#00e396' : '#ff4560'} />
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff' }}>
                        {device.id}
                      </div>
                      <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>
                        {device.user}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: '12px', fontWeight: 700, padding: '4px 12px',
                      borderRadius: '20px', marginBottom: '4px',
                      background: device.status ? 'rgba(0,227,150,0.1)' : 'rgba(255,69,96,0.1)',
                      color: device.status ? '#00e396' : '#ff4560',
                    }}>
                      {device.status ? '🟢 Bağlı' : '🔴 Bağlı Değil'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>
                      {device.lastData}
                    </div>
                  </div>
                </div>

                {device.status && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                    {[
                      { label: 'MeanNN', value: device.meanNN },
                      { label: 'SDNN',   value: device.sdnn   },
                      { label: 'RMSSD',  value: device.rmssd  },
                      { label: 'Stres',  value: `%${device.stress}` },
                    ].map((metric, j) => (
                      <div key={j} style={{
                        padding: '12px', borderRadius: '12px', textAlign: 'center',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid #252d4a',
                      }}>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
                          {metric.value}
                        </div>
                        <div style={{ fontSize: '11px', color: '#475569', fontWeight: 700 }}>
                          {metric.label}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!device.status && (
                  <div style={{
                    padding: '12px 16px', borderRadius: '12px',
                    background: 'rgba(255, 69, 96, 0.1)',
                    border: '1px solid rgba(255, 69, 96, 0.3)',
                    display: 'flex', alignItems: 'center', gap: '8px',
                  }}>
                    <AlertTriangle size={16} color="#ff4560" />
                    <span style={{ fontSize: '13px', color: '#ff4560', fontWeight: 700 }}>
                      Bağlantı kesildi. Otomatik yeniden bağlanma deneniyor...
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loglar */}
      {activeTab === 'logs' && (
        <div style={{
          padding: '24px',
          background: 'linear-gradient(135deg, #1e2540, #131629)',
          borderRadius: '20px', border: '1px solid #252d4a',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#fff' }}>
              Sistem Logları
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['Tümü', 'Hata', 'Uyarı', 'Bilgi'].map(f => (
                <button key={f} style={{
                  padding: '6px 14px', borderRadius: '8px', cursor: 'pointer',
                  background: f === 'Tümü' ? 'linear-gradient(135deg, #6c3fd6, #3b6fd4)' : 'transparent',
                  border: f === 'Tümü' ? 'none' : '1px solid #252d4a',
                  color: '#fff', fontSize: '12px', fontWeight: 700,
                }}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {logs.map((log, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '16px',
              padding: '14px 16px', borderRadius: '12px', marginBottom: '8px',
              background: `${logColor[log.type]}08`,
              border: `1px solid ${logColor[log.type]}25`,
            }}>
              <span style={{ fontSize: '16px' }}>{logIcon[log.type]}</span>
              <span style={{ fontSize: '12px', color: '#475569', fontWeight: 700, minWidth: '65px' }}>
                {log.time}
              </span>
              <span style={{
                fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px',
                background: `${logColor[log.type]}20`, color: logColor[log.type], minWidth: '60px',
                textAlign: 'center',
              }}>
                {log.type.toUpperCase()}
              </span>
              <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>
                {log.message}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Kullanıcılar */}
      {activeTab === 'users' && (
        <div style={{
          padding: '24px',
          background: 'linear-gradient(135deg, #1e2540, #131629)',
          borderRadius: '20px', border: '1px solid #252d4a',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#fff' }}>
              Kullanıcılar
            </h3>
            <div style={{ display: 'flex', gap: '16px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#94a3b8' }}>
                Toplam: <span style={{ color: '#fff' }}>12</span>
              </span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#94a3b8' }}>
                Aktif: <span style={{ color: '#00e396' }}>3</span>
              </span>
            </div>
          </div>

          {/* Tablo Header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr',
            padding: '12px 16px', marginBottom: '8px',
            borderBottom: '1px solid #252d4a',
          }}>
            {['Kullanıcı', 'Email', 'Durum', 'Stres Ort.', 'Son Giriş'].map(h => (
              <span key={h} style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                {h}
              </span>
            ))}
          </div>

          {[
            { name: 'Yeşim Çetiz',    email: 'yesim@mail.com',  active: true,  stress: '%52', lastLogin: '2dk önce' },
            { name: 'Test Kullanıcı', email: 'test@mail.com',   active: false, stress: '%34', lastLogin: '2sa önce' },
            { name: 'Demo User',      email: 'demo@mail.com',   active: false, stress: '%67', lastLogin: '1g önce'  },
          ].map((user, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr',
              padding: '16px', borderRadius: '12px', marginBottom: '4px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid transparent',
              transition: 'all 0.2s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #c850c0, #6c3fd6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', fontWeight: 800, color: '#fff',
                }}>
                  {user.name[0]}
                </div>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>
                  {user.name}
                </span>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8', alignSelf: 'center' }}>
                {user.email}
              </span>
              <span style={{ alignSelf: 'center' }}>
                <span style={{
                  fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px',
                  background: user.active ? 'rgba(0,227,150,0.1)' : 'rgba(255,255,255,0.05)',
                  color: user.active ? '#00e396' : '#475569',
                }}>
                  {user.active ? 'Aktif' : 'Pasif'}
                </span>
              </span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#feb019', alignSelf: 'center' }}>
                {user.stress}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569', alignSelf: 'center' }}>
                {user.lastLogin}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
