import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY (.env.local / Vercel Environment Variables).'
  );
}

/**
 * Browser Supabase client. Sirf anon key use hoti hai.
 * Data ki security Row Level Security (supabase/migrations/001_init.sql) se aati hai.
 * IMPORTANT: service_role key ko kabhi is project ke client code ya NEXT_PUBLIC_ variable mein mat daalna.
 */
export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
