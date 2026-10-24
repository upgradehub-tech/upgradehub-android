// SERVER ONLY. Isse kabhi client component se import mat karna.
import { createClient } from '@supabase/supabase-js';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, Message } from 'firebase-admin/messaging';
import { uniqueByUserAndKey } from './dedupe';

interface QueuedRow { id: string; user_id: string; dedupe_key: string; kind: string; title: string; body: string }

export interface DispatchResult {
  skipped?: string;
  claimed: number;
  sent: number;
  failed: number;
  prunedTokens: number;
}

const STALE_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

export async function dispatchQueuedNotifications(limit = 200): Promise<DispatchResult> {
  const empty: DispatchResult = { claimed: 0, sent: 0, failed: 0, prunedTokens: 0 };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!url || !serviceKey || !saJson) return { ...empty, skipped: 'SUPABASE_SERVICE_ROLE_KEY / FIREBASE_SERVICE_ACCOUNT_JSON not set' };

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: queued, error: qErr } = await admin
    .from('notification_log')
    .select('id')
    .eq('status', 'queued')
    .order('created_at')
    .limit(limit);
  if (qErr) throw new Error(`queue read failed: ${qErr.message}`);
  if (!queued || queued.length === 0) return empty;

  // Compare-and-set claim: do dispatchers ek hi row ko nahi utha sakte.
  const { data: claimedRaw, error: cErr } = await admin
    .from('notification_log')
    .update({ status: 'sending' })
    .in('id', queued.map((r) => r.id))
    .eq('status', 'queued')
    .select('id,user_id,dedupe_key,kind,title,body');
  if (cErr) throw new Error(`claim failed: ${cErr.message}`);
  const claimed = uniqueByUserAndKey((claimedRaw ?? []) as QueuedRow[]);
  if (claimed.length === 0) return empty;

  const userIds = [...new Set(claimed.map((r) => r.user_id))];
  const { data: tokenRows, error: tErr } = await admin.from('device_tokens').select('user_id,fcm_token').in('user_id', userIds);
  if (tErr) throw new Error(`token read failed: ${tErr.message}`);

  const tokensByUser = new Map<string, string[]>();
  for (const t of tokenRows ?? []) {
    const list = tokensByUser.get(t.user_id) ?? [];
    list.push(t.fcm_token);
    tokensByUser.set(t.user_id, list);
  }

  if (getApps().length === 0) initializeApp({ credential: cert(JSON.parse(saJson)) });
  const messaging = getMessaging();

  const messages: Message[] = [];
  const owners: string[] = [];   // messages[i] kis notification_log row ka hai
  const tokenOf: string[] = [];
  for (const row of claimed) {
    for (const token of tokensByUser.get(row.user_id) ?? []) {
      messages.push({
        token,
        notification: { title: row.title, body: row.body },
        data: { dedupe_key: row.dedupe_key, kind: row.kind },
        android: {
          collapseKey: row.dedupe_key.slice(0, 64),
          notification: { tag: row.dedupe_key, channelId: 'announcements' },
        },
      });
      owners.push(row.id);
      tokenOf.push(token);
    }
  }

  const okRows = new Set<string>();
  const staleTokens = new Set<string>();
  for (let i = 0; i < messages.length; i += 500) {
    const res = await messaging.sendEach(messages.slice(i, i + 500));
    res.responses.forEach((r, j) => {
      if (r.success) okRows.add(owners[i + j]);
      else if (r.error && STALE_TOKEN_CODES.has(r.error.code)) staleTokens.add(tokenOf[i + j]);
    });
  }

  const sentIds = claimed.filter((r) => okRows.has(r.id)).map((r) => r.id);
  const failedIds = claimed.filter((r) => !okRows.has(r.id)).map((r) => r.id);
  if (sentIds.length) await admin.from('notification_log').update({ status: 'sent', sent_at: new Date().toISOString() }).in('id', sentIds);
  if (failedIds.length) await admin.from('notification_log').update({ status: 'failed' }).in('id', failedIds);
  if (staleTokens.size) await admin.from('device_tokens').delete().in('fcm_token', [...staleTokens]);

  return { claimed: claimed.length, sent: sentIds.length, failed: failedIds.length, prunedTokens: staleTokens.size };
}
