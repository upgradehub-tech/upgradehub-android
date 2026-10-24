export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const AUDIENCES = ['all', 'batch', 'no_batch'] as const;
export type Audience = (typeof AUDIENCES)[number];
export const PLATFORMS = ['android', 'ios', 'web'] as const;
export type Platform = (typeof PLATFORMS)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

function obj(raw: unknown): Record<string, unknown> {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function text(v: unknown, min: number, max: number, field: string, multiline = false): Result<string> {
  if (typeof v !== 'string') return { ok: false, error: `${field} is required` };
  let s = v.replace(CONTROL_RE, '');
  if (!multiline) s = s.replace(/[\r\n\t]+/g, ' ');
  s = s.trim();
  if (s.length < min) return { ok: false, error: `${field} must be at least ${min} characters` };
  if (s.length > max) return { ok: false, error: `${field} must be at most ${max} characters` };
  return { ok: true, value: s };
}

function audience(v: unknown): Result<Audience> {
  if (v === undefined) return { ok: true, value: 'all' };
  return typeof v === 'string' && (AUDIENCES as readonly string[]).includes(v)
    ? { ok: true, value: v as Audience }
    : { ok: false, error: 'audience must be all, batch or no_batch' };
}

export interface AnnouncementInput { title: string; body: string; audience: Audience }

export function parseAnnouncementInput(raw: unknown): Result<AnnouncementInput> {
  const r = obj(raw);
  const title = text(r.title, 3, 120, 'title');
  if (!title.ok) return title;
  const body = text(r.body, 1, 2000, 'body', true);
  if (!body.ok) return body;
  const aud = audience(r.audience);
  if (!aud.ok) return aud;
  return { ok: true, value: { title: title.value, body: body.value, audience: aud.value } };
}

export interface AnnouncementPatch {
  id: string;
  title?: string;
  body?: string;
  audience?: Audience;
  publish?: boolean;
  archive?: boolean;
}

export function parseAnnouncementPatch(raw: unknown): Result<AnnouncementPatch> {
  const r = obj(raw);
  if (!isUuid(r.id)) return { ok: false, error: 'valid id is required' };
  const out: AnnouncementPatch = { id: r.id };
  if (r.title !== undefined) {
    const t = text(r.title, 3, 120, 'title');
    if (!t.ok) return t;
    out.title = t.value;
  }
  if (r.body !== undefined) {
    const b = text(r.body, 1, 2000, 'body', true);
    if (!b.ok) return b;
    out.body = b.value;
  }
  if (r.audience !== undefined) {
    const a = audience(r.audience);
    if (!a.ok) return a;
    out.audience = a.value;
  }
  if (r.publish === true) out.publish = true;
  if (r.archive === true) out.archive = true;
  if (out.publish && out.archive) return { ok: false, error: 'publish and archive cannot be combined' };
  return { ok: true, value: out };
}

export interface SyllabusInput { subject: string; chapter: string; topic: string; sortOrder: number; isActive: boolean }

export function parseSyllabusInput(raw: unknown): Result<SyllabusInput> {
  const r = obj(raw);
  const subject = text(r.subject, 2, 50, 'subject');
  if (!subject.ok) return subject;
  const chapter = text(r.chapter, 2, 100, 'chapter');
  if (!chapter.ok) return chapter;
  const topic = text(r.topic, 1, 120, 'topic');
  if (!topic.ok) return topic;
  const sortOrder = r.sortOrder === undefined ? 0 : r.sortOrder;
  if (typeof sortOrder !== 'number' || !Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) {
    return { ok: false, error: 'sortOrder must be an integer 0-10000' };
  }
  if (r.isActive !== undefined && typeof r.isActive !== 'boolean') return { ok: false, error: 'isActive must be boolean' };
  return {
    ok: true,
    value: { subject: subject.value, chapter: chapter.value, topic: topic.value, sortOrder, isActive: r.isActive !== false },
  };
}

export interface SyllabusPatch { id: string; isActive?: boolean; sortOrder?: number }

export function parseSyllabusPatch(raw: unknown): Result<SyllabusPatch> {
  const r = obj(raw);
  if (!isUuid(r.id)) return { ok: false, error: 'valid id is required' };
  const out: SyllabusPatch = { id: r.id };
  if (r.isActive !== undefined) {
    if (typeof r.isActive !== 'boolean') return { ok: false, error: 'isActive must be boolean' };
    out.isActive = r.isActive;
  }
  if (r.sortOrder !== undefined) {
    if (typeof r.sortOrder !== 'number' || !Number.isInteger(r.sortOrder) || r.sortOrder < 0 || r.sortOrder > 10000) {
      return { ok: false, error: 'sortOrder must be an integer 0-10000' };
    }
    out.sortOrder = r.sortOrder;
  }
  if (out.isActive === undefined && out.sortOrder === undefined) return { ok: false, error: 'nothing to update' };
  return { ok: true, value: out };
}

export interface DeviceInput { token: string; platform: Platform; appVersion?: string }

export function parseDeviceInput(raw: unknown): Result<DeviceInput> {
  const r = obj(raw);
  if (typeof r.token !== 'string' || r.token.length < 20 || r.token.length > 4096 || /\s/.test(r.token)) {
    return { ok: false, error: 'invalid token' };
  }
  if (typeof r.platform !== 'string' || !(PLATFORMS as readonly string[]).includes(r.platform)) {
    return { ok: false, error: 'invalid platform' };
  }
  let appVersion: string | undefined;
  if (r.appVersion !== undefined) {
    if (typeof r.appVersion !== 'string' || r.appVersion.length > 32) return { ok: false, error: 'invalid appVersion' };
    appVersion = r.appVersion;
  }
  return { ok: true, value: { token: r.token, platform: r.platform as Platform, appVersion } };
}
