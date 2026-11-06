import { useEffect, useState } from "react"
import type { Route, Screen } from "./model"

const screens: Screen[] = [
  "home",
  "search",
  "history",
  "profile",
  "edit-profile",
  "vehicles",
  "vehicle",
  "booking",
  "searching",
  "tracking",
  "notifications",
  "location",
  "receipt",
  "settings",
]
export function parseRoute(hash: string): Route {
  const [screen, parameter] = hash.replace(/^#\/?/, "").split("/")
  if (!screens.includes(screen as Screen)) return { screen: "home" }
  if (screen === "booking")
    return {
      screen,
      step: Math.min(5, Math.max(1, Number(parameter) || 1)) | 0,
    }
  let id: string | undefined
  try {
    id = parameter ? decodeURIComponent(parameter) : undefined
  } catch {
    return { screen: "home" }
  }
  return { screen: screen as Screen, id }
}
export function useNavigation() {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash))
  useEffect(() => {
    window.history.replaceState(
      {
        ...window.history.state,
        ligtastow: true,
        depth: window.history.state?.depth ?? 0,
      },
      "",
    )
    const onPop = () => setRoute(parseRoute(window.location.hash))
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])
  const navigate = (
    screen: Screen,
    options: Omit<Route, "screen"> = {},
    replace = false,
  ) => {
    const next = { screen, ...options }
    const hash = `#/${screen}${
      screen === "booking"
        ? `/${options.step ?? 1}`
        : options.id
          ? `/${encodeURIComponent(options.id)}`
          : ""
    }`
    if (window.location.hash === hash) return
    const state = {
      ligtastow: true,
      depth: (window.history.state?.depth ?? 0) + (replace ? 0 : 1),
      previousHash: window.location.hash,
    }
    window.history[replace ? "replaceState" : "pushState"](state, "", hash)
    setRoute(next)
  }
  const back = () =>
    window.history.state?.depth > 0
      ? window.history.back()
      : navigate("home", {}, true)
  const bookingStep = (step: number) => {
    const previous = parseRoute(window.history.state?.previousHash ?? "")
    if (
      step === (route.step ?? 1) - 1 &&
      previous.screen === "booking" &&
      previous.step === step
    )
      back()
    else navigate("booking", { step })
  }
  return { route, navigate, back, bookingStep }
}
