import { createClient } from '@supabase/supabase-js';
import { config } from './config';

// Service-role client — full DB access, never expose to frontend
export const supabaseAdmin = createClient(
  config.supabaseUrl,
  config.supabaseServiceKey,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
