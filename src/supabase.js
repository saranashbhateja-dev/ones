import { createClient } from '@supabase/supabase-js';

// Public client configuration only. Never place a Supabase service-role/secret key here.
export const SUPABASE_URL = 'https://bztsnkejidzjjlaghtly.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Cef2U5pCDcDJp9DUpe36KA_8DrAetWc';
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
export const STATE_TABLE = 'jee_one_shot_os_state';
