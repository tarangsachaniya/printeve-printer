import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Browser Supabase client used ONLY for Realtime (dashboard order events).
 * Uses the public anon key; all privileged data still flows through the API.
 */
let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  if (!client) client = createClient(url, anonKey, { realtime: { params: { eventsPerSecond: 5 } } })
  return client
}
