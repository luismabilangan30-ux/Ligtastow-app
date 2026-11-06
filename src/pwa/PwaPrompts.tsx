import { useEffect, useState } from "react"
import { canInstall, promptInstall, applySwUpdate } from "../main"

/** Hook: returns whether the app is installable right now. */
export function useInstallReady() {
  const [ready, setReady] = useState(canInstall)
  useEffect(() => {
    const on = () => setReady(true)
    const off = () => setReady(false)
    window.addEventListener("ligtastow:installable", on)
    window.addEventListener("ligtastow:installed", off)
    return () => {
      window.removeEventListener("ligtastow:installable", on)
      window.removeEventListener("ligtastow:installed", off)
    }
  }, [])
  return ready
}

/** Hook: returns whether a new service-worker version is waiting. */
export function useSwUpdate() {
  const [waiting, setWaiting] = useState(false)
  useEffect(() => {
    const on = () => setWaiting(true)
    window.addEventListener("ligtastow:sw-update", on)
    return () => window.removeEventListener("ligtastow:sw-update", on)
  }, [])
  return waiting
}

/** "Add to Home Screen" banner. */
export function InstallBanner() {
  const installable = useInstallReady()
  const [dismissed, setDismissed] = useState(false)
  if (!installable || dismissed) return null
  return (
    <div className="pwa-banner" role="complementary" aria-label="Install app">
      <p>📲 <strong>Install LigtasTow</strong> for faster access — works offline too!</p>
      <div className="pwa-banner-actions">
        <button className="pwa-banner-install" onClick={() => void promptInstall()}>
          Install
        </button>
        <button className="pwa-banner-dismiss" onClick={() => setDismissed(true)} aria-label="Dismiss">
          ✕
        </button>
      </div>
    </div>
  )
}

/** "Update available" banner. */
export function UpdateBanner() {
  const waiting = useSwUpdate()
  if (!waiting) return null
  return (
    <div className="pwa-banner pwa-update" role="complementary" aria-label="App update">
      <p>🔄 A new version of LigtasTow is ready.</p>
      <button className="pwa-banner-install" onClick={applySwUpdate}>
        Update now
      </button>
    </div>
  )
}
