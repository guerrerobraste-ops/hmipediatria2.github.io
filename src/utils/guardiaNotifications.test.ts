import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGuardiaNotificationPayload,
  formatGuardiaDateLabel,
  normalizeIncomingGuardiaNotification,
  resolveGuardiaGroupsForDay,
  shouldDisplayIncomingBroadcast,
  shouldTriggerNoonGuardiaNotification,
} from './guardiaNotifications';
import { DEFAULT_ROL_GUARDIAS } from '../services/storage';

test('resolveGuardiaGroupsForDay finds duty groups and doctors for a given day of month', () => {
  const groupsDay25 = resolveGuardiaGroupsForDay(DEFAULT_ROL_GUARDIAS, 25);
  assert.equal(groupsDay25.length, 1);
  assert.equal(groupsDay25[0].nombreGrupo, 'Grupo II');
  assert.equal(groupsDay25[0].icon, '💊');
  assert.ok(groupsDay25[0].miembros.some(m => m.nombre.includes('Brayan')));
});

test('shouldTriggerNoonGuardiaNotification triggers only at 12 PM Venezuela time and once per day', () => {
  // Venezuela is UTC-4: 16:00 UTC = 12:00 PM VET
  const noonVet = new Date('2026-11-23T16:00:00.000Z');
  const beforeNoonVet = new Date('2026-11-23T15:59:00.000Z');
  const afterNoonWindowVet = new Date('2026-11-23T17:00:00.000Z');

  assert.equal(shouldTriggerNoonGuardiaNotification(beforeNoonVet, null).shouldTrigger, false);

  const firstTrigger = shouldTriggerNoonGuardiaNotification(noonVet, null);
  assert.equal(firstTrigger.shouldTrigger, true);
  assert.equal(firstTrigger.dateKey, '2026-11-23');
  assert.equal(firstTrigger.veHour, 12);

  // Already shown today -> must not repeat
  assert.equal(shouldTriggerNoonGuardiaNotification(noonVet, '2026-11-23').shouldTrigger, false);
  // Outside 12 PM hour -> must not trigger
  assert.equal(shouldTriggerNoonGuardiaNotification(afterNoonWindowVet, null).shouldTrigger, false);
});

test('buildGuardiaNotificationPayload builds scheduled, broadcast, and test payloads cleanly', () => {
  const noonVet = new Date('2026-11-25T16:05:00.000Z'); // 12:05 PM VET on Nov 25
  const scheduled = buildGuardiaNotificationPayload({
    guardias: DEFAULT_ROL_GUARDIAS,
    source: 'scheduled_12pm',
    now: noonVet,
  });

  assert.equal(scheduled.source, 'scheduled_12pm');
  assert.equal(scheduled.timeLabel, '12:00 PM');
  assert.equal(scheduled.dayNumber, 25);
  assert.equal(scheduled.groups.length, 1);
  assert.equal(scheduled.groups[0].nombreGrupo, 'Grupo II');
  assert.ok(scheduled.dateLabel.includes('Noviembre'));

  const broadcast = buildGuardiaNotificationPayload({
    guardias: DEFAULT_ROL_GUARDIAS,
    source: 'admin_broadcast',
    now: noonVet,
    customMessage: 'Reunión puntual a las 12:00 PM en estación de enfermería.',
    sentBy: 'Administrador',
  });
  assert.equal(broadcast.source, 'admin_broadcast');
  assert.equal(broadcast.customMessage, 'Reunión puntual a las 12:00 PM en estación de enfermería.');
  assert.equal(broadcast.sentBy, 'Administrador');

  const testPreview = buildGuardiaNotificationPayload({
    guardias: DEFAULT_ROL_GUARDIAS,
    source: 'admin_test',
    now: noonVet,
    targetDay: 24,
  });
  assert.equal(testPreview.source, 'admin_test');
  assert.equal(testPreview.dayNumber, 24);
  assert.equal(testPreview.groups[0].nombreGrupo, 'Grupo I');
});

test('shouldDisplayIncomingBroadcast enforces idempotency and rejects stale or non-broadcast payloads', () => {
  const nowMs = Date.parse('2026-11-25T16:10:00.000Z');
  const broadcast = buildGuardiaNotificationPayload({
    guardias: DEFAULT_ROL_GUARDIAS,
    source: 'admin_broadcast',
    now: new Date(nowMs - 60_000),
    id: 'broadcast-abc-123',
  });

  assert.equal(shouldDisplayIncomingBroadcast(broadcast, null, nowMs), true);
  assert.equal(shouldDisplayIncomingBroadcast(broadcast, 'broadcast-abc-123', nowMs), false);
  assert.equal(shouldDisplayIncomingBroadcast(broadcast, 'older-id', nowMs), true);

  // Stale broadcast (> 12 hours old)
  const staleBroadcast = { ...broadcast, createdAt: new Date(nowMs - 13 * 60 * 60 * 1000).toISOString() };
  assert.equal(shouldDisplayIncomingBroadcast(staleBroadcast, null, nowMs), false);

  // Test notification should never trigger global broadcast display
  const testNotif = { ...broadcast, source: 'admin_test' as const };
  assert.equal(shouldDisplayIncomingBroadcast(testNotif, null, nowMs), false);
});

test('normalizeIncomingGuardiaNotification sanitizes payloads and formatGuardiaDateLabel outputs Spanish date', () => {
  const label = formatGuardiaDateLabel(2026, 11, 23);
  assert.equal(label, 'Lunes, 23 de Noviembre de 2026');

  assert.equal(normalizeIncomingGuardiaNotification(null), null);
  assert.equal(normalizeIncomingGuardiaNotification({ id: '', source: 'admin_broadcast' }), null);

  const normalized = normalizeIncomingGuardiaNotification({
    id: 'notif-1',
    source: 'admin_broadcast',
    title: 'Guardia de Hoy',
    dayNumber: 23,
    groups: [
      {
        id: 'g1',
        nombreGrupo: 'Grupo I',
        icon: '🌡️',
        color: 'teal',
        miembros: [{ nombre: 'Dra. Yelitza', rol: 'Médico de Guardia', area: 'Triaje' }],
      },
    ],
    createdAt: '2026-11-23T16:00:00.000Z',
  });

  assert.ok(normalized);
  assert.equal(normalized.groups.length, 1);
  assert.equal(normalized.groups[0].miembros[0].nombre, 'Dra. Yelitza');
});
