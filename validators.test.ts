import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAnnouncementInput, parseAnnouncementPatch, parseDeviceInput, parseSyllabusInput, parseSyllabusPatch, isUuid,
} from '../lib/admin/validators';

const UUID = '123e4567-e89b-12d3-a456-426614174000';

test('announcement: valid input is trimmed and defaulted', () => {
  const r = parseAnnouncementInput({ title: '  Mock test Sunday  ', body: 'Be ready' });
  assert.ok(r.ok);
  if (r.ok) { assert.equal(r.value.title, 'Mock test Sunday'); assert.equal(r.value.audience, 'all'); }
});

test('announcement: rejects short title, long body, bad audience, non-object', () => {
  assert.equal(parseAnnouncementInput({ title: 'ab', body: 'x' }).ok, false);
  assert.equal(parseAnnouncementInput({ title: 'Valid', body: 'x'.repeat(2001) }).ok, false);
  assert.equal(parseAnnouncementInput({ title: 'Valid', body: 'x', audience: 'admins' }).ok, false);
  assert.equal(parseAnnouncementInput(null).ok, false);
  assert.equal(parseAnnouncementInput('str').ok, false);
  assert.equal(parseAnnouncementInput([]).ok, false);
});

test('announcement: control characters are stripped, title newlines flattened', () => {
  const r = parseAnnouncementInput({ title: 'Hello\u0000\nWorld', body: 'a\u0007b' });
  assert.ok(r.ok);
  if (r.ok) { assert.equal(r.value.title, 'Hello World'); assert.equal(r.value.body, 'ab'); }
});

test('announcement patch: needs uuid, publish+archive conflict rejected', () => {
  assert.equal(parseAnnouncementPatch({ id: 'nope', publish: true }).ok, false);
  assert.equal(parseAnnouncementPatch({ id: UUID, publish: true, archive: true }).ok, false);
  const r = parseAnnouncementPatch({ id: UUID, publish: true, role: 'admin', status: 'published' });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(Object.keys(r.value).sort(), ['id', 'publish']);   // unknown/mass-assignment fields drop
});

test('syllabus: valid, bad sortOrder, non-boolean isActive', () => {
  assert.ok(parseSyllabusInput({ subject: 'Physics', chapter: 'Rotation', topic: 'Torque' }).ok);
  assert.equal(parseSyllabusInput({ subject: 'Physics', chapter: 'Rotation', topic: 'T', sortOrder: -1 }).ok, false);
  assert.equal(parseSyllabusInput({ subject: 'Physics', chapter: 'Rotation', topic: 'T', sortOrder: 1.5 }).ok, false);
  assert.equal(parseSyllabusInput({ subject: 'Physics', chapter: 'Rotation', topic: 'T', isActive: 'yes' }).ok, false);
});

test('syllabus patch: empty patch rejected', () => {
  assert.equal(parseSyllabusPatch({ id: UUID }).ok, false);
  assert.ok(parseSyllabusPatch({ id: UUID, isActive: false }).ok);
});

test('device: token/platform validation', () => {
  const token = 'a'.repeat(40);
  assert.ok(parseDeviceInput({ token, platform: 'android', appVersion: '1.0' }).ok);
  assert.equal(parseDeviceInput({ token: 'short', platform: 'android' }).ok, false);
  assert.equal(parseDeviceInput({ token: 'a b'.repeat(20), platform: 'android' }).ok, false);
  assert.equal(parseDeviceInput({ token, platform: 'symbian' }).ok, false);
  assert.equal(parseDeviceInput({ token, platform: 'web', appVersion: 'v'.repeat(33) }).ok, false);
});

test('isUuid', () => {
  assert.ok(isUuid(UUID));
  assert.equal(isUuid('123'), false);
  assert.equal(isUuid(undefined), false);
});
