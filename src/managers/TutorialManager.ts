import { TILE } from '../config';
import type { Player } from '../entities/Player';
import type { HintDef, TutorialSkill } from '../levels/types';
import type { HintBubble } from '../ui/HintBubble';
import { SaveManager } from './SaveManager';

export interface PlacedHint {
  def: HintDef;
  bubble: HintBubble;
}

/** Control hints unlock in this order, one step at a time. */
const CHAIN: TutorialSkill[] = ['move', 'jump', 'highJump'];

/** Show distance (in tiles) ahead of and behind MOCHI. */
const SHOW_AHEAD = 9;
const SHOW_BEHIND = 3;

/** Rise (px) that counts as a deliberate held jump; a tapped jump stays well below this. */
const HIGH_JUMP_RISE = 80;
const MOVE_DISTANCE = 2.5 * TILE;

/**
 * Shows tutorial bubbles progressively based on what the player has done.
 * Reads player stats only; it never touches movement or physics.
 */
export class TutorialManager {
  private readonly spawnX: number;

  constructor(
    private readonly hints: PlacedHint[],
    private readonly player: Player,
  ) {
    this.spawnX = player.body.center.x;
  }

  private learned(skill: TutorialSkill): boolean {
    return SaveManager.hasLearned(skill);
  }

  /** Called by the game when a checkpoint is touched. */
  onCheckpoint(): void {
    SaveManager.markLearned('checkpoint');
  }

  update(): void {
    const p = this.player;
    if (!this.learned('move') && Math.abs(p.body.center.x - this.spawnX) > MOVE_DISTANCE) SaveManager.markLearned('move');
    if (!this.learned('jump') && p.jumpCount > 0) SaveManager.markLearned('jump');
    if (!this.learned('highJump') && p.bestRise >= HIGH_JUMP_RISE) SaveManager.markLearned('highJump');

    const px = p.body.center.x / TILE;
    for (const { def, bubble } of this.hints) {
      const near = def.x - px < SHOW_AHEAD && px - def.x < SHOW_BEHIND;
      let visible = near;
      if (def.teach) {
        if (this.learned(def.teach)) visible = false;
        const idx = CHAIN.indexOf(def.teach);
        if (idx > 0 && !this.learned(CHAIN[idx - 1])) visible = false;
      }
      if (visible) bubble.show();
      else bubble.hide();
    }
  }
}
