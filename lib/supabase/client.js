'use client';
import { createClient } from '@supabase/supabase-js';

let _client = null;

export function getSupabaseClient() {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // أثناء build/SSR قد تكون فارغة - أرجع null بدلاً من رمي خطأ
  if (!url || !key || !url.startsWith('http')) {
    if (typeof window === 'undefined') return null;
    console.warn('Supabase env vars not configured');
    return null;
  }
  _client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  });
  return _client;
}
