import { useEffect, useRef, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import MotoristApp from "../motorist/MotoristApp"
import Operations from "../operations/Operations"
import OperatorApp from "../operator/OperatorApp"
import type { MotoristProfile } from "../motorist/profileModel"
import type { Vehicle } from "../motorist/model"
import type { AccountClient, AccountSession } from "../shared/account"
import type { Workspace } from "../shared/dispatch"
import { useDispatch } from "../shared/useDispatch"
import AuthForm from "./AuthForm"
import { cloudRequest, supabase } from "./client"
import { InstallBanner, UpdateBanner } from "../pwa/PwaPrompts"
import "../pwa/pwa.css"
import "./auth.css"

export default function CloudApp() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [recovery, setRecovery] = useState(new URLSearchParams(window.location.search).has("recovery"))
  const [notice, setNotice] = useState("")
  const [signingOut, setSigningOut] = useState(false)
  useEffect(() => {
    if (!supabase) { setReady(true); return }
    let mounted = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, current) => {
      if (!mounted) return
      setSession(current)
      if (event === "PASSWORD_RECOVERY") setRecovery(true)
      if (event === "SIGNED_OUT") setRecovery(false)
    })
    void supabase.auth.initialize().then(async ({ error: initializationError }) => {
      const { data, error } = await supabase!.auth.getSession()
      if (!mounted) return
      setSession(data.session); setReady(true)
      if (initializationError || error || new URLSearchParams(window.location.search).has("error")) setNotice("This sign-in link could not be used. Request a new link and open it in the same browser.")
    }).catch(() => {
      if (mounted) { setReady(true); setNotice("Your session could not be opened. Check your connection and sign in again.") }
    })
    const expired = () => { setSession(null); setNotice("Your session expired. Sign in again to continue."); void supabase!.auth.signOut({ scope: "local" }) }
    window.addEventListener("ligtastow:session-expired", expired)
    return () => { mounted = false; subscription.unsubscribe(); window.removeEventListener("ligtastow:session-expired", expired) }
  }, [])
  const signOut = async () => {
    if (!supabase || signingOut) return
    setSigningOut(true)
    const { error } = await supabase.auth.signOut({ scope: "local" })
    if (error) setNotice("Sign-out failed. Check your connection and try again.")
    else { window.history.replaceState(null, "", window.location.pathname); setNotice("") }
    setSigningOut(false)
  }
  if (!supabase) return <Status title="Account setup needed" message="Save the public Supabase connection settings in .env.local and restart the development server." />
  if (!ready) return <Status title="Opening LigtasTow" message="Checking your session…" />
  if (!session) return <AuthForm key="login" notice={notice} />
  if (recovery) return <AuthForm key="recovery" recovery done={() => { setRecovery(false); window.history.replaceState(null, "", `${window.location.pathname}#/home`) }} />
  return <AccountApp key={session.user.id} userId={session.user.id} signOut={() => void signOut()} signingOut={signingOut} notice={notice} />
}

function Status({ title, message, retry, signOut }: { title: string; message: string; retry?: () => void; signOut?: () => void }) {
  return <main className="auth-shell"><section className="auth-card"><h1>{title}</h1><p role="status">{message}</p>
    {retry && <button className="auth-primary" onClick={retry}>Retry connection</button>}
    {signOut && <button className="auth-demo" onClick={signOut}>Sign out</button>}
    {import.meta.env.DEV && <a className="auth-demo" href="/?demo=1#/home">Open local demo</a>}
  </section></main>
}

