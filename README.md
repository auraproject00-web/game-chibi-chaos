# CHIBI CHAOS

> Cute Outside, Chaos Inside.

Game penuh jebakan yang bikin pemain gregetan.

2D troll / precision platformer for mobile and desktop browsers, starring **MOCHI**.
Built with Phaser 3, TypeScript and Vite. Static build, ready for Vercel.

## Run locally

Requires Node.js 18+ (tested on Node 22).

```bash
npm install
npm run dev      # dev server at http://localhost:5173 (also reachable from a phone on the same Wi-Fi)
npm run build    # type-check + production build into dist/
npm run preview  # serve the production build locally
```

## Controls

| | Desktop | Mobile |
|---|---|---|
| Move | A / D or ← / → | Hold the ◀ ▶ pads at the bottom left (slide your thumb to switch direction) |
| Jump | Space, W or ↑ (hold longer = higher) | Tap anywhere on the right side (hold = higher) |
| Pause | Esc or P, or the pause button | Pause button |
| Restart | R or the restart button | Restart button |

Multi-touch is supported: keep one thumb on the move zone and tap jump with the other.

## Project structure

```
src/
  main.ts                 Phaser config, scene list
  config.ts               Palette, tile size, player physics tuning
  art/                    Procedural placeholder art (MOCHI frames, platforms, icons, backgrounds)
  scenes/                 Boot, Background (parallax), Menu, LevelSelect, Game, UI (HUD)
  entities/               Player (MOCHI), Checkpoint, FinishPortal
  traps/                  Config-driven troll traps (types.ts, TrapFactory.ts, one class per trap)
  levels/                 Level data (data-driven), registry, LevelBuilder
  managers/               Input, Audio (Web Audio synth), Save (LocalStorage), FX, EventBus
  ui/                     Button, Overlay, HintBubble, text helpers
public/
  assets/                 Final art and audio go here (characters, backgrounds, obstacles, audio)
```

## Adding a level

1. Create `src/levels/levelNN.ts` exporting a `LevelData` object (see `src/levels/types.ts`; coordinates are in tiles of 32 px).
2. Add it to `LEVELS` in `src/levels/index.ts`.

No changes to the core systems are needed.

## Troll traps

Traps are plain config objects in a level's `traps` array (types in `src/traps/types.ts`):

| type | What it does | How to beat it once learned |
| --- | --- | --- |
| `fakeFloor` | Cracked ground crumbles 350ms after you land | Keep moving / jump over |
| `surpriseSpikes` | Hidden spikes pop up under you, then stay visible | Jump over the spot |
| `runningPortal` | The finish portal hops away when you get close | Follow it (it never comes back) |
| `invisibleWall` | Unseen solid wall, shimmers into view after a bump | Jump over it |
| `baitCoin` | Grabbing the coin pops spikes under it | Leave the coin alone |
| `reverseControls` | Swirl pickup swaps left/right for 3s | Jump over the swirl |
| `fakeCheckpoint` | Crooked-pole flag that never saves, can pop spikes | Ignore it, jump the spikes |
| `fallingPlatform` | Wooden plank drops shortly after you stand on it | Hop off quickly |

Example: `{ type: 'baitCoin', x: 32, y: 11, spikes: { x: 31, y: 14, w: 3 } }`.
Use only a few trap types per level and introduce them one at a time. Every trap fires at the same
spot every run; there is no randomness. Deaths are unlimited: MOCHI respawns at the last checkpoint
and the death counter goes up.

In dev (`npm run dev`), open `/?traplab` to play a test level with one of each trap.

## Death reactions

`src/managers/DeathReactionManager.ts` picks what happens on each death: a funny message (no
repeats among the last four, some depend on the cause: spikes, falling, traps), the MOCHI face for
the death animation, and milestones on the total death count saved in LocalStorage (10 angry,
25 crying, 50 dizzy, 100 confetti + troll award, then every 100). Messages, faces and milestones
are plain data at the top of that file. The popup sits under the top HUD, lasts about a second and
never delays the respawn.

