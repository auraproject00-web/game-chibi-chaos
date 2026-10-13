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
| Move | A / D or ← / → | Hold the left 20% of the screen (left) or the next 20% (right) |
| Jump | Space, W or ↑ (hold longer = higher) | Tap anywhere on the right 60% (hold = higher) |
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
  traps/                  FakePlatform, SpikeTrap (visible + hidden)
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

## Deploying to Vercel

`vercel.json` sets the Vite framework preset, `npm run build` and `dist` as output. Asset paths are relative (`base: './'`), so the build also works from any static host or sub-path.
