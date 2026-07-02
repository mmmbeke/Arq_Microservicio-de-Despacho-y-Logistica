import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let client: SupabaseClient | null = null;

if (supabaseUrl && supabaseServiceRoleKey) {
  client = createClient(supabaseUrl, supabaseServiceRoleKey);
} else {
  console.warn('[supabase] Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el .env');
}

export function getSupabase(): SupabaseClient {
  if (!client) {
    throw new Error('Supabase no está configurado. Revisa SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env');
  }
  return client;
}

export function isSupabaseConfigured(): boolean {
  return client !== null;
}
