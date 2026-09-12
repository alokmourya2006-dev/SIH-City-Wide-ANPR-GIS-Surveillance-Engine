import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Surface the crash in the console so it is never a silent black screen
    console.error('[ERROR BOUNDARY] Render crash:', error, info?.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#020617',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '24px',
          fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
        }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#f87171' }}>
            ⚠ UI RENDER ERROR
          </div>
          <pre style={{
            maxWidth: '720px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontSize: '12px',
            color: '#94a3b8',
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '16px',
          }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload() }}
            style={{
              backgroundColor: '#0284c7', color: '#fff', border: 'none',
              padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer',
            }}
          >
            Reload Dashboard
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// Trap any async/module-level error that React cannot catch
window.addEventListener('error', (e) => {
  console.error('[GLOBAL ERROR]', e.error || e.message)
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
