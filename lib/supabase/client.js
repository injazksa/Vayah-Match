'use client';
import { createClient } from '@supabase/supabase-js';

let _client = null;

export function getSupabaseClient() {
  if (_client) return _client;
  _client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: { eventsPerSecond: 10 },
      },
    }
  );
  return _client;
}
