import { useState, useEffect } from 'react'
import { Activity, Heart, Clock, TrendingUp, Bell, Wifi } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts'

// Fake data (gerçek sensör verisi gelince değişecek)
const generateData = () =>
  Array.from({ length: 20 }, (_, i) => ({
    time: `${i}:00`,
    stress: Math.random() * 100,
  }))

export default function Dashboard() {
  const [stressScore, setStressScore] = useState(78)
  const [data, setData] = useState(generateData())
  const [sensorConnected, setSensorConnected] = useState(true)

  // Fake anlık güncelleme (WebSocket gelince değişecek)
  useEffect(() => {
    const interval = setInterval(() => {
      setStressScore(Math.floor(Math.random() * 100))
      setData(generateData())
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const getStressColor = (score: number) => {
    if (score >= 70) return '#ff4560'
    if (score >= 40) return '#feb019'
    return '#00e396'
  }

  const getStressLabel = (score: number) => {
    if (score >= 70) return 'Yüksek ⚠️'
    if (score >= 40) return 'Orta'
    return 'Düşük ✓'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
            Merhaba, Yeşim 👋
          </h1>
          <p style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 600 }}>
            Anlık stres durumunuz izleniyor
          </p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 16px', borderRadius: '12px',
          background: sensorConnected ? 'rgba(0, 227, 150, 0.1)' : 'rgba(255, 69, 96, 0.1)',
          border: `1px solid ${sensorConnected ? '#00e396' : '#ff4560'}`,
        }}>
          <Wifi size={16} color={sensorConnected ? '#00e396' : '#ff4560'} />
          <span style={{
            fontSize: '13px', fontWeight: 700,
            color: sensorConnected ? '#00e396' : '#ff4560'
          }}>
            {sensorConnected ? 'Sensör Bağlı' : 'Sensör Bağlı Değil'}
          </span>
        </div>
      </div>

      {/* Üst Kartlar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>

        {/* Stres Skoru */}
        <div style={{
          padding: '24px',
          background: 'linear-gradient(135deg, #1e2540, #131629)',
          borderRadius: '20px', border: '1px solid #252d4a',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          gridColumn: 'span 1'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8' }}>
              Anlık Stres
            </span>
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px',
              background: `${getStressColor(stressScore)}20`,
              color: getStressColor(stressScore)
            }}>
              {getStressLabel(stressScore)}
            </span>
          </div>
          <div style={{ fontSize: '48px', fontWeight: 900, color: getStressColor(stressScore), marginBottom: '12px' }}>
            %{stressScore}
          </div>
          {/* Progress Bar */}
          <div style={{ height: '6px', background: '#252d4a', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${stressScore}%`,
              background: `linear-gradient(90deg, ${getStressColor(stressScore)}, ${getStressColor(stressScore)}aa)`,
              borderRadius: '3px', transition: 'all 0.5s ease'
            }} />
          </div>
        </div>

        {/* Kalp Atışı */}
        <div style={{
          padding: '24px',
          background: 'linear-gradient(135deg, #1e2540, #131629)',
          borderRadius: '20px', border: '1px solid #252d4a',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8' }}>Kalp Atışı</span>
            <Heart size={18} color="#ff4560" />
          </div>
          <div style={{ fontSize: '40px', fontWeight: 900, color: '#fff', marginBottom: '4px' }}>
            87
          </div>
          <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>bpm</span>
        </div>

        {/* Stres Süresi */}
        <div style={{
          padding: '24px',
          background: 'linear-gradient(135deg, #1e2540, #131629)',
          borderRadius: '20px', border: '1px solid #252d4a',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8' }}>Stres Süresi</span>
            <Clock size={18} color="#feb019" />
          </div>
          <div style={{ fontSize: '40px', fontWeight: 900, color: '#fff', marginBottom: '4px' }}>
            2sa
          </div>
          <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>bugün</span>
        </div>

        {/* HRV */}
        <div style={{
          padding: '24px',
          background: 'linear-gradient(135deg, #1e2540, #131629)',
          borderRadius: '20px', border: '1px solid #252d4a',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8' }}>HRV</span>
            <TrendingUp size={18} color="#00d4ff" />
          </div>
          <div style={{ fontSize: '40px', fontWeight: 900, color: '#fff', marginBottom: '4px' }}>
            42
          </div>
          <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>ms</span>
        </div>
      </div>

      {/* Grafik + Öneriler */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>

        {/* Stres Grafiği */}
        <div style={{
          padding: '24px',
          background: 'linear-gradient(135deg, #1e2540, #131629)',
          borderRadius: '20px', border: '1px solid #252d4a',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#fff' }}>
              Stres Trendi
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['1sa', '6sa', '1g'].map(t => (
                <button key={t} style={{
                  padding: '4px 12px', borderRadius: '8px', cursor: 'pointer',
                  background: t === '1sa' ? 'linear-gradient(135deg, #6c3fd6, #3b6fd4)' : 'transparent',
                  border: t === '1sa' ? 'none' : '1px solid #252d4a',
                  color: t === '1sa' ? '#fff' : '#94a3b8',
                  fontSize: '12px', fontWeight: 700,
                }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="stressGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6c3fd6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6c3fd6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#252d4a" />
              <XAxis dataKey="time" stroke="#475569" tick={{ fontSize: 11, fontWeight: 600 }} />
              <YAxis stroke="#475569" tick={{ fontSize: 11, fontWeight: 600 }} />
              <Tooltip
                contentStyle={{
                  background: '#1e2540', border: '1px solid #252d4a',
                  borderRadius: '12px', color: '#fff', fontWeight: 700
                }}
              />
              <Area
                type="monotone" dataKey="stress"
                stroke="#6c3fd6" strokeWidth={2}
                fill="url(#stressGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Öneriler */}
        <div style={{
          padding: '24px',
          background: 'linear-gradient(135deg, #1e2540, #131629)',
          borderRadius: '20px', border: '1px solid #252d4a',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <Bell size={18} color="#6c3fd6" />
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#fff' }}>Öneriler</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { icon: '💊', text: 'Metoprolol sabah dozunuzu aldınız mı?', color: '#ff4560', urgent: true },
              { icon: '🧘', text: '4-7-8 nefes egzersizi deneyin', color: '#00d4ff', urgent: false },
              { icon: '💧', text: 'Su içmeyi unutmayın', color: '#00e396', urgent: false },
              { icon: '🚶', text: '5 dakika yürüyüş yapın', color: '#feb019', urgent: false },
            ].map((item, i) => (
              <div key={i} style={{
                padding: '12px 16px', borderRadius: '12px',
                background: item.urgent ? `${item.color}15` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${item.urgent ? item.color + '40' : '#252d4a'}`,
                display: 'flex', alignItems: 'center', gap: '12px',
              }}>
                <span style={{ fontSize: '20px' }}>{item.icon}</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: item.urgent ? item.color : '#94a3b8' }}>
                  {item.text}
                </span>
              </div>
            ))}
          </div>

          {/* AI Asistan Butonu */}
          <button
            onClick={() => window.location.href = '/chat'}
            style={{
              width: '100%', marginTop: '20px', padding: '12px',
              background: 'linear-gradient(135deg, #6c3fd6, #3b6fd4)',
              border: 'none', borderRadius: '12px',
              color: '#fff', fontSize: '14px', fontWeight: 800,
              cursor: 'pointer', boxShadow: '0 4px 16px rgba(108, 63, 214, 0.4)',
            }}
          >
            💬 AI Asistana Sor
          </button>
        </div>
      </div>

      {/* Günlük Özet */}
      <div style={{
        padding: '24px',
        background: 'linear-gradient(135deg, #1e2540, #131629)',
        borderRadius: '20px', border: '1px solid #252d4a',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#fff', marginBottom: '20px' }}>
          Bugünkü Özet
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {[
            { label: 'Ortalama Stres', value: '%45', color: '#feb019' },
            { label: 'Maksimum Stres', value: '%91', color: '#ff4560' },
            { label: 'Minimum Stres', value: '%12', color: '#00e396' },
            { label: 'Stres Süresi', value: '2sa 15dk', color: '#00d4ff' },
          ].map((item, i) => (
            <div key={i} style={{
              padding: '16px', borderRadius: '12px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid #252d4a', textAlign: 'center'
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
      </div>
    </div>
  )
}
