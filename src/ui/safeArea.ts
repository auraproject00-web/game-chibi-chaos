/** Device safe-area insets (iPhone notch, home indicator) in CSS px, read from env() via a probe element. */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

let probe: HTMLDivElement | null = null;

export function getSafeArea(): Insets {
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding-top:env(safe-area-inset-top,0px);padding-right:env(safe-area-inset-right,0px);' +
      'padding-bottom:env(safe-area-inset-bottom,0px);padding-left:env(safe-area-inset-left,0px);';
    document.body.appendChild(probe);
  }
  const cs = getComputedStyle(probe);
  return {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
}

/** True on touch devices held in portrait; gameplay is designed for landscape. */
export function isPortraitTouch(width: number, height: number, touch: boolean): boolean {
  return touch && height > width;
}
