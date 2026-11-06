import { useRef, useState, type FormEvent } from "react"
import { supabase } from "./client"

type Mode = "login" | "signup" | "forgot" | "reset"
export default function AuthForm({ recovery = false, done, notice = "" }: { recovery?: boolean; done?: () => void; notice?: string }) {
  const [mode, setMode] = useState<Mode>(recovery ? "reset" : "login")
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState(notice)
  const [pending, setPending] = useState(false)
  const locked = useRef(false)
  const newPassword = mode === "signup" || mode === "reset"
  const switchMode = (next: Mode) => { setMode(next); setError(""); setMessage(""); setPassword(""); setConfirmation("") }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (locked.current || !supabase) return
    if (newPassword && password !== confirmation) { setError("The passwords do not match."); return }
    if (mode === "signup" && name.trim().length < 2) { setError("Enter a name with at least two characters."); return }
    locked.current = true
    setPending(true); setError(""); setMessage("")
    const redirect = `${window.location.origin}${window.location.pathname}`
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password,
          options: { data: { display_name: name.trim() }, emailRedirectTo: redirect } })
        if (error) throw error
        if (!data.session) setMessage("Check your email to confirm your account. Open the link in this browser, then sign in. If you already have an account, use Sign in or Reset password.")
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${redirect}?recovery=1` })
        if (error) throw error
        setMessage("If this email can receive recovery messages, a reset link is on its way. Open it in this browser.")
      } else {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        done?.()
      }
      setPassword(""); setConfirmation("")
    } catch (error) {
      const code = (error as { code?: string }).code
      setError(code === "email_not_confirmed" ? "Confirm your email before signing in." :
        code === "over_email_send_rate_limit" || code === "over_request_rate_limit" ? "Too many attempts. Wait before trying again." :
        mode === "login" ? "Unable to sign in. Check your email and password, confirm your email, and try again." :
        error instanceof Error ? error.message : "This request could not be completed. Try again.")
    } finally { locked.current = false; setPending(false) }
  }
  const title = mode === "login" ? "Welcome back" : mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Choose a new password"
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <a className="auth-brand" href="/">Ligtas<span>Tow</span></a>
        <p className="auth-eyebrow">ROADSIDE ASSISTANCE{import.meta.env.DEV ? " · DEVELOPMENT" : ""}</p>
        <h1 id="auth-title">{title}</h1>
        <p className="auth-copy">{mode === "login" ? "Sign in to save your vehicles and follow your assistance requests." : mode === "signup" ? "Start with a motorist account. Your team assigns access to company and operator workspaces." : "Keep your account and saved vehicle details accessible."}</p>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {message && <p className="auth-message" role="status">{message}</p>}
        <form onSubmit={event => void submit(event)}>
          <fieldset disabled={pending}>
            {mode === "signup" && <label>Full name<input required minLength={2} maxLength={80} autoComplete="name" value={name} onChange={event => setName(event.target.value)} /></label>}
            {mode !== "reset" && <label>Email address<input required type="email" maxLength={254} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} /></label>}
            {mode !== "forgot" && <label>Password<input required type="password" minLength={newPassword ? 12 : 1} maxLength={128} autoComplete={newPassword ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} />{newPassword && <small>Use at least 12 characters.</small>}</label>}
            {newPassword && <label>Confirm password<input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>}
            <button className="auth-primary" type="submit">{pending ? "Please wait…" : mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Save password"}</button>
          </fieldset>
        </form>
        <div className="auth-links">
          {mode === "login" ? <><button disabled={pending} onClick={() => switchMode("forgot")}>Forgot password?</button><button disabled={pending} onClick={() => switchMode("signup")}>Create an account</button></> : mode !== "reset" && <button disabled={pending} onClick={() => switchMode("login")}>Back to sign in</button>}
        </div>
        {import.meta.env.DEV && <p className="auth-footnote">Development testing only. No roadside service or payment is dispatched.</p>}
        {import.meta.env.DEV && <a className="auth-demo" href="/?demo=1#/home">Explore the local demo</a>}
      </section>
    </main>
  )
}
