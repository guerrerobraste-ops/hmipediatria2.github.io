import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isMobileViewportWidth,
  shouldPauseForMobileBackground,
  resolveMobileEffectivePlayback,
} from './mobileActivityGuard';

test('isMobileViewportWidth detects <= 767px mobile viewports cleanly', () => {
  assert.equal(isMobileViewportWidth(390), true);
  assert.equal(isMobileViewportWidth(767), true);
  assert.equal(isMobileViewportWidth(768), false);
  assert.equal(isMobileViewportWidth(1440), false);
});

test('shouldPauseForMobileBackground pauses ONLY in mobile view when hidden or blurred', () => {
  // Mobile view visible & focused -> active
  assert.equal(
    shouldPauseForMobileBackground({
      isMobileView: true,
      isDocumentHidden: false,
      isWindowBlurred: false,
    }),
    false
  );

  // Mobile view hidden (went to home screen / switched app) -> paused
  assert.equal(
    shouldPauseForMobileBackground({
      isMobileView: true,
      isDocumentHidden: true,
      isWindowBlurred: false,
    }),
    true
  );

  // Mobile view window blurred (app switcher) -> paused
  assert.equal(
    shouldPauseForMobileBackground({
      isMobileView: true,
      isDocumentHidden: false,
      isWindowBlurred: true,
    }),
    true
  );

  // Desktop view hidden or blurred -> NEVER paused by mobile background guard
  assert.equal(
    shouldPauseForMobileBackground({
      isMobileView: false,
      isDocumentHidden: true,
      isWindowBlurred: true,
    }),
    false
  );
});

test('resolveMobileEffectivePlayback preserves user audio intent across mobile pause/resume cycles', () => {
  assert.equal(resolveMobileEffectivePlayback({ userWantsAudio: true, isMobilePaused: false }), true);
  assert.equal(resolveMobileEffectivePlayback({ userWantsAudio: true, isMobilePaused: true }), false);
  assert.equal(resolveMobileEffectivePlayback({ userWantsAudio: false, isMobilePaused: false }), false);
  assert.equal(resolveMobileEffectivePlayback({ userWantsAudio: false, isMobilePaused: true }), false);
});
