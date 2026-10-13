import Phaser from 'phaser';
import { FONT, TONES } from '../config';

const RES = Math.min(window.devicePixelRatio || 1, 2);

/** Shared text style so every label uses the same rounded game font. */
export function textStyle(
  size: number,
  color: string = TONES.inkCss,
  extra: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT,
    fontSize: `${Math.round(size)}px`,
    fontStyle: '700',
    color,
    resolution: RES,
    ...extra,
  };
}

export function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export function darken(color: number, amount: number): number {
  return Phaser.Display.Color.IntegerToColor(color).darken(amount).color;
}
