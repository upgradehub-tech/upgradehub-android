export type NotificationKind = 'announcement' | 'syllabus' | 'slot_reminder';

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** Stable key: same event => same key => DB unique(user_id, dedupe_key) duplicate rok deta hai. */
export function buildDedupeKey(kind: NotificationKind, id: string, scope?: string): string {
  if (!ID_RE.test(id)) throw new Error('invalid id for dedupe key');
  if (scope !== undefined && !ID_RE.test(scope)) throw new Error('invalid scope for dedupe key');
  return scope ? `${kind}:${id}:${scope}` : `${kind}:${id}`;
}

/** Ek batch ke andar (user, key) duplicates hatata hai; pehla rakhta hai. */
export function uniqueByUserAndKey<T extends { user_id: string; dedupe_key: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const k = `${row.user_id}|${row.dedupe_key}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(row);
  }
  return out;
}

/** Time-window guard (same logic Android SlotAlertGuard mein hai). true => duplicate, skip karo. */
export class RecentKeyGuard {
  private seen = new Map<string, number>();
  constructor(private ttlMs: number, private maxKeys = 200) {}

  isDuplicate(key: string, now: number): boolean {
    const last = this.seen.get(key);
    if (last !== undefined && now - last < this.ttlMs) return true;
    this.seen.set(key, now);
    if (this.seen.size > this.maxKeys) {
      for (const [k, t] of this.seen) if (now - t >= this.ttlMs) this.seen.delete(k);
      while (this.seen.size > this.maxKeys) {
        const oldest = this.seen.keys().next().value;
        if (oldest === undefined) break;
        this.seen.delete(oldest);
      }
    }
    return false;
  }
}
