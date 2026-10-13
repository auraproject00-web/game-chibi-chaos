/** Local progress stored in LocalStorage. Every access is guarded so the game still runs when storage is blocked. */

const STORAGE_KEY = 'chibi-chaos-save-v1';

export interface LevelProgress {
  completed: boolean;
  bestDeaths: number | null;
}

export interface SaveData {
  version: 1;
  unlockedLevel: number;
  totalDeaths: number;
  levels: Record<string, LevelProgress>;
  settings: {
    sfx: boolean;
  };
  /** Control skills the player has already shown (tutorial hints stay hidden for these). */
  tutorial: Record<string, boolean>;
}

function defaults(): SaveData {
  return {
    version: 1,
    unlockedLevel: 1,
    totalDeaths: 0,
    levels: {},
    settings: { sfx: true },
    tutorial: {},
  };
}

class SaveManagerImpl {
  private data: SaveData = defaults();

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      const base = defaults();
      this.data = {
        ...base,
        ...parsed,
        version: 1,
        levels: { ...base.levels, ...(parsed.levels ?? {}) },
        settings: { ...base.settings, ...(parsed.settings ?? {}) },
        tutorial: { ...base.tutorial, ...(parsed.tutorial ?? {}) },
      };
    } catch {
      this.data = defaults();
    }
  }

  private persist(): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Storage unavailable (private mode, quota). Progress lives for this session only.
    }
  }

  get unlockedLevel(): number {
    return this.data.unlockedLevel;
  }

  get totalDeaths(): number {
    return this.data.totalDeaths;
  }

  get sfxEnabled(): boolean {
    return this.data.settings.sfx;
  }

  setSfxEnabled(enabled: boolean): void {
    this.data.settings.sfx = enabled;
    this.persist();
  }

  hasLearned(skill: string): boolean {
    return !!this.data.tutorial[skill];
  }

  markLearned(skill: string): void {
    if (this.data.tutorial[skill]) return;
    this.data.tutorial[skill] = true;
    this.persist();
  }

  getLevel(id: number): LevelProgress {
    return this.data.levels[String(id)] ?? { completed: false, bestDeaths: null };
  }

  isUnlocked(id: number): boolean {
    return id <= this.data.unlockedLevel;
  }

  addDeath(): void {
    this.data.totalDeaths += 1;
    this.persist();
  }

  /** Records a finished run and unlocks the next level. Returns the best death count. */
  completeLevel(id: number, deaths: number): number {
    const prev = this.getLevel(id);
    const best = prev.bestDeaths === null ? deaths : Math.min(prev.bestDeaths, deaths);
    this.data.levels[String(id)] = { completed: true, bestDeaths: best };
    this.data.unlockedLevel = Math.max(this.data.unlockedLevel, id + 1);
    this.persist();
    return best;
  }
}

export const SaveManager = new SaveManagerImpl();
