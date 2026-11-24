import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MASTER_ADMIN_PASSWORD,
  verifyMasterAdminPassword,
  validateAndComputeAdminPasswordChange,
} from './adminAuth';

test('default master admin password is Bg250997 and rejects legacy admin bypass', () => {
  assert.equal(DEFAULT_MASTER_ADMIN_PASSWORD, 'Bg250997');
  assert.equal(verifyMasterAdminPassword('Bg250997', DEFAULT_MASTER_ADMIN_PASSWORD), true);
  assert.equal(verifyMasterAdminPassword('admin', DEFAULT_MASTER_ADMIN_PASSWORD), false);
  assert.equal(verifyMasterAdminPassword('Bg250997.', DEFAULT_MASTER_ADMIN_PASSWORD), false);
});

test('password rotation succeeds only with active password and invalidates old password immediately', () => {
  const badAttempt = validateAndComputeAdminPasswordChange({
    currentPassword: 'admin',
    newPassword: 'NuevaClave2026',
    confirmPassword: 'NuevaClave2026',
    activePassword: 'Bg250997',
  });
  assert.equal(badAttempt.ok, false);

  const validChange = validateAndComputeAdminPasswordChange({
    currentPassword: 'Bg250997',
    newPassword: 'NuevaClave2026',
    confirmPassword: 'NuevaClave2026',
    activePassword: 'Bg250997',
  });
  assert.equal(validChange.ok, true);
  assert.equal(validChange.nextPassword, 'NuevaClave2026');

  // Once rotated, old password Bg250997 and 'admin' MUST fail!
  assert.equal(verifyMasterAdminPassword('Bg250997', validChange.nextPassword), false);
  assert.equal(verifyMasterAdminPassword('admin', validChange.nextPassword), false);
  assert.equal(verifyMasterAdminPassword('NuevaClave2026', validChange.nextPassword), true);
});
