export const MOBILE_VIEWPORT_MAX_WIDTH = 767;

export function isMobileViewportWidth(width: number): boolean {
  if (!Number.isFinite(width) || width <= 0) return false;
  return width <= MOBILE_VIEWPORT_MAX_WIDTH;
}

export function shouldPauseForMobileBackground(params: {
  isMobileView: boolean;
  isDocumentHidden: boolean;
  isWindowBlurred?: boolean;
}): boolean {
  if (!params.isMobileView) {
    return false;
  }
  return Boolean(params.isDocumentHidden || params.isWindowBlurred);
}

export function resolveMobileEffectivePlayback(params: {
  userWantsAudio: boolean;
  isMobilePaused: boolean;
}): boolean {
  return Boolean(params.userWantsAudio && !params.isMobilePaused);
}
