import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// ── PWA install prompt ─────────────────────────────────────────────
// Capture the browser's beforeinstallprompt event so the app can
// show a custom "Add to Home Screen" button.
let deferredPrompt: BeforeInstallPromptEvent | null = null

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredPrompt = e as BeforeInstallPromptEvent
  window.dispatchEvent(new CustomEvent('ligtastow:installable'))
})

window.addEventListener('appinstalled', () => {
  deferredPrompt = null
  window.dispatchEvent(new CustomEvent('ligtastow:installed'))
})

/** Trigger the native install prompt. Returns true if the user accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false
  await deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  deferredPrompt = null
  return outcome === 'accepted'
}

/** Whether the install prompt is currently available. */
export function canInstall(): boolean {
  return deferredPrompt !== null
}

// ── Service-worker registration with update detection ──────────────
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')

      // Check for updates periodically (every 60 min)
      setInterval(() => void registration.update(), 60 * 60 * 1000)

      // Detect waiting service worker = new version ready
      const onStateChange = () => {
        if (registration.waiting) {
          window.dispatchEvent(new CustomEvent('ligtastow:sw-update'))
        }
      }
      if (registration.waiting) {
        window.dispatchEvent(new CustomEvent('ligtastow:sw-update'))
      }
      registration.addEventListener('updatefound', () => {
        registration.installing?.addEventListener('statechange', onStateChange)
      })
    } catch {
      // SW registration failed — app still works without it
    }
  })
}

/** Tell a waiting service worker to activate immediately. */
export function applySwUpdate() {
  navigator.serviceWorker?.getRegistration().then((reg) => {
    reg?.waiting?.postMessage('skipWaiting')
  })
  // Reload once the new SW takes over
  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    window.location.reload()
  })
}

// ── React mount ────────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
