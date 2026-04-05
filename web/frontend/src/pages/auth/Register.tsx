import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Mail, Lock, User, Plus, Trash2 } from 'lucide-react'

interface Medication {
  name: string
  dose: string
  timing: string
}

export default function Register() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [medications, setMedications] = useState<Medication[]>([])
  const [form, setForm] = useState({
    name: '', email: '', password: '',
    height: '', weight: '', age: '',
    gender: '',
    diabetes: false, hypertension: false, heartDisease: false
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

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d0f1a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '480px',
        padding: '40px',
        background: 'linear-gradient(135deg, #1e2540 0%, #131629 100%)',
        borderRadius: '24px',
        border: '1px solid #252d4a',
        boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg, #6c3fd6, #3b6fd4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px auto',
            boxShadow: '0 8px 24px rgba(108, 63, 214, 0.4)',
          }}>
            <Activity size={28} color="white" />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
            Kayıt Ol
          </h1>

          {/* Step indicator */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
            {[1, 2, 3].map(s => (
              <div key={s} style={{
                width: s === step ? '32px' : '8px',
                height: '8px', borderRadius: '4px',
                background: s <= step
                  ? 'linear-gradient(135deg, #6c3fd6, #3b6fd4)'
                  : '#252d4a',
                transition: 'all 0.3s'
              }} />
            ))}
          </div>
          <p style={{ fontSize: '12px', color: '#475569', marginTop: '8px', fontWeight: 600 }}>
            {step === 1 ? 'Hesap Bilgileri' : step === 2 ? 'Sağlık Bilgileri' : 'İlaç Bilgileri'}
          </p>
        </div>

        {/* Step 1 - Hesap Bilgileri */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Ad Soyad</label>
              <div style={{ position: 'relative' }}>
                <User size={16} color="#475569" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text" placeholder="Ad Soyad"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  style={{ ...inputStyle, paddingLeft: '42px' }}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>E-posta</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="#475569" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="email" placeholder="ornek@mail.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  style={{ ...inputStyle, paddingLeft: '42px' }}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Şifre</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="#475569" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="password" placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  style={{ ...inputStyle, paddingLeft: '42px' }}
                />
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              style={{
                width: '100%', padding: '14px',
                background: 'linear-gradient(135deg, #6c3fd6, #3b6fd4)',
                border: 'none', borderRadius: '12px',
                color: '#fff', fontSize: '15px', fontWeight: 800,
                cursor: 'pointer', marginTop: '8px',
                boxShadow: '0 8px 24px rgba(108, 63, 214, 0.4)',
              }}
            >
              Devam Et →
            </button>
          </div>
        )}

        {/* Step 2 - Sağlık Bilgileri */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Boy Kilo Yaş */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Boy (cm)</label>
                <input
                  type="number" placeholder="170"
                  value={form.height}
                  onChange={e => setForm({ ...form, height: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Kilo (kg)</label>
                <input
                  type="number" placeholder="70"
                  value={form.weight}
                  onChange={e => setForm({ ...form, weight: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Yaş</label>
                <input
                  type="number" placeholder="25"
                  value={form.age}
                  onChange={e => setForm({ ...form, age: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Cinsiyet */}
            <div>
              <label style={labelStyle}>Cinsiyet</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                      borderRadius: '12px',
                      color: '#fff', fontSize: '14px', fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {g === 'Kadın' ? '👩 Kadın' : '👨 Erkek'}
                  </button>
                ))}
              </div>
            </div>

            {/* Hastalıklar */}
            <div>
              <label style={labelStyle}>Sağlık Durumu</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { key: 'diabetes', label: '🩸 Diyabet' },
                  { key: 'hypertension', label: '❤️ Hipertansiyon' },
                  { key: 'heartDisease', label: '🫀 Kalp Hastalığı' },
                ].map(item => (
                  <div
                    key={item.key}
                    onClick={() => setForm({ ...form, [item.key]: !form[item.key as keyof typeof form] })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 16px', borderRadius: '12px', cursor: 'pointer',
                      background: form[item.key as keyof typeof form]
                        ? 'rgba(108, 63, 214, 0.2)'
                        : 'rgba(255,255,255,0.03)',
                      border: '1px solid',
                      borderColor: form[item.key as keyof typeof form] ? '#6c3fd6' : '#252d4a',
                    }}
                  >
                    <div style={{
                      width: '20px', height: '20px', borderRadius: '6px',
                      background: form[item.key as keyof typeof form]
                        ? 'linear-gradient(135deg, #6c3fd6, #3b6fd4)'
                        : 'transparent',
                      border: '2px solid',
                      borderColor: form[item.key as keyof typeof form] ? 'transparent' : '#475569',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {form[item.key as keyof typeof form] && (
                        <span style={{ color: '#fff', fontSize: '12px' }}>✓</span>
                      )}
                    </div>
                    <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '14px' }}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  padding: '14px', background: 'transparent',
                  border: '1px solid #252d4a', borderRadius: '12px',
                  color: '#94a3b8', fontSize: '15px', fontWeight: 800, cursor: 'pointer',
                }}
              >
                ← Geri
              </button>
              <button
                onClick={() => setStep(3)}
                style={{
                  padding: '14px',
                  background: 'linear-gradient(135deg, #6c3fd6, #3b6fd4)',
                  border: 'none', borderRadius: '12px',
                  color: '#fff', fontSize: '15px', fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(108, 63, 214, 0.4)',
                }}
              >
                Devam Et →
              </button>
            </div>
          </div>
        )}

        {/* Step 3 - İlaç Bilgileri */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* İlaç Listesi */}
            {medications.map((med, index) => (
              <div key={index} style={{
                padding: '16px', borderRadius: '12px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid #252d4a',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 700 }}>
                    İlaç {index + 1}
                  </span>
                  <Trash2
                    size={16} color="#ff4560"
                    style={{ cursor: 'pointer' }}
                    onClick={() => removeMedication(index)}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    placeholder="İlaç adı (örn: Metoprolol)"
                    value={med.name}
                    onChange={e => updateMedication(index, 'name', e.target.value)}
                    style={inputStyle}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <input
                      placeholder="Doz (örn: 50mg)"
                      value={med.dose}
                      onChange={e => updateMedication(index, 'dose', e.target.value)}
                      style={inputStyle}
                    />
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

            {/* İlaç Ekle Butonu */}
            <button
              onClick={addMedication}
              style={{
                padding: '12px', background: 'transparent',
                border: '2px dashed #252d4a', borderRadius: '12px',
                color: '#6c3fd6', fontSize: '14px', fontWeight: 800,
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              <Plus size={18} /> İlaç Ekle
            </button>

            {medications.length === 0 && (
              <p style={{ textAlign: 'center', color: '#475569', fontSize: '13px', fontWeight: 600 }}>
                💊 Kullandığınız ilaç yoksa devam edebilirsiniz
              </p>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                onClick={() => setStep(2)}
                style={{
                  padding: '14px', background: 'transparent',
                  border: '1px solid #252d4a', borderRadius: '12px',
                  color: '#94a3b8', fontSize: '15px', fontWeight: 800, cursor: 'pointer',
                }}
              >
                ← Geri
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  padding: '14px',
                  background: 'linear-gradient(135deg, #6c3fd6, #3b6fd4)',
                  border: 'none', borderRadius: '12px',
                  color: '#fff', fontSize: '15px', fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(108, 63, 214, 0.4)',
                }}
              >
                Kayıt Ol ✓
              </button>
            </div>
          </div>
        )}

        {/* Login linki */}
        <p style={{ textAlign: 'center', fontSize: '14px', color: '#94a3b8', fontWeight: 600, marginTop: '24px' }}>
          Zaten hesabınız var mı?{' '}
          <span
            onClick={() => navigate('/login')}
            style={{ color: '#6c3fd6', cursor: 'pointer', fontWeight: 800 }}
          >
            Giriş Yap
          </span>
        </p>
      </div>
    </div>
  )
}
