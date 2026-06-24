import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn(
    '[supabase] Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el .env'
  );
}

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
