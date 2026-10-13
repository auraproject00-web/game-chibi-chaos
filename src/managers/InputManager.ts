import Phaser from 'phaser';

/** One frame of player intent, merged from keyboard and touch. */
export interface ControlFrame {
  moveX: -1 | 0 | 1;
  jumpHeld: boolean;
  jumpPressed: boolean;
}

export type TouchRole = 'left' | 'right' | 'jump';

/** Fraction of the screen width, from the left edge, used for movement. */
export const MOVE_ZONE = { leftEnd: 0.2, rightEnd: 0.4 } as const;

/**
 * Merges keyboard (A/D, arrows, Space/W/Up) and multi-touch input.
 * Touch layout: hold the left 20% of the screen to go left, the next 20% to go right,
 * tap anywhere else to jump (hold for a higher jump). Every finger is tracked separately,
 * so moving and jumping at the same time works.
 */
export class InputManager {
  private readonly keys: Record<'left' | 'right' | 'a' | 'd' | 'up' | 'w' | 'space', Phaser.Input.Keyboard.Key> | null;
  private readonly touches = new Map<number, TouchRole>();
  private jumpQueued = false;
  private touchScene: Phaser.Scene | null = null;
  enabled = true;

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (kb) {
      const K = Phaser.Input.Keyboard.KeyCodes;
      this.keys = {
        left: kb.addKey(K.LEFT),
        right: kb.addKey(K.RIGHT),
        a: kb.addKey(K.A),
        d: kb.addKey(K.D),
        up: kb.addKey(K.UP),
        w: kb.addKey(K.W),
        space: kb.addKey(K.SPACE),
      };
      const queue = (): void => {
        if (this.enabled) this.jumpQueued = true;
      };
      this.keys.up.on('down', queue);
      this.keys.w.on('down', queue);
      this.keys.space.on('down', queue);
    } else {
      this.keys = null;
    }
  }

  /** Touch is read from the HUD scene, which sits on top and knows which taps hit buttons. */
  attachTouch(scene: Phaser.Scene): void {
    this.detachTouch();
    this.touchScene = scene;
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
  }

  detachTouch(): void {
    if (!this.touchScene) return;
    const input = this.touchScene.input;
    input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    this.touchScene = null;
  }

  /** Which roles are currently held by fingers, for the on-screen hints. */
  heldRoles(): Set<TouchRole> {
    return new Set(this.touches.values());
  }

  private classify(pointer: Phaser.Input.Pointer): TouchRole {
    const w = this.touchScene?.scale.width ?? window.innerWidth;
    const fx = pointer.x / w;
    if (fx < MOVE_ZONE.leftEnd) return 'left';
    if (fx < MOVE_ZONE.rightEnd) return 'right';
    return 'jump';
  }

  private onDown(pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    if (!this.enabled || over.length > 0) return;
    const role = this.classify(pointer);
    this.touches.set(pointer.id, role);
    if (role === 'jump') this.jumpQueued = true;
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    const role = this.touches.get(pointer.id);
    if (!role || role === 'jump') return;
    // A movement finger can slide between left and right, but never turns into a jump.
    const next = this.classify(pointer);
    if (next !== 'jump') this.touches.set(pointer.id, next);
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    this.touches.delete(pointer.id);
  }

  /** Drops touches whose pointer is no longer down (touchcancel, lost focus, orientation change). */
  private pruneTouches(): void {
    const pointers = this.touchScene?.input.manager.pointers ?? [];
    for (const id of [...this.touches.keys()]) {
      const p = pointers.find((ptr) => ptr.id === id);
      if (!p || !p.isDown) this.touches.delete(id);
    }
  }

  read(): ControlFrame {
    this.pruneTouches();
    const roles = this.heldRoles();
    const k = this.keys;
    const left = roles.has('left') || (!!k && (k.left.isDown || k.a.isDown));
    const right = roles.has('right') || (!!k && (k.right.isDown || k.d.isDown));
    const jumpHeld = roles.has('jump') || (!!k && (k.space.isDown || k.up.isDown || k.w.isDown));
    const jumpPressed = this.jumpQueued;
    this.jumpQueued = false;
    const moveX: -1 | 0 | 1 = left === right ? 0 : left ? -1 : 1;
    if (!this.enabled) return { moveX: 0, jumpHeld: false, jumpPressed: false };
    return { moveX, jumpHeld, jumpPressed };
  }

  /** Clears every held input. Called on pause, blur, resume and respawn-sensitive moments. */
  reset(): void {
    this.touches.clear();
    this.jumpQueued = false;
    if (this.keys) Object.values(this.keys).forEach((key) => key.reset());
  }

  destroy(): void {
    this.detachTouch();
    this.touches.clear();
  }
}
