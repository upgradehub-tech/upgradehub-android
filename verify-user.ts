import { createClient } from '@supabase/supabase-js';

/**
 * API route ke liye: "Authorization: Bearer <access_token>" ko Supabase Auth server se verify karta hai.
 * getUser(jwt) Supabase se confirm karta hai, sirf token decode nahi karta, isliye fake/expired token fail hota hai.
 * Valid user ho to user id lautata hai, warna null.
 */
export async function getVerifiedUserId(req: Request): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('SUPABASE_CONFIG_MISSING');

  const match = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') ?? '');
  if (!match) return null;

  const sb = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await sb.auth.getUser(match[1].trim());
  if (error || !data.user) return null;
  return data.user.id;
}
