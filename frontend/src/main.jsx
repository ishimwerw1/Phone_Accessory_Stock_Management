import React from 'react'
import ReactDOM from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './index.css'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) return
  if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return
  try {
    let wb
    try {
      const { Workbox } = await import('workbox-window')
      wb = new Workbox(`${import.meta.env.BASE_URL}sw.js`, { scope: `${import.meta.env.BASE_URL}` })
    } catch {
      wb = null
    }
    const registerNow = () => {
      const swPath = `${import.meta.env.BASE_URL}sw.js`
      navigator.serviceWorker.register(swPath, { scope: `${import.meta.env.BASE_URL}` })
        .then((reg) => {
          try {
            if ('serviceWorker' in window && 'periodicSync' in window.ServiceWorkerRegistration) {
              reg.periodicSync?.register?.('refresh-assets', { minInterval: 12 * 60 * 60 * 1000 }).catch(() => {})
            }
          } catch {}
          try {
            if (wb) {
              wb.active = reg.active
              wb.registered = reg
              wb.addEventListener('waiting', () => wb.messageSkipWaiting())
              wb.addEventListener('controlling', () => {})
              wb.addEventListener('message', (event) => {
                if (event.data?.type === 'CACHE_UPDATED') {
                  showUpdatePrompt(() => wb.messageSkipWaiting())
                }
              })
            } else if (reg && reg.waiting) {
              showUpdatePrompt(() => {
                try { reg.waiting.postMessage({ type: 'SKIP_WAITING' }) } catch {}
                location.reload()
              })
            }
            if (reg) {
              reg.addEventListener('updatefound', () => {
                const installing = reg.installing
                installing?.addEventListener('statechange', () => {
                  if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                    showUpdatePrompt(() => {
                      try { installing.postMessage({ type: 'SKIP_WAITING' }) } catch {}
                      location.reload()
                    })
                  }
                })
              })
            }
          } catch {}
        })
        .catch((err) => {
          if (import.meta.env.DEV) console.debug('[PWA] Service worker registration skipped:', err.message)
        })
    }
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(registerNow, 1500)
    } else {
      window.addEventListener('load', () => setTimeout(registerNow, 1500), { once: true })
    }
  } catch (err) {
    if (import.meta.env.DEV) console.debug('[PWA] SW registration failed:', err.message)
  }
}

const showUpdatePrompt = (onApply) => {
  if (typeof window === 'undefined') return
  const existing = document.getElementById('pwa-update-prompt')
  if (existing) return
  const brand = '#0d3b66'
  const accent = '#f18f01'
  const host = document.createElement('div')
  host.id = 'pwa-update-prompt'
  host.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:22px;z-index:2147483000;width:min(92vw,460px);'
  host.innerHTML = `
    <div style="background:#fff;border-radius:16px;box-shadow:0 22px 60px -20px rgba(13,59,102,.35);border:1px solid #eef2f7;padding:16px 18px 16px 16px;display:flex;gap:14px;align-items:center">
      <div style="width:44px;height:44px;flex:0 0 44px;border-radius:12px;background:linear-gradient(135deg, ${brand}, #1a6bb0);display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;font-weight:700">↻</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;color:${brand};font-size:14px;margin:0 0 4px 0;line-height:1.2">New version available</div>
        <div style="color:#475569;font-size:12.5px;line-height:1.5;margin:0">An update for Kakajwi Stock is ready. Restart now to use the latest version.</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;align-items:stretch">
        <button id="pwa-update-apply" style="background:linear-gradient(135deg, ${brand}, #1a6bb0);color:#fff;border:0;padding:9px 14px;border-radius:10px;font-weight:600;font-size:12.5px;cursor:pointer;box-shadow:0 10px 20px -10px rgba(13,59,102,.55);line-height:1.1">Update</button>
        <button id="pwa-update-dismiss" style="background:#f1f5f9;color:#475569;border:0;padding:6px 12px;border-radius:8px;font-size:11.5px;cursor:pointer;line-height:1.1">Later</button>
      </div>
    </div>
  `
  document.body.appendChild(host)
  const applyBtn = document.getElementById('pwa-update-apply')
  const dismissBtn = document.getElementById('pwa-update-dismiss')
  applyBtn?.addEventListener('click', () => {
    try { onApply && onApply() } catch {}
    setTimeout(() => location.reload(), 220)
  })
  dismissBtn?.addEventListener('click', () => host.remove())
  setTimeout(() => host.remove(), 45000)
}

registerServiceWorker()
