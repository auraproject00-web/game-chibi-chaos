import type { MochiFrame } from '../art/mochi';

/** What killed MOCHI. Lets messages and faces fit the moment. */
export type DeathCause = 'spike' | 'fall' | 'trap';

export interface MilestoneDef {
  /** Total death count that fires it. */
  at: number;
  title: string;
  message: string;
  /** Face shown for a moment after respawn. */
  mood: MochiFrame;
  moodMs: number;
  confetti?: boolean;
}

export interface DeathReaction {
  /** Face used for the death animation. */
  deathFace: MochiFrame;
  message: string;
  /** Present only when a milestone fired on this death. */
  milestone?: MilestoneDef;
}

/** Everyday lines. Add more freely; the picker avoids recent repeats. */
export const DEATH_MESSAGES: string[] = [
  'Oops! Coba lagi!',
  'Skill issue? Hehe…',
  'Dikit lagi padahal!',
  'Tenang, ini cuma pemanasan.',
  'Mochi tidak menyetujui ini.',
  'Yah… gitu deh.',
  'Mochi butuh pelukan.',
  'Itu tadi latihan, kan?',
  'Lagi! Lagi!',
];

/** Lines that only make sense for a given cause. */
export const CAUSE_MESSAGES: Record<DeathCause, string[]> = {
  spike: ['Duri: 1 — Mochi: 0', 'Duri itu runcing, siapa sangka.', 'Aww, nusuk.'],
  fall: ['Lantainya punya dendam pribadi.', 'Gravitasi menang lagi.', 'Selamat jalan, Mochi~'],
  trap: ['Kena deh!', 'Hehe, ketipu.'],
};

/** Faces for the death animation, by cause. Picked in turn so they vary. */
const DEATH_FACES: Record<DeathCause, MochiFrame[]> = {
  spike: ['shock', 'dead', 'defeat'],
  fall: ['defeat', 'shock', 'dead'],
  trap: ['shock', 'dizzy', 'dead'],
};

/** Fixed milestones. After the last one, a new milestone fires every REPEAT_EVERY deaths. */
export const MILESTONES: MilestoneDef[] = [
  { at: 10, title: '10x mati!', message: 'Mochi mulai kesal…', mood: 'angry', moodMs: 1600 },
  { at: 25, title: '25x mati!', message: 'Mochi nangis. Puas?', mood: 'cry', moodMs: 1800 },
  { at: 50, title: '50x mati!', message: 'Mochi sudah tidak paham lagi.', mood: 'dizzy', moodMs: 1800 },
  {
    at: 100,
    title: 'Penghargaan: 100x mati!',
    message: 'Gelar resmi: Raja Pantang Menyerah',
    mood: 'happy',
    moodMs: 1600,
    confetti: true,
  },
];

export const REPEAT_EVERY = 100;

/** Rotating titles for 200, 300, 400… deaths. */
const REPEAT_AWARDS: string[] = [
  'Gelar: Mochi Abadi',
  'Gelar: Langganan Duri',
  'Gelar: Sahabat Gravitasi',
  'Gelar: Legenda Respawn',
  'Gelar: Keras Kepala Profesional',
];

/** How many of the latest messages may not repeat. */
const NO_REPEAT = 4;

/**
 * Chooses how MOCHI reacts to a death: the death face, a short message and, when the total
 * death count hits one, a milestone. Pure logic with no Phaser objects, so it is easy to extend
 * (new lines, faces or milestones are just data above) and to test.
 */
export class DeathReactionManager {
  private recent: string[] = [];
  private faceTurn = 0;
  private readonly fired = new Set<number>();

  constructor(private readonly rng: () => number = Math.random) {}

  /** The milestone for this exact total, if any. */
  static milestoneFor(total: number): MilestoneDef | undefined {
    const fixed = MILESTONES.find((m) => m.at === total);
    if (fixed) return fixed;
    const last = MILESTONES[MILESTONES.length - 1].at;
    if (total > last && total % REPEAT_EVERY === 0) {
      const n = total / REPEAT_EVERY;
      return {
        at: total,
        title: `Penghargaan: ${total}x mati!`,
        message: REPEAT_AWARDS[(n - 2) % REPEAT_AWARDS.length],
        mood: 'happy',
        moodMs: 1600,
        confetti: true,
      };
    }
    return undefined;
  }

  /** The next milestone strictly above `total`. */
  static nextMilestone(total: number): number {
    const fixed = MILESTONES.find((m) => m.at > total);
    if (fixed) return fixed.at;
    return (Math.floor(total / REPEAT_EVERY) + 1) * REPEAT_EVERY;
  }

  /** Call once per death with the new total death count. */
  react(totalDeaths: number, cause: DeathCause): DeathReaction {
    const faces = DEATH_FACES[cause];
    const deathFace = faces[this.faceTurn++ % faces.length];

    const milestone = DeathReactionManager.milestoneFor(totalDeaths);
    if (milestone && !this.fired.has(totalDeaths)) {
      this.fired.add(totalDeaths);
      return { deathFace, message: milestone.message, milestone };
    }
    return { deathFace, message: this.pickMessage(cause) };
  }

  private pickMessage(cause: DeathCause): string {
    // Roughly half the time, a line about what actually happened.
    const pool = this.rng() < 0.5 ? CAUSE_MESSAGES[cause] : DEATH_MESSAGES;
    let options = pool.filter((m) => !this.recent.includes(m));
    if (!options.length) options = DEATH_MESSAGES.filter((m) => !this.recent.includes(m));
    const message = options[Math.floor(this.rng() * options.length)] ?? DEATH_MESSAGES[0];
    this.recent.push(message);
    if (this.recent.length > NO_REPEAT) this.recent.shift();
    return message;
  }
}
