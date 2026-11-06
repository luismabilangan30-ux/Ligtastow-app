import MotoristApp from "./motorist/MotoristApp"
import { useEffect, useState } from "react"
import Operations from "./operations/Operations"
import OperatorApp from "./operator/OperatorApp"
import { demoActors, type Actor } from "./shared/dispatch"
import { useDispatch } from "./shared/useDispatch"
import "./operations/operations.css"
import CloudApp from "./auth/CloudApp"

const actorFromHash = () =>
  demoActors.find(
    (actor) => window.location.hash === `#/workspace/${actor.id}`,
  ) ?? demoActors[0]

export default function App() {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).get("demo") === "1" ? <DemoApp /> : <CloudApp />
}

function DemoApp() {
  const [actor, setActor] = useState(actorFromHash)
  useEffect(() => {
    const sync = () => setActor(actorFromHash())
    window.addEventListener("hashchange", sync)
    window.addEventListener("popstate", sync)
    return () => {
      window.removeEventListener("hashchange", sync)
      window.removeEventListener("popstate", sync)
    }
  }, [])
  return <Workspace key={actor.id} actor={actor} />
}

function Workspace({ actor }: { actor: Actor }) {
  const api = useDispatch(actor)
  useEffect(() => { window.scrollTo(0, 0) }, [actor.id])
  return (
    <div className="dispatch-app">
      <nav className="workspace-bar" aria-label="Development workspace">
        <div>
          <strong>LigtasTow</strong>
          <span>Local dispatch demo</span>
          <a href="/" style={{ fontSize: 11 }}>Sign in to an account</a>
        </div>
        <label>
          Workspace
          <select
            value={actor.id}
            disabled={api.pending}
            onChange={(event) => {
              window.location.hash =
                event.target.value === "motorist-demo"
                  ? "/home"
                  : `/workspace/${event.target.value}`
            }}
          >
            {demoActors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.role === "motorist"
                  ? "Motorist"
                  : a.role === "central"
                    ? "Central admin"
                    : `${
                        a.role === "company" ? "Company" : "Operator"
                      } · ${a.name}`}
              </option>
            ))}
          </select>
        </label>
      </nav>
      {api.loading && (
        <div className="api-banner" role="status">
          Connecting to local dispatch…
        </div>
      )}
      {api.error && (
        <div className="api-banner api-error" role="alert">
          <span>{api.error}</span>
          <button onClick={() => void api.refresh()} disabled={api.pending}>
            Refresh / retry
          </button>
        </div>
      )}
      {actor.role === "motorist" ? (
        <MotoristApp api={api} />
      ) : actor.role === "operator" ? (
        <OperatorApp actor={actor} api={api} />
      ) : (
        <Operations actor={actor} api={api} />
      )}
    </div>
  )
}
