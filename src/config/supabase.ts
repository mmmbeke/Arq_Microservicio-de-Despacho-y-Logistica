import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';

function readEnv(name: string): string {
  return (process.env[name] ?? '').trim();
}

const supabaseUrl = readEnv('SUPABASE_URL');
const supabaseServiceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');

let client: SupabaseClient | null = null;

export function hasSupabaseEnv(): boolean {
  return Boolean(supabaseUrl && supabaseServiceRoleKey);
}

function buildClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: {
      // Node.js 20 (Docker/Render) no trae WebSocket nativo
      transport: ws as unknown as typeof WebSocket,
    },
  });
}

export function getSupabase(): SupabaseClient {
  if (!hasSupabaseEnv()) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  }
  if (!client) {
    client = buildClient();
  }
  return client;
}

export function isSupabaseConfigured(): boolean {
  return client !== null;
}
