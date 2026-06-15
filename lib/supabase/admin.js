import { createClient } from '@supabase/supabase-js';

let _admin = null;

export function getSupabaseAdmin() {
  if (_admin) return _admin;
  // Polyfill WebSocket for Node 20 (Supabase Realtime requirement)
  if (typeof globalThis.WebSocket === 'undefined') {
    try {
      const ws = require('ws');
      globalThis.WebSocket = ws.WebSocket || ws;
    } catch (e) {}
  }
  _admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 1 } },
    }
  );
  return _admin;
}
