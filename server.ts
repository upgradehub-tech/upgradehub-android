import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/http';

export interface AuthContext {
  userId: string;
  /** User ke apne JWT se bana client: har query par RLS lagu hoti hai (service_role nahi). */
  db: SupabaseClient;
}

export function isErrorResponse(x: unknown): x is NextResponse {
  return x instanceof NextResponse;
}

export async function requireUser(req: Request): Promise<AuthContext | NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    console.error('[auth] Supabase env missing');
    return jsonError('Server is not configured.', 'SERVER_ERROR', 500);
  }

  const match = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') ?? '');
  if (!match) return jsonError('Please sign in.', 'UNAUTHORIZED', 401);
  const token = match[1].trim();

  const db = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return jsonError('Please sign in.', 'UNAUTHORIZED', 401);
  return { userId: data.user.id, db };
}

/**
 * Admin-only gate. Role DB (user_roles) se aata hai, client ke claim se nahi.
 * Doosri layer: har table par RLS bhi is_admin() maangti hai.
 */
export async function requireAdmin(req: Request): Promise<AuthContext | NextResponse> {
  const ctx = await requireUser(req);
  if (isErrorResponse(ctx)) return ctx;

  const { data, error } = await ctx.db.rpc('is_admin');
  if (error) {
    console.error('[auth] is_admin failed:', error.message);
    return jsonError('Could not verify permissions.', 'SERVER_ERROR', 500);
  }
  if (data !== true) return jsonError('Admin access required.', 'FORBIDDEN', 403);
  return ctx;
}

export async function writeAudit(
  ctx: AuthContext,
  action: string,
  entity: string,
  entityId: string | null,
  meta: Record<string, unknown> = {}
) {
  const { error } = await ctx.db
    .from('admin_audit_log')
    .insert({ actor_id: ctx.userId, action, entity, entity_id: entityId, meta });
  if (error) console.error('[audit] insert failed:', error.message);
}