## Troll narrator

`src/managers/TrollPersonalityManager.ts` listens to gameplay events on the EventBus
(`PlayerDied` with the real cause and stable trap id, `PlayerRespawned`, `TrapPassed`,
`LevelComplete`) and sends lines through `NarratorSay`. The HUD shows one speech bubble at a time
and a lower-priority line never replaces a higher one. Priority: Death Reaction milestone > near
finish > same trap 3x / same area 5x > death within 3s of respawn > first death on a trap type >
passing a trap that got you > idle in a safe spot. A global cooldown applies to every narrator
line (milestones ignore it), idle fires once per still period, and the narrator stays quiet for a
moment after a milestone. Priorities and trigger counts are data at the top of the file.

### Troll intensity

Settings (main menu, or pause > Settings) has `Troll: SOFT / CHAOS / SAVAGE`. It is saved in
LocalStorage and applies immediately. It only changes the narrator: never difficulty, physics,
traps or respawn.

| Mode | Cooldown | Idle | Style |
| --- | --- | --- | --- |
| Soft | 15s | 20s | rare, supportive lines, calm fade-in, smiling face, one quiet chime |
| Chaos (default) | 8s | 15s | cheeky lines, pop + bounce, playful blip/boing |
| Savage | 5s | 12s | absurd/spicy lines (about the game, never the player), wiggle + sparkles, comments on every trap death |

Profiles live in `src/managers/TrollIntensity.ts`, lines per mode in `src/managers/trollLines.ts`.
`Suara Narator` turns narrator/troll sounds off separately from `SFX`.

## Audio

Everything is synthesized with the Web Audio API, so there are no audio files or licenses to track.

- `src/managers/AudioManager.ts`: one AudioContext, created on the first tap/key (autoplay rules,
  with the iOS silent-buffer unlock). Buses: SFX volume/mute and music volume/mute, saved in
  LocalStorage. Each sound has a minimum gap and at most 10 effects ring at once. The context is
  suspended while the tab is hidden and closed when the game is destroyed. Pause and Level Clear
  lower the music.
- `src/audio/sfx.ts`: sound recipes (jump, land, death, respawn, spike, fake floor, checkpoint,
  level complete, click, narrator popup per Troll Intensity, …).
- `src/audio/music.ts`: two original loops (menu 100 BPM, gameplay 128 BPM) written as note data and
  played by synthesized marimba, xylophone, bass and light percussion. Each is rendered once with an
  OfflineAudioContext and played as one looping buffer, so the loop is seamless and nothing is
  scheduled from JS while playing.

Settings (menu or pause): `Musik`, `Vol Musik`, `SFX`, `Vol SFX`. The HUD speaker mutes everything.
To swap in recorded music later, load the files and replace `renderTrack` with a decoded buffer.

Trap ids default to `<type>-<index>` (set `id` in the trap config to pin one). Static spikes are
`spike-<index>`. A fall right after a fake floor or falling plank fired is credited to that trap.

In dev builds a "DBG" chip under the pause button opens a debug panel: preview every narrator
line, reset the cooldown, set idle to 3s, cycle the troll mode, jump to the next death milestone. The debug tools are a
dynamic import behind `import.meta.env.DEV`, so production builds do not contain them.

To test milestones in dev, long-press the skull death counter: the total jumps to one below the
next milestone (9, 24, 49, 99, 199…), so the next death triggers it.

## Deploying to Vercel

`vercel.json` sets the Vite framework preset, `npm run build` and `dist` as output. Asset paths are relative (`base: './'`), so the build also works from any static host or sub-path.

## Mobile

Gameplay is landscape-only on phones; in portrait a "rotate your phone" screen is shown and the game pauses.
HUD and touch pads respect the iPhone safe area. Adding the site to the home screen launches it fullscreen in landscape (`public/manifest.webmanifest`).
