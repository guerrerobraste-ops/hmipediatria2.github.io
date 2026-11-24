import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESENCE_ONLINE_TTL_MS,
  resolveProfilePresence,
  isPresenceRecordOnline,
  formatLastLoginSpanish,
  resolveCanonicalPresenceKey,
  type UserPresenceRecord,
} from './userPresence';

test('resolveCanonicalPresenceKey prioritizes profileId, username, email, then admin', () => {
  assert.equal(
    resolveCanonicalPresenceKey({ profileId: 'abc-123', username: 'dr_juan' }),
    'id:abc-123'
  );
  assert.equal(
    resolveCanonicalPresenceKey({ username: 'Dr_Maria' }),
    'user:dr_maria'
  );
  assert.equal(
    resolveCanonicalPresenceKey({ email: 'Med@Hospital.COM' }),
    'email:med@hospital.com'
  );
  assert.equal(
    resolveCanonicalPresenceKey({ isAdmin: true }),
    'user:admin'
  );
});

test('isPresenceRecordOnline honors active heartbeat within 45s TTL and expires after TTL', () => {
  const nowMs = Date.parse('2026-11-15T18:00:00.000Z');
  const fresh: UserPresenceRecord = {
    key: 'user:dr_ana',
    username: 'dr_ana',
    isOnline: true,
    lastLoginAt: '2026-11-15T17:30:00.000Z',
    lastSeenAt: new Date(nowMs - 10_000).toISOString(),
  };
  const expired: UserPresenceRecord = {
    ...fresh,
    lastSeenAt: new Date(nowMs - PRESENCE_ONLINE_TTL_MS - 5000).toISOString(),
  };
  const loggedOut: UserPresenceRecord = {
    ...fresh,
    isOnline: false,
  };

  assert.equal(isPresenceRecordOnline(fresh, nowMs), true);
  assert.equal(isPresenceRecordOnline(expired, nowMs), false);
  assert.equal(isPresenceRecordOnline(loggedOut, nowMs), false);
});

test('resolveProfilePresence matches by profileId, username, email, and admin alias and formats last login', () => {
  const nowMs = Date.parse('2026-11-15T18:00:00.000Z');
  const loginIso = '2026-11-15T17:45:00.000Z';

  const presenceMap: Record<string, UserPresenceRecord> = {
    'user:admin': {
      key: 'user:admin',
      username: 'admin',
      isAdmin: true,
      isOnline: true,
      lastLoginAt: loginIso,
      lastSeenAt: new Date(nowMs - 5_000).toISOString(),
    },
    'id:doc-2': {
      key: 'id:doc-2',
      profileId: 'doc-2',
      username: 'dra_carla',
      email: 'carla@hmi.com',
      isOnline: false,
      lastLoginAt: '2026-11-14T20:10:00.000Z',
      lastSeenAt: '2026-11-14T21:00:00.000Z',
    },
  };

  const adminRes = resolveProfilePresence(
    {
      id: 'adm-1',
      email: 'guerrerobraste@gmail.com',
      is_admin: true,
      details: { username: 'brayan' },
    },
    presenceMap,
    nowMs
  );
  assert.equal(adminRes.isOnline, true);
  assert.equal(adminRes.lastLoginAt, loginIso);
  assert.notEqual(adminRes.formattedLastLogin, 'Sin sesión registrada');

  const offlineDoc = resolveProfilePresence(
    {
      id: 'doc-2',
      email: 'carla@hmi.com',
      is_admin: false,
      details: { username: 'dra_carla' },
    },
    presenceMap,
    nowMs
  );
  assert.equal(offlineDoc.isOnline, false);
  assert.equal(offlineDoc.lastLoginAt, '2026-11-14T20:10:00.000Z');
  assert.notEqual(offlineDoc.formattedLastLogin, 'Sin sesión registrada');

  const neverLoggedDoc = resolveProfilePresence(
    {
      id: 'doc-3',
      email: 'nuevo@hmi.com',
      is_admin: false,
      details: { username: 'dr_nuevo' },
    },
    presenceMap,
    nowMs
  );
  assert.equal(neverLoggedDoc.isOnline, false);
  assert.equal(neverLoggedDoc.lastLoginAt, null);
  assert.equal(neverLoggedDoc.formattedLastLogin, 'Sin sesión registrada');
});

test('formatLastLoginSpanish handles invalid values gracefully', () => {
  assert.equal(formatLastLoginSpanish(null), 'Sin sesión registrada');
  assert.equal(formatLastLoginSpanish('not-a-date'), 'Sin sesión registrada');
});
