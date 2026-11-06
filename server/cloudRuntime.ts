import { createClient } from "@supabase/supabase-js"
import { cloudHandler, type VerifyUser } from "./cloudHttp.ts"
import { localEnvironment, postgresDatabase } from "./database.ts"
import { ApiError } from "./dispatchService.ts"
import { PostgresDispatch } from "./postgresDispatch.ts"

export function cloudRuntime(root: string) {
  try {
    const env = localEnvironment(root)
    if (!env.VITE_SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_")) throw new Error("Missing publishable key")
    const database = postgresDatabase(env)
    const supabase = createClient(env.VITE_SUPABASE_URL!, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(8000) }) },
    })
    const verify: VerifyUser = async token => {
      // getUser verifies the token with Supabase Auth. Never trust client claims or user metadata for permissions.
      const { data, error } = await supabase.auth.getUser(token)
      if (error || !data.user) {
        if (error && (!error.status || error.status >= 500)) throw new ApiError(503, "AUTH_UNAVAILABLE", "Sign-in verification is unavailable. Please retry shortly.")
        throw new ApiError(401, "SESSION_EXPIRED", "Your session is invalid or expired. Sign in again.")
      }
      if (!data.user.email_confirmed_at || data.user.is_anonymous) throw new ApiError(403, "EMAIL_CONFIRMATION_REQUIRED", "Confirm your email before using this account.")
      return { id: data.user.id, email: data.user.email ?? "" }
    }
    return { handler: cloudHandler(new PostgresDispatch(database.transaction), verify), close: database.close }
  } catch {
    console.warn("Account API configuration is incomplete. Run pnpm run db:check after saving the environment files.")
    return { handler: cloudHandler(null, null), close: async () => {} }
  }
}
