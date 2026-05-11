import { useState, useEffect } from 'react'
import { Heart, Clock, TrendingUp, Bell, Wifi, X, Send, Bot } from 'lucide-react'
import {
  XAxis, YAxis, CartesianGrid,
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
  const [sensorConnected] = useState(true)
  
  // AI Asistan için stateler
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [selectedModel, setSelectedModel] = useState('gemini-1.5-pro')
  const [prompt, setPrompt] = useState('')

  // Mesaj geçmişi ve yükleniyor durumu
  const [messages, setMessages] = useState([
    { 
      role: 'assistant', 
      content: 'Merhaba Yeşim! Ben sağlık asistanınızım. Sisteme bağlı sensör verilerinizi inceleyebilir ve size özel önerilerde bulunabilirim. Bugün nasıl hissediyorsunuz?' 
    },
    { 
      role: 'user', 
      content: 'Şu anki stres durumum ve verilerim ne alemde? Ne önerirsin?' 
    },
    { 
      role: 'assistant', 
      content: 'Hemen anlık verilerinizi analiz ediyorum...\n\n📊 **Güncel Durumunuz:**\n• Stres Skorunuz: %78 (Yüksek)\n• Kalp Atışınız: 87 bpm\n• HRV: 42 ms\n\n💡 **Analiz:** HRV değerinizin düşük ve kalp atışınızın normalin biraz üzerinde olması, sisteminizin şu an "savaş veya kaç" modunda olduğunu (sempatik sinir sistemi aktivasyonu) gösteriyor. \n\n🧘‍♀️ **Önerilerim:**\n1. Lütfen işinize 5 dakika ara verin.\n2. Kalp ritminizi pürüzsüzleştirmek için "4-7-8 nefes egzersizi" yapın (4sn nefes al, 7sn tut, 8sn ver).\n3. Bugün su tüketiminiz az görünüyorsa bir bardak su için.\n\nEgzersiz konusunda sizi sesli veya görsel olarak yönlendirmemi ister misiniz?' 
    }
  ])
  const [isLoading, setIsLoading] = useState(false)

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

  // Mesaj Gönderme Fonksiyonu
  const handleSendMessage = () => {
    if (!prompt.trim()) return;
    
    const userMessage = prompt;
    setPrompt(''); // Inputu temizle
    
    // 1. Kullanıcının mesajını ekrana ekle
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true); // "Yazıyor..." animasyonunu başlat

    // 2. Şimdilik FastAPI'ye bağlı olmadığı için sahte bir gecikme ve cevap ekliyoruz
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Şu an model bağlantısı kurulmadığı için simüle edilmiş bir cevap görüyorsun. Bana "${userMessage}" dedin. Model olarak ${selectedModel} seçili.` 
      }]);
      setIsLoading(false);
    }, 1500);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>

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

          {/* AI Asistan Butonu - Tıklanınca Modalı Açar */}
          <button
            onClick={() => setIsChatOpen(true)}
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

      {/* --- AI ASİSTAN MODALI --- */}
      {isChatOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            width: '100%', maxWidth: '600px', height: '600px',
            background: 'linear-gradient(135deg, #1e2540, #131629)',
            border: '1px solid #252d4a', borderRadius: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            
            {/* Modal Header & Model Seçici */}
            <div style={{
              padding: '20px', borderBottom: '1px solid #252d4a',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Bot size={24} color="#6c3fd6" />
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', margin: 0 }}>SAĞLIK ASİSTANI</h2>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  style={{
                    background: 'rgba(255,255,255,0.05)', color: '#fff',
                    border: '1px solid #252d4a', borderRadius: '8px',
                    padding: '8px 12px', fontSize: '13px', fontWeight: 600,
                    outline: 'none', cursor: 'pointer'
                  }}
                >
                  <option value="gemini-1.5-pro" style={{ background: '#1e2540' }}>Gemini 1.5 Pro</option>
                  <option value="gpt-4o" style={{ background: '#1e2540' }}>GPT-4 Omni</option>
                  <option value="med-llama" style={{ background: '#1e2540' }}>Med-Llama 3</option>
                </select>
                
                <button onClick={() => setIsChatOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <X size={24} color="#94a3b8" />
                </button>
              </div>
            </div>

            {/* Mesajlaşma Alanı (Geçmiş) */}
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', marginBottom: '10px' }}>
                Şu an <strong style={{ color: '#00d4ff' }}>{selectedModel}</strong> modeli seçili.
              </div>

              {/* Mesajları Listele */}
              {messages.map((msg, index) => (
                <div key={index} style={{
                  display: 'flex', 
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                }}>
                  <div style={{
                    maxWidth: '80%', padding: '12px 16px',
                    background: msg.role === 'user' ? 'linear-gradient(135deg, #6c3fd6, #3b6fd4)' : 'rgba(255,255,255,0.05)',
                    border: msg.role === 'user' ? 'none' : '1px solid #252d4a',
                    color: '#fff', fontSize: '14px', lineHeight: '1.5',
                    whiteSpace: 'pre-wrap', // Satır atlamaları düzeltildi
                    borderRadius: '16px',
                    borderBottomRightRadius: msg.role === 'user' ? '4px' : '16px',
                    borderBottomLeftRadius: msg.role === 'assistant' ? '4px' : '16px',
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))}

              {/* AI Cevap Beklerken Çıkan "Yazıyor..." Efekti */}
              {isLoading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{
                    background: 'rgba(255,255,255,0.05)', border: '1px solid #252d4a',
                    padding: '12px 16px', borderRadius: '16px', borderBottomLeftRadius: '4px',
                    color: '#94a3b8', fontSize: '13px', fontStyle: 'italic'
                  }}>
                    Asistan yazıyor...
                  </div>
                </div>
              )}
            </div>

            {/* Mesaj Gönderme Inputu */}
            <div style={{ padding: '20px', borderTop: '1px solid #252d4a', background: 'rgba(0,0,0,0.2)' }}>
              <div style={{
                display: 'flex', gap: '12px', background: 'rgba(255,255,255,0.05)',
                border: '1px solid #252d4a', borderRadius: '16px', padding: '8px'
              }}>
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Stres seviyem neden yüksek olabilir?"
                  style={{
                    flex: 1, background: 'transparent', border: 'none',
                    color: '#fff', fontSize: '14px', padding: '8px 12px', outline: 'none'
                  }}
                />
                <button
                  onClick={handleSendMessage}
                  style={{
                    background: 'linear-gradient(135deg, #6c3fd6, #3b6fd4)',
                    border: 'none', borderRadius: '12px', padding: '0 16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  <Send size={18} color="#fff" />
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}