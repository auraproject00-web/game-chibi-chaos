import Phaser from 'phaser';
import { PLAYER } from './config';
import { AudioManager } from './managers/AudioManager';
import { EventBus } from './managers/EventBus';
import { BackgroundScene } from './scenes/BackgroundScene';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { LevelSelectScene } from './scenes/LevelSelectScene';
import { MenuScene } from './scenes/MenuScene';
import { UIScene } from './scenes/UIScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#bfe3ff',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: PLAYER.gravity },
      debug: false,
    },
  },
  input: {
    activePointers: 4,
  },
  render: {
    antialias: true,
    roundPixels: false,
  },
  // Order matters: Background renders below everything, UI on top.
  scene: [BootScene, BackgroundScene, MenuScene, LevelSelectScene, GameScene, UIScene],
};

const game = new Phaser.Game(config);
AudioManager.installUnlock();

// Orientation changes can leave fingers "stuck"; force a resize pass.
window.addEventListener('orientationchange', () => {
  window.setTimeout(() => game.scale.refresh(), 250);
});

if (import.meta.env.DEV) {
  (window as unknown as { __CHIBI__: Phaser.Game; __BUS__: typeof EventBus }).__CHIBI__ = game;
  (window as unknown as { __BUS__: typeof EventBus }).__BUS__ = EventBus;
}
