import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

export const supabase: SupabaseClient = createClient(
  environment.supabase.url,
  environment.supabase.anonKey,
  {
    auth: {
      persistSession: true,
      storageKey: 'repify-auth',
      storage: localStorage,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
