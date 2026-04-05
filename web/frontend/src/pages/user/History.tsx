import { useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts'
import { Calendar, TrendingUp, TrendingDown, Clock } from 'lucide-react'

const weeklyData = [
  { gun: 'Pzt', stres: 65, max: 89, min: 20 },
  { gun: 'Sal', stres: 45, max: 72, min: 15 },
  { gun: 'Çar', stres: 78, max: 95, min: 30 },
  { gun: 'Per', stres: 32, max: 58, min: 10 },
  { gun: 'Cum', stres: 88, max: 99, min: 45 },
  { gun: 'Cmt', stres: 41, max: 65, min: 12 },
  { gun: 'Paz', stres: 25, max: 40, min: 8  },
]

const hourlyData = Array.from({ length: 24 }, (_, i) => ({
  saat: `${i}:00`,
  stres: Math.floor(Math.random() * 100),
}))

const sessions = [
  { tarih: '5 Nis 2025', sure: '4sa 20dk', ort: 52, maks: 89, durum: 'yüksek' },
  { tarih: '4 Nis 2025', sure: '6sa 10dk', ort: 41, maks: 76, durum: 'orta'   },
  { tarih: '3 Nis 2025', sure: '3sa 45dk', ort: 28, maks: 55, durum: 'düşük'  },
  { tarih: '2 Nis 2025', sure: '5sa 30dk', ort: 67, maks: 91, durum: 'yüksek' },
  { tarih: '1 Nis 2025', sure: '4sa 50dk', ort: 35, maks: 62, durum: 'orta'   },
]

const statusColor: Record<string, string> = {
  yüksek: '#ff4560',
  orta:   '#feb019',
  düşük:  '#00e396',
}

export default function History() {
  const [activeRange, setActiveRange] = useState('hafta')
  const [activeSession, setActiveSession] = useState<number | null>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
            Stres Geçmişi 📈
          </h1>
          <p style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 600 }}>
            Geçmiş stres verilerinizi inceleyin
          </p>
        </div>

        {/* Zaman Aralığı */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {['bugün', 'hafta', 'ay'].map(r => (
            <button
              key={r}
              onClick={() => setActiveRange(r)}
              style={{
                padding: '8px 18px', borderRadius: '10px', cursor: 'pointer',
                background: activeRange === r
                  ? 'linear-gradient(135deg, #6c3fd6, #3b6fd4)'
                  : 'rgba(255,255,255,0.05)',
                border: activeRange === r ? 'none' : '1px solid #252d4a',
                color: '#fff', fontSize: '13px', fontWeight: 700,
                boxShadow: activeRange === r
                  ? '0 4px 16px rgba(108, 63, 214, 0.4)' : 'none',
              }}
            >
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Özet Kartlar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {[
          { label: 'Haftalık Ort.',  value: '%52', icon: TrendingUp,   color: '#feb019' },
          { label: 'En Yüksek',     value: '%99', icon: TrendingUp,   color: '#ff4560' },
          { label: 'En Düşük',      value: '%8',  icon: TrendingDown, color: '#00e396' },
          { label: 'Toplam Süre',   value: '24sa', icon: Clock,       color: '#00d4ff' },
        ].map((item, i) => (
          <div key={i} style={{
            padding: '24px',
            background: 'linear-gradient(135deg, #1e2540, #131629)',
            borderRadius: '20px', border: '1px solid #252d4a',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8' }}>
                {item.label}
              </span>
              <item.icon size={18} color={item.color} />
            </div>
            <div style={{ fontSize: '36px', fontWeight: 900, color: item.color }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Haftalık Bar Chart */}
      <div style={{
        padding: '24px',
        background: 'linear-gradient(135deg, #1e2540, #131629)',
        borderRadius: '20px', border: '1px solid #252d4a',
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#fff', marginBottom: '24px' }}>
          Haftalık Stres Dağılımı
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={weeklyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#252d4a" />
            <XAxis dataKey="gun" stroke="#475569" tick={{ fontSize: 12, fontWeight: 700, fill: '#94a3b8' }} />
            <YAxis stroke="#475569" tick={{ fontSize: 12, fontWeight: 700, fill: '#94a3b8' }} />
            <Tooltip
              contentStyle={{
                background: '#1e2540', border: '1px solid #252d4a',
                borderRadius: '12px', color: '#fff', fontWeight: 700
              }}
            />
            <Bar dataKey="stres" fill="url(#barGradient)" radius={[8, 8, 0, 0]} />
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6c3fd6" />
                <stop offset="100%" stopColor="#3b6fd4" />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Saatlik Area Chart */}
      <div style={{
        padding: '24px',
        background: 'linear-gradient(135deg, #1e2540, #131629)',
        borderRadius: '20px', border: '1px solid #252d4a',
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#fff', marginBottom: '24px' }}>
          Günlük Stres Trendi (Saatlik)
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={hourlyData}>
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#6c3fd6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6c3fd6" stopOpacity={0}   />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#252d4a" />
            <XAxis dataKey="saat" stroke="#475569" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis stroke="#475569" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <Tooltip
              contentStyle={{
                background: '#1e2540', border: '1px solid #252d4a',
                borderRadius: '12px', color: '#fff', fontWeight: 700
              }}
            />
            <Area
              type="monotone" dataKey="stres"
              stroke="#6c3fd6" strokeWidth={2}
              fill="url(#areaGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Oturum Geçmişi Tablosu */}
      <div style={{
        padding: '24px',
        background: 'linear-gradient(135deg, #1e2540, #131629)',
        borderRadius: '20px', border: '1px solid #252d4a',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Calendar size={18} color="#6c3fd6" />
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#fff' }}>
            Oturum Geçmişi
          </h3>
        </div>

        {/* Tablo Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
          padding: '12px 16px', marginBottom: '8px',
          borderBottom: '1px solid #252d4a',
        }}>
          {['Tarih', 'Süre', 'Ort. Stres', 'Maks. Stres', 'Durum', 'Detay'].map(h => (
            <span key={h} style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
              {h}
            </span>
          ))}
        </div>

        {/* Tablo Satırları */}
        {sessions.map((s, i) => (
          <div
            key={i}
            onClick={() => setActiveSession(activeSession === i ? null : i)}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
              padding: '16px', borderRadius: '12px', cursor: 'pointer',
              background: activeSession === i
                ? 'rgba(108, 63, 214, 0.1)' : 'transparent',
              border: '1px solid',
              borderColor: activeSession === i ? '#6c3fd6' : 'transparent',
              marginBottom: '4px', transition: 'all 0.2s',
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>
              {s.tarih}
            </span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8' }}>
              {s.sure}
            </span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#feb019' }}>
              %{s.ort}
            </span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#ff4560' }}>
              %{s.maks}
            </span>
            <span style={{
              fontSize: '12px', fontWeight: 700,
              padding: '4px 10px', borderRadius: '20px', width: 'fit-content',
              background: `${statusColor[s.durum]}20`,
              color: statusColor[s.durum],
            }}>
              {s.durum}
            </span>
            <span style={{
              fontSize: '13px', fontWeight: 700,
              color: '#6c3fd6', cursor: 'pointer',
            }}>
              {activeSession === i ? 'Kapat ↑' : 'Detay →'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
