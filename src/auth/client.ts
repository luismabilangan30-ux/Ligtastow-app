import { createClient } from "@supabase/supabase-js"

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const supabase = typeof url === "string" && /^https:\/\/[a-z]{20}\.supabase\.co\/?$/.test(url) &&
  typeof key === "string" && key.startsWith("sb_publishable_") ? createClient(url, key, {
    auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
  }) : null

export async function cloudRequest<T>(path: string, body?: unknown, workspace = "motorist"): Promise<T> {
  if (!supabase) throw new Error("Supabase is not configured.")
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session) {
    window.dispatchEvent(new Event("ligtastow:session-expired"))
    throw new Error("Sign in again to continue.")
  }
  try {
    const response = await fetch(`/api/v2/${path}`, {
      method: body === undefined ? "GET" : "POST", cache: "no-store",
      headers: { Authorization: `Bearer ${session.access_token}`, "X-Workspace": workspace,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
    })
    if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("The account API is unavailable. Start the development server and retry.")
    const result = await response.json()
    if (response.status === 401) window.dispatchEvent(new Event("ligtastow:session-expired"))
    if (!response.ok) throw new Error(result.error?.message ?? "This action could not be saved.")
    return result as T
  } catch (error) {
    if (error instanceof TypeError || (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name))) {
      throw new Error("Account service is unreachable. Check your connection and retry.")
    }
    throw error
  }
}
