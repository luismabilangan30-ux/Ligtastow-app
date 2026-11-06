import { useCallback, useEffect, useRef, useState } from "react"
import { cloudRequest } from "../auth/client"
import type {
  Actor,
  BookingCommand,
  CreateBooking,
  DispatchBooking,
  DispatchSnapshot,
} from "./dispatch"

export function useDispatch(actor: Actor, workspace?: string) {
  const [snapshot, setSnapshot] = useState<DispatchSnapshot>({
    bookings: [],
    operators: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [actionError, setActionError] = useState("")
  const [pending, setPending] = useState(false)
  const locked = useRef(false)
  const sequence = useRef(0)
  const refreshing = useRef<number | null>(null)
  const mounted = useRef(true)
  const request = useCallback(
    async <T>(path: string, body?: unknown): Promise<T> => {
      if (workspace) return cloudRequest<T>(path, body, workspace)
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      try {
        const response = await fetch(`/api/v1/${path}`, {
          method: body === undefined ? "GET" : "POST",
          headers: {
            "X-Demo-Actor": actor.id,
            ...(body === undefined
              ? {}
              : { "Content-Type": "application/json" }),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
          cache: "no-store",
        })
        if (!response.headers.get("content-type")?.includes("application/json"))
          throw new Error(
            "Start the local development server to connect the dispatch API.",
          )
        const data = await response.json()
        if (!response.ok)
          throw new Error(
            data.error?.message ?? "The request could not be saved.",
          )
        return data as T
      } catch (error) {
        if (
          error instanceof TypeError ||
          (error instanceof Error && error.name === "AbortError")
        )
          throw new Error(
            "Dispatch service is unreachable. Check the local server and retry.",
          )
        throw error
      } finally {
        clearTimeout(timeout)
      }
    },
    [actor.id, workspace],
  )
  const refresh = useCallback(async (force = false) => {
    if (refreshing.current !== null && !force) return
    const current = ++sequence.current
    refreshing.current = current
    try {
      const data = await request<DispatchSnapshot>("snapshot")
      if (mounted.current && current === sequence.current) {
        setSnapshot(data)
        setError("")
      }
    } catch (error) {
      if (mounted.current && current === sequence.current)
        setError(
          error instanceof Error ? error.message : "Could not load bookings.",
        )
    } finally {
      if (refreshing.current === current) refreshing.current = null
      if (mounted.current && current === sequence.current) setLoading(false)
    }
  }, [request])
  useEffect(() => {
    mounted.current = true
    void refresh(true)
    const interval = setInterval(() => {
      if (!document.hidden && !locked.current) void refresh()
    }, 3000)
    const focus = () => {
      if (!locked.current) void refresh()
    }
    window.addEventListener("focus", focus)
    return () => {
      mounted.current = false
      sequence.current++
      clearInterval(interval)
      window.removeEventListener("focus", focus)
    }
  }, [refresh])
  const mutate = async (path: string, body: unknown) => {
    if (locked.current) return undefined
    locked.current = true
    sequence.current++
    setPending(true)
    setActionError("")
    try {
      const booking = await request<DispatchBooking>(path, body)
      if (mounted.current) {
        setSnapshot((previous) => ({
          ...previous,
          bookings: [
            booking,
            ...previous.bookings.filter((b) => b.id !== booking.id),
          ],
        }))
        await refresh(true)
      }
      return mounted.current ? booking : undefined
    } catch (error) {
      // Refresh authoritative state after conflicts, but keep the action error
      // visible until the user dismisses it or explicitly retries.
      const message =
        error instanceof Error ? error.message : "Could not save this action."
      if (mounted.current) await refresh(true)
      if (mounted.current) setActionError(message)
      return undefined
    } finally {
      locked.current = false
      if (mounted.current) setPending(false)
    }
  }
  return {
    ...snapshot,
    loading,
    error: actionError || error,
    pending,
    refresh: () => {
      setActionError("")
      return refresh(true)
    },
    create: (input: CreateBooking) => mutate("bookings", input),
    command: (
      booking: DispatchBooking,
      command: Omit<BookingCommand, "expectedVersion">,
    ) =>
      mutate(`bookings/${encodeURIComponent(booking.id)}/commands`, {
        ...command,
        expectedVersion: booking.version,
      }),
  }
}
export type DispatchClient = ReturnType<typeof useDispatch>
