# Allhouse pixel brand kit

Created 21 October 2026. Symbols generated with the built-in image generation tool, with true transparent backgrounds. The wordmark is an original, deterministic pixel alphabet rendered as SVG in the application so it stays sharp and automatically follows the light/dark text colour.

## Directions

1. **Arcade House — selected:** cream house, red arcade joystick, amber/teal buttons, cyan broadcast signal. Used throughout the app.
2. **Gamepad House:** burgundy roof, cream gamepad body, D-pad and action buttons, broadcast chimney.
3. **Broadcast House:** house-shaped CRT, play symbol, joystick, antenna.

Each direction includes its original transparent symbol and transparent `lockup-light.png` / `lockup-dark.png` (symbol + ALLHOUSE). `brand-board.png` compares them at large and small sizes. `app-dark.png`, `app-light.png` and `app-compact.png` record the sidebar integration.

## Production files

- `public/brand/allhouse-icon-{16,24,32,48,64,128,256,512,1024}.png`
- `public/brand/allhouse.ico` — embedded PNG entries at 16, 24, 32, 48, 64, 128 and 256 px
- `public/brand/allhouse-lockup-light.png` / `allhouse-lockup-dark.png`
- `public/brand/allhouse-wordmark-light.svg` / `allhouse-wordmark-dark.svg`
- `src/Brand.tsx` — shared symbol, theme-aware pixel wordmark and sidebar lockup

The app icon is configured for both Electron windows, the HTML favicon and Windows packaging. The local manual uses the matching PNG favicon. No platform logos, widgets, connections or user workspace data were changed.

## Export and verification

`scripts/build-brand.cjs` creates mechanical size/format exports and the comparison sheet from the original PNGs. It uses `sharp` as an authoring tool only; Allhouse does not need it at runtime or in its normal build. No AI API key is needed for the generated assets.

Visual verification: dark and light at 1440×960, compact navigation at 800×600, no clipped sidebar logo or missing image. TypeScript and Vite production build passed. The Windows package is in `release/Allhouse-win32-x64/`; keep the entire folder together when running Allhouse.exe. Existing app processes need to be closed and reopened to load the new interface/icon.

The generation prompts are recorded in `PROMPTS.md`. Generated originals remain in this folder to preserve the other two design directions.
