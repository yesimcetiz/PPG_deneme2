import Sidebar from './Sidebar'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d0f1a' }}>
      <Sidebar />
      <main style={{
        marginLeft: '260px',
        flex: 1,
        padding: '32px',
        minHeight: '100vh'
      }}>
        {children}
      </main>
    </div>
  )
}