function AccountApp({ userId, signOut, signingOut, notice }: { userId: string; signOut: () => void; signingOut: boolean; notice: string }) {
  const [session, setSession] = useState<AccountSession | null>(null)
  const [workspace, setWorkspace] = useState("motorist")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const mounted = useRef(true)
  const locked = useRef(false)
  useEffect(() => {
    mounted.current = true
    let stale = false
    void cloudRequest<AccountSession>("session").then(value => {
      if (!stale && value.userId === userId) { setSession(value); setError("") }
    }).catch(error => { if (!stale) setError(error.message) })
    return () => { stale = true; mounted.current = false }
  }, [userId, attempt])
  const mutate = async <T,>(path: string, body: unknown, update: (value: T, previous: AccountSession) => AccountSession) => {
    if (locked.current) return false
    locked.current = true; setPending(true); setError("")
    try {
      const value = await cloudRequest<T>(path, body)
      if (!mounted.current) return false
      setSession(previous => previous && update(value, previous))
      return true
    } catch (error) {
      if (mounted.current) setError(error instanceof Error ? error.message : "Could not save your account details.")
      return false
    } finally { locked.current = false; if (mounted.current) setPending(false) }
  }
  if (!session) return <Status title={error ? "Account connection needs attention" : "Loading your account"} message={error || "Loading your profile, vehicles and workspaces…"} retry={error ? () => setAttempt(value => value + 1) : undefined} signOut={signOut} />
  const account: AccountClient = {
    session, pending, error,
    saveProfile: profile => mutate<MotoristProfile>("profile", profile, (profile, previous) => ({ ...previous, profile })),
    savePreference: enabled => mutate<{ enabled: boolean }>("preferences", { enabled }, (value, previous) => ({ ...previous, bookingUpdates: value.enabled })),
    saveVehicle: vehicle => mutate<Vehicle>("vehicles", vehicle, (value, previous) => ({ ...previous, vehicles: [...previous.vehicles.filter(item => item.id !== value.id), value] })),
    removeVehicle: id => mutate(`vehicles/${encodeURIComponent(id)}/delete`, {}, (_, previous) => ({ ...previous, vehicles: previous.vehicles.filter(item => item.id !== id) })),
  }
  const selected = session.workspaces.find(item => item.key === workspace) ?? session.workspaces[0]
  return <SignedWorkspace key={selected.key} workspace={selected} account={account} select={key => { window.location.hash = "/home"; setWorkspace(key) }} signOut={signOut} signingOut={signingOut} notice={notice} />
}

function SignedWorkspace({ workspace, account, select, signOut, signingOut, notice }: {
  workspace: Workspace; account: AccountClient; select: (key: string) => void; signOut: () => void; signingOut: boolean; notice: string
}) {
  const api = useDispatch(workspace.actor, workspace.key)
  return <div className="dispatch-app">
    <nav className="workspace-bar cloud-workspace" aria-label="Account workspace">
      <div className="workspace-account">
        <strong>LigtasTow</strong>
        <span>Signed in{import.meta.env.DEV ? " · Development" : ""}</span>
        <span className="workspace-email">{account.session.profile.email}</span>
      </div>
      <label>Workspace<select value={workspace.key} disabled={api.pending || account.pending || signingOut} onChange={event => select(event.target.value)}>
        {account.session.workspaces.map(item => <option key={item.key} value={item.key}>{item.actor.role === "motorist" ? "Motorist" : `${item.actor.role === "central" ? "Central admin" : item.actor.role === "operator" ? "Operator" : "Company"} · ${item.actor.name}`}</option>)}
      </select></label>
      <button className="signout-button" onClick={signOut} disabled={api.pending || account.pending || signingOut}>{signingOut ? "Signing out…" : "Sign out"}</button>
    </nav>
    {notice && <p className="api-banner api-error" role="alert">{notice}</p>}
    <InstallBanner />
    <UpdateBanner />
    {api.loading && <div className="api-banner" role="status">Loading your bookings…</div>}
    {api.error && <div className="api-banner api-error" role="alert"><span>{api.error}</span><button onClick={() => void api.refresh()} disabled={api.pending}>Refresh / retry</button></div>}
    {account.error && <div className="api-banner api-error" role="alert">{account.error}</div>}
    {workspace.actor.role === "motorist" ? <MotoristApp api={api} account={account} /> : workspace.actor.role === "operator" ? <OperatorApp actor={workspace.actor} api={api} /> : <Operations actor={workspace.actor} api={api} />}
  </div>
}
