import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Activity } from 'lucide-react';

const exampleSuggestions = [
  'Daha fazla su içmeyi unutmayın.',
  'Kısa bir yürüyüş yapabilirsiniz.',
  'Nefes egzersizleri stresi azaltabilir.',
  'Biraz müzik dinleyin ve rahatlayın.',
];

const Chat: React.FC = () => {
  const [messages, setMessages] = useState([
    { sender: 'bot', text: 'Merhaba! Ben sağlık asistanınızım. Anlık stres verilerinizi inceleyebilir veya günlük ilaç programınızı kontrol edebilirim. Bugün size nasıl yardımcı olabilirim?' },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Otomatik kaydırma için referans
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = () => {
    if (!input.trim()) return;
    
    const userText = input;
    setMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setInput('');
    setIsLoading(true);

    // Kullanıcının sorusuna göre cevap belirleme
    setTimeout(() => {
      let botResponse = '';
      const lowerInput = userText.toLowerCase();

      // Eğer sorunun içinde "ilaç" kelimesi geçiyorsa özel cevap ver
      if (lowerInput.includes('ilaç') || lowerInput.includes('hap')) {
        botResponse = "💊 **Bugünkü İlaç Programınız:**\n\n• **Sabah (08:00):** Metoprolol (Tansiyon İlacı)\n• **Akşam (20:00):** Magnezyum Takviyesi\n\nLütfen ilaçlarınızı vaktinde almayı unutmayın. Sabah dozunuzu aldınız mı, sisteme kaydedeyim mi?";
      } 
      // İlaç sorulmadıysa klasik stres analizi cevabı ver
      else {
        botResponse = `🧠 **Stres Analizi:** Şu anki verilerinize göre orta düzey stres tespit ettim.\n\n💡 **Öneri:** ${exampleSuggestions[Math.floor(Math.random() * exampleSuggestions.length)]}`;
      }

      setMessages(msgs => [
        ...msgs,
        { sender: 'bot', text: botResponse },
      ]);
      setIsLoading(false);
    }, 1200); 
  };

  return (
    <div style={{ 
      maxWidth: 600, 
      margin: '40px auto', 
      background: 'linear-gradient(135deg, #1e2540, #131629)', 
      borderRadius: '24px', 
      border: '1px solid #252d4a',
      boxShadow: '0 20px 40px rgba(0,0,0,0.5)', 
      color: '#fff', 
      display: 'flex',
      flexDirection: 'column',
      height: '650px',
      overflow: 'hidden'
    }}>
      
      {/* Header Alanı (Model seçimi kaldırıldı) */}
      <div style={{ 
        padding: '20px', 
        borderBottom: '1px solid #252d4a',
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        background: 'rgba(255,255,255,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#6c3fd620', padding: '8px', borderRadius: '12px' }}>
            <Activity size={24} color="#6c3fd6" />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Sağlık Asistanı</h2>
            <span style={{ fontSize: '12px', color: '#00e396', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: 8, height: 8, background: '#00e396', borderRadius: '50%', display: 'inline-block' }}></span>
              Çevrimiçi
            </span>
          </div>
        </div>
      </div>

      {/* Mesajlaşma Alanı */}
      <div style={{ 
        flex: 1, 
        padding: '24px', 
        overflowY: 'auto', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '16px' 
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ 
            display: 'flex', 
            justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' 
          }}>
            {msg.sender === 'bot' && (
              <div style={{ marginRight: '12px', marginTop: '4px' }}>
                <Bot size={28} color="#94a3b8" />
              </div>
            )}
            
            <div style={{ 
              maxWidth: '75%', 
              padding: '14px 18px', 
              background: msg.sender === 'user' ? 'linear-gradient(135deg, #6c3fd6, #3b6fd4)' : 'rgba(255,255,255,0.05)', 
              border: msg.sender === 'user' ? 'none' : '1px solid #252d4a',
              color: '#fff', 
              fontSize: '14px', 
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap', 
              borderRadius: '18px',
              borderBottomRightRadius: msg.sender === 'user' ? '4px' : '18px',
              borderBottomLeftRadius: msg.sender === 'bot' ? '4px' : '18px',
              boxShadow: msg.sender === 'user' ? '0 4px 12px rgba(108, 63, 214, 0.3)' : 'none'
            }}>
              {msg.text}
            </div>
          </div>
        ))}

        {/* Yazıyor Animasyonu */}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ marginRight: '12px', marginTop: '4px' }}>
              <Bot size={28} color="#94a3b8" />
            </div>
            <div style={{ 
              background: 'rgba(255,255,255,0.05)', border: '1px solid #252d4a', 
              padding: '14px 18px', borderRadius: '18px', borderBottomLeftRadius: '4px',
              color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' 
            }}>
              Yanıt yazıyor...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Mesaj Gönderme Alanı */}
      <div style={{ 
        padding: '20px', 
        borderTop: '1px solid #252d4a', 
        background: 'rgba(0,0,0,0.2)' 
      }}>
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid #252d4a', 
          borderRadius: '16px', 
          padding: '8px' 
        }}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
            placeholder="Gününüzü anlatın veya ilaçlarınızı sorun..."
            style={{ 
              flex: 1, background: 'transparent', border: 'none', 
              outline: 'none', color: '#fff', fontSize: '14px', 
              padding: '8px 12px' 
            }}
          />
          <button 
            onClick={handleSend} 
            style={{ 
              background: 'linear-gradient(135deg, #6c3fd6, #3b6fd4)', 
              color: '#fff', border: 'none', borderRadius: '12px', 
              padding: '0 20px', display: 'flex', alignItems: 'center', 
              justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(108, 63, 214, 0.4)'
            }}
          >
            <Send size={18} />
          </button>
        </div>
      </div>

    </div>
  );
};

export default Chat;