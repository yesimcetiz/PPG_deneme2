import { useState } from 'react'
import { User, Heart, Pill, Save, Plus, Trash2 } from 'lucide-react'

interface Medication {
  name: string
  dose: string
  timing: string
}

export default function Profile() {
  const [activeTab, setActiveTab] = useState('personal')
  const [medications, setMedications] = useState<Medication[]>([
    { name: 'Metoprolol', dose: '50mg', timing: 'sabah' }
  ])
  const [form, setForm] = useState({
    name: 'Yeşim Çetiz',
    email: 'yesim@mail.com',
    height: '165',
    weight: '60',
    age: '25',
    gender: 'Kadın',
    diabetes: false,
    hypertension: true,
    heartDisease: false,
  })

  const addMedication = () => {
    setMedications([...medications, { name: '', dose: '', timing: 'sabah' }])
  }

  const removeMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index))
  }

  const updateMedication = (index: number, field: string, value: string) => {
    const updated = [...medications]
    updated[index] = { ...updated[index], [field]: value }
    setMedications(updated)
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid #252d4a',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    outline: 'none',
    boxSizing: 'border-box' as const,
  }

  const labelStyle = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 700,
    color: '#94a3b8',
    marginBottom: '8px'
  }

  const tabs = [
    { key: 'personal', label: 'Kişisel Bilgiler', icon: User },
    { key: 'health',   label: 'Sağlık Durumu',   icon: Heart },
    { key: 'meds',     label: 'İlaçlarım',        icon: Pill },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
          Profilim 👤
        </h1>
        <p style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 600 }}>
          Kişisel ve sağlık bilgilerinizi yönetin
        </p>
      </div>

      {/* Profil Kartı */}
      <div style={{
        padding: '24px',
        background: 'linear-gradient(135deg, #1e2540, #131629)',
        borderRadius: '20px', border: '1px solid #252d4a',
        display: 'flex', alignItems: 'center', gap: '24px'
      }}>
        <div style={{
          width: '80px', height: '80px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #c850c0, #6c3fd6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '32px', fontWeight: 900, color: '#fff',
          boxShadow: '0 8px 24px rgba(108, 63, 214, 0.4)',
        }}>Y</div>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
            {form.name}
          </h2>
          <p style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 600, marginBottom: '8px' }}>
            {form.email}
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{
              fontSize: '12px', fontWeight: 700, padding: '4px 12px',
              borderRadius: '20px', background: 'rgba(0, 227, 150, 0.1)',
              color: '#00e396', border: '1px solid rgba(0, 227, 150, 0.3)'
            }}>
              🟢 Sensör Bağlı
            </span>
            <span style={{
              fontSize: '12px', fontWeight: 700, padding: '4px 12px',
              borderRadius: '20px', background: 'rgba(108, 63, 214, 0.1)',
              color: '#6c3fd6', border: '1px solid rgba(108, 63, 214, 0.3)'
            }}>
              {form.height}cm / {form.weight}kg
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 20px', borderRadius: '12px', cursor: 'pointer',
              background: activeTab === tab.key
                ? 'linear-gradient(135deg, #6c3fd6, #3b6fd4)'
                : 'rgba(255,255,255,0.05)',
              border: activeTab === tab.key ? 'none' : '1px solid #252d4a',
              color: activeTab === tab.key ? '#fff' : '#94a3b8',
              fontSize: '14px', fontWeight: 700,
              boxShadow: activeTab === tab.key
                ? '0 4px 16px rgba(108, 63, 214, 0.4)' : 'none',
            }}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab İçerikleri */}
      <div style={{
        padding: '32px',
        background: 'linear-gradient(135deg, #1e2540, #131629)',
        borderRadius: '20px', border: '1px solid #252d4a',
      }}>

        {/* Kişisel Bilgiler */}
        {activeTab === 'personal' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff' }}>
              Kişisel Bilgiler
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Ad Soyad</label>
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>E-posta</label>
                <input
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Boy (cm)</label>
                <input
                  type="number" value={form.height}
                  onChange={e => setForm({ ...form, height: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Kilo (kg)</label>
                <input
                  type="number" value={form.weight}
                  onChange={e => setForm({ ...form, weight: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Yaş</label>
                <input
                  type="number" value={form.age}
                  onChange={e => setForm({ ...form, age: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Cinsiyet</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {['Kadın', 'Erkek'].map(g => (
                    <button
                      key={g}
                      onClick={() => setForm({ ...form, gender: g })}
                      style={{
                        padding: '12px',
                        background: form.gender === g
                          ? 'linear-gradient(135deg, #6c3fd6, #3b6fd4)'
                          : 'rgba(255,255,255,0.05)',
                        border: '1px solid',
                        borderColor: form.gender === g ? 'transparent' : '#252d4a',
                        borderRadius: '12px', color: '#fff',
                        fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      {g === 'Kadın' ? '👩 Kadın' : '👨 Erkek'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sağlık Durumu */}
        {activeTab === 'health' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff' }}>
              Sağlık Durumu
            </h3>

            {[
              { key: 'diabetes',     label: '🩸 Diyabet',          desc: 'Tip 1 veya Tip 2 Diyabet' },
              { key: 'hypertension', label: '❤️ Hipertansiyon',    desc: 'Yüksek tansiyon' },
              { key: 'heartDisease', label: '🫀 Kalp Hastalığı',   desc: 'Kardiyovasküler hastalık' },
            ].map(item => (
              <div
                key={item.key}
                onClick={() => setForm({ ...form, [item.key]: !form[item.key as keyof typeof form] })}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '20px', borderRadius: '16px', cursor: 'pointer',
                  background: form[item.key as keyof typeof form]
                    ? 'rgba(108, 63, 214, 0.15)'
                    : 'rgba(255,255,255,0.03)',
                  border: '1px solid',
                  borderColor: form[item.key as keyof typeof form] ? '#6c3fd6' : '#252d4a',
                  transition: 'all 0.2s',
                }}
              >
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>
                    {item.desc}
                  </div>
                </div>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '8px',
                  background: form[item.key as keyof typeof form]
                    ? 'linear-gradient(135deg, #6c3fd6, #3b6fd4)'
                    : 'transparent',
                  border: '2px solid',
                  borderColor: form[item.key as keyof typeof form] ? 'transparent' : '#475569',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {form[item.key as keyof typeof form] && (
                    <span style={{ color: '#fff', fontSize: '14px' }}>✓</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* İlaçlar */}
        {activeTab === 'meds' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff' }}>
              İlaçlarım
            </h3>

            {medications.map((med, index) => (
              <div key={index} style={{
                padding: '20px', borderRadius: '16px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid #252d4a',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 700 }}>
                    💊 İlaç {index + 1}
                  </span>
                  <Trash2
                    size={16} color="#ff4560" style={{ cursor: 'pointer' }}
                    onClick={() => removeMedication(index)}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>İlaç Adı</label>
                    <input
                      placeholder="örn: Metoprolol"
                      value={med.name}
                      onChange={e => updateMedication(index, 'name', e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Doz</label>
                    <input
                      placeholder="örn: 50mg"
                      value={med.dose}
                      onChange={e => updateMedication(index, 'dose', e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Kullanım</label>
                    <select
                      value={med.timing}
                      onChange={e => updateMedication(index, 'timing', e.target.value)}
                      style={{ ...inputStyle, cursor: 'pointer' }}
                    >
                      <option value="sabah">☀️ Sabah</option>
                      <option value="ogle">🌤️ Öğle</option>
                      <option value="aksam">🌙 Akşam</option>
                      <option value="gece">🌑 Gece</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={addMedication}
              style={{
                padding: '14px', background: 'transparent',
                border: '2px dashed #252d4a', borderRadius: '12px',
                color: '#6c3fd6', fontSize: '14px', fontWeight: 800,
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              <Plus size={18} /> Yeni İlaç Ekle
            </button>
          </div>
        )}

        {/* Kaydet Butonu */}
        <button
          style={{
            marginTop: '24px', padding: '14px 32px',
            background: 'linear-gradient(135deg, #6c3fd6, #3b6fd4)',
            border: 'none', borderRadius: '12px',
            color: '#fff', fontSize: '15px', fontWeight: 800,
            cursor: 'pointer', display: 'flex',
            alignItems: 'center', gap: '8px',
            boxShadow: '0 8px 24px rgba(108, 63, 214, 0.4)',
          }}
        >
          <Save size={18} /> Değişiklikleri Kaydet
        </button>
      </div>
    </div>
  )
}
