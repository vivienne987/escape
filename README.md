# Escape to Freedom — 3D

Open `vivian_escape_room.html` in a browser. It is a standalone, offline-capable file containing the 3D engine, geometry, artwork, styles, and game logic. WebGL is required. No account or internet connection is needed to play; historical reading links require internet.

Move with **WASD**, drag to look, or use arrow keys to turn/look. Aim the center crosshair at an object, move close, and press **E** or **Inspect**. Touch devices have movement buttons and drag-to-look. The clue notebook keeps discoveries. The timer starts after Start game and continues while reading clues.

Search seven loose papers on the old writing desk to find the useful memorandum, and find the folded chair note. Inspect the four distinct aged paintings: a barn couple, a reader by a window, a river mill landscape, and a sewing-table still life, magnify their details, and record each hidden shape and color. Decode Safe One; find five coins for Safe Two. Use both keys at the exit within fifteen minutes. Restart resets the room. The learning panel and ending explain the historical model and cite sources.

`reflection.txt` is a 207-word individual reflection **draft** to personalize before submission. The game is an interpretation of slavery in the United States before 1865 through digital humanities historical modeling; it is not a Joara reconstruction.

## GitHub Pages

Repository: https://github.com/vivienne987/escape

The repository uses **Deploy from a branch → main → / (root)** in
**Settings → Pages**. Pushes to `main` publish the committed `index.html` to
https://vivienne987.github.io/escape/ . A separate Actions workflow runs tests
and builds an artifact; it can also be run manually from the Actions tab.
After source edits, run `pnpm build` and commit the regenerated `index.html`.
The build also generates `dist/index.html` for hosting and preserves the
standalone `vivian_escape_room.html` for offline use.
All game assets are embedded, so the `/escape/` path needs no configuration.

## Local development

- `pnpm install`
- `pnpm test`
- `pnpm build` — regenerates the standalone HTML from `src/`
- `pnpm dev` — serves http://localhost:5173/vivian_escape_room.html

The extracted original is preserved as `vivian_escape_room.original.html`; the original notebook ZIP is unchanged. Three.js is bundled with its MIT license notice. The room geometry is procedural. Four fictional aged oil paintings were created with built-in image generation and embedded in the HTML. Source paintings live in `assets/portraits/`; the original barn prompt is recorded in `art-prompts-a.txt`, and replacement prompts in `art-prompt-reading-v2.txt`, `art-prompt-mill-v2.txt`, and `art-prompt-sewing-v2.txt`. The paintings are game artwork, not historical sources.
