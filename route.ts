import { NextRequest, NextResponse } from 'next/server';
import { isErrorResponse, requireUser } from '@/lib/auth/server';
import { jsonError, readJson } from '@/lib/http';
import { parseDeviceInput } from '@/lib/admin/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Android/iOS/web app login ke baad FCM token yahan register karta hai.
export async function POST(req: NextRequest) {
  const ctx = await requireUser(req);
  if (isErrorResponse(ctx)) return ctx;
  const body = await readJson(req, 8_000);
  if (!body.ok) return body.response;
  const parsed = parseDeviceInput(body.value);
  if (!parsed.ok) return jsonError(parsed.error, 'BAD_REQUEST', 400);

  const { error } = await ctx.db.rpc('register_device_token', {
    p_token: parsed.value.token,
    p_platform: parsed.value.platform,
    p_app_version: parsed.value.appVersion ?? null,
  });
  if (error) {
    console.error('[devices/register]', error.message);
    return jsonError('Could not register device.', 'SERVER_ERROR', 500);
  }
  return NextResponse.json({ ok: true });
}

// Logout par token hata do (RLS: sirf apna token delete ho sakta hai).
export async function DELETE(req: NextRequest) {
  const ctx = await requireUser(req);
  if (isErrorResponse(ctx)) return ctx;
  const body = await readJson(req, 8_000);
  if (!body.ok) return body.response;
  const parsed = parseDeviceInput(body.value);
  if (!parsed.ok) return jsonError(parsed.error, 'BAD_REQUEST', 400);

  const { error } = await ctx.db.from('device_tokens').delete().eq('fcm_token', parsed.value.token);
  if (error) {
    console.error('[devices/unregister]', error.message);
    return jsonError('Could not unregister device.', 'SERVER_ERROR', 500);
  }
  return NextResponse.json({ ok: true });
}
