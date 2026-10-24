import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RecentKeyGuard, buildDedupeKey, uniqueByUserAndKey } from '../lib/notifications/dedupe';

test('buildDedupeKey is stable and validates input', () => {
  assert.equal(buildDedupeKey('announcement', 'abc-123'), 'announcement:abc-123');
  assert.equal(buildDedupeKey('slot_reminder', 'slot1', '2026-10-24'), 'slot_reminder:slot1:2026-10-24');
  assert.equal(buildDedupeKey('announcement', 'abc-123'), buildDedupeKey('announcement', 'abc-123'));
  assert.throws(() => buildDedupeKey('announcement', 'bad id'));
  assert.throws(() => buildDedupeKey('announcement', "x'; drop table"));
  assert.throws(() => buildDedupeKey('announcement', 'ok', 'bad scope'));
});

test('uniqueByUserAndKey keeps first, same user different key survives', () => {
  const rows = [
    { user_id: 'u1', dedupe_key: 'k1', n: 1 },
    { user_id: 'u1', dedupe_key: 'k1', n: 2 },
    { user_id: 'u1', dedupe_key: 'k2', n: 3 },
    { user_id: 'u2', dedupe_key: 'k1', n: 4 },
  ];
  assert.deepEqual(uniqueByUserAndKey(rows).map((r) => r.n), [1, 3, 4]);
});

test('RecentKeyGuard blocks inside the window and allows after it', () => {
  const g = new RecentKeyGuard(30_000);
  assert.equal(g.isDuplicate('a', 1_000), false);
  assert.equal(g.isDuplicate('a', 20_000), true);
  assert.equal(g.isDuplicate('b', 20_000), false);
  assert.equal(g.isDuplicate('a', 31_001), false);
});

test('RecentKeyGuard memory stays bounded', () => {
  const g = new RecentKeyGuard(1_000_000, 50);
  for (let i = 0; i < 500; i++) g.isDuplicate(`k${i}`, i);
  assert.equal(g.isDuplicate('k499', 600), true);    // recent key still remembered
  assert.equal(g.isDuplicate('k0', 600), false);     // oldest evicted
});
