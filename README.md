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

To test milestones in dev, long-press the skull death counter: the total jumps to one below the
next milestone (9, 24, 49, 99, 199…), so the next death triggers it.

## Deploying to Vercel

`vercel.json` sets the Vite framework preset, `npm run build` and `dist` as output. Asset paths are relative (`base: './'`), so the build also works from any static host or sub-path.

## Mobile

Gameplay is landscape-only on phones; in portrait a "rotate your phone" screen is shown and the game pauses.
HUD and touch pads respect the iPhone safe area. Adding the site to the home screen launches it fullscreen in landscape (`public/manifest.webmanifest`).
