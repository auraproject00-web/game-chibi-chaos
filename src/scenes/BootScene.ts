import Phaser from 'phaser';
import { generateTextures } from '../art/textures';
import { textStyle } from '../ui/text';

/** Builds placeholder textures and waits (briefly) for the web font before showing the menu. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.text(width / 2, height / 2, 'Loading...', textStyle(28, '#ffffff')).setOrigin(0.5);
    generateTextures(this);
    void waitForFont().then(() => {
      this.scene.launch('Background');
      if (import.meta.env.DEV && new URLSearchParams(location.search).has('traplab')) {
        this.scene.start('Game', { levelId: 99 });
      } else {
        this.scene.start('Menu');
      }
    });
  }
}

function waitForFont(): Promise<void> {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts) return Promise.resolve();
  const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, 2500));
  const load = Promise.all([fonts.load('700 32px "Fredoka"'), fonts.load('600 32px "Fredoka"')])
    .then(() => undefined)
    .catch(() => undefined);
  return Promise.race([load, timeout]);
}
