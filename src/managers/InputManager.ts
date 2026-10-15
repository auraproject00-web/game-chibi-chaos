import Phaser from 'phaser';

/** One frame of player intent, merged from keyboard and touch. */
export interface ControlFrame {
  moveX: -1 | 0 | 1;
  jumpHeld: boolean;
  jumpPressed: boolean;
  /** The level's action (Level 04: switch dimension) was pressed this frame. */
  actionPressed: boolean;
}

export type TouchRole = 'left' | 'right' | 'jump';

/**
 * Screen-space layout of the touch controls, set by the HUD from its pad positions.
 * Fingers left of `moveZoneEnd` steer: left of `splitX` = walk left, right of it = walk right.
 * Everywhere else is the jump area.
 */
export interface TouchLayout {
  splitX: number;
  moveZoneEnd: number;
}

/**
 * Merges keyboard (A/D, arrows, Space/W/Up) and multi-touch input.
 * Touch layout: the bottom-left area steers (left/right of the thumb's resting point), tap
 * anywhere else to jump (hold for a higher jump). Every finger is tracked separately, so you
 * can keep walking while jumping with the other thumb.
 */
export class InputManager {
  private readonly keys: Record<'left' | 'right' | 'a' | 'd' | 'up' | 'w' | 'space' | 'x' | 'k' | 'shift', Phaser.Input.Keyboard.Key> | null;
  private readonly touches = new Map<number, TouchRole>();
  private jumpQueued = false;
  private actionQueued = false;
  private touchScene: Phaser.Scene | null = null;
  private layout: TouchLayout = { splitX: 120, moveZoneEnd: 300 };
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
        x: kb.addKey(K.X),
        k: kb.addKey(K.K),
        shift: kb.addKey(K.SHIFT),
      };
      const queue = (): void => {
        if (this.enabled) this.jumpQueued = true;
      };
      this.keys.up.on('down', queue);
      this.keys.w.on('down', queue);
      this.keys.space.on('down', queue);
      const action = (): void => this.queueAction();
      this.keys.x.on('down', action);
      this.keys.k.on('down', action);
      this.keys.shift.on('down', action);
    } else {
      this.keys = null;
    }
  }

  /** Action button (touch HUD) or action key: consumed by the next read(). */
  queueAction(): void {
    if (this.enabled) this.actionQueued = true;
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

  setTouchLayout(layout: TouchLayout): void {
    this.layout = layout;
  }

  private classify(pointer: Phaser.Input.Pointer): TouchRole {
    if (pointer.x < this.layout.splitX) return 'left';
    if (pointer.x < this.layout.moveZoneEnd) return 'right';
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
    // A steering finger can slide between left and right (even past the zone edge),
    // but never turns into a jump.
    this.touches.set(pointer.id, pointer.x < this.layout.splitX ? 'left' : 'right');
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
    const actionPressed = this.actionQueued;
    this.jumpQueued = false;
    this.actionQueued = false;
    const moveX: -1 | 0 | 1 = left === right ? 0 : left ? -1 : 1;
    if (!this.enabled) return { moveX: 0, jumpHeld: false, jumpPressed: false, actionPressed: false };
    return { moveX, jumpHeld, jumpPressed, actionPressed };
  }

  /** Clears every held input. Called on pause, blur, resume and respawn-sensitive moments. */
  reset(): void {
    this.touches.clear();
    this.jumpQueued = false;
    this.actionQueued = false;
    if (this.keys) Object.values(this.keys).forEach((key) => key.reset());
  }

  destroy(): void {
    this.detachTouch();
    this.touches.clear();
  }
}
