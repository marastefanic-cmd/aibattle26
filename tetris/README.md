# PC Builder Tetris

Tetris where every tetromino is a computer part. Stack RAM sticks, CPUs, GPUs and
hard drives inside a dark PC case, clear rows, and watch RAM prices climb the longer
you survive.

Open `tetris/index.html` directly in a browser (no build step, no dependencies), or
visit `/tetris` when the Node server in the repo root is running.

## Files

| File | Purpose |
|------|---------|
| `index.html` | The whole game: HTML, CSS and JavaScript in one file. Uses HTML5 canvas for the board, previews and the parts legend. |
| `sfx.js` | Optional Web Audio sound effects and music (written separately). The game loads it with `<script src="sfx.js">` but every call is guarded, so the game runs fine if the file is missing. |
| `README.md` | This file. |

## How to play

Standard rules: a 10x20 board, the seven tetrominoes with SRS rotation and wall
kicks, a 7-bag randomizer, three-piece next queue, hold slot, ghost piece and a short
lock delay (moves and rotations while grounded reset it, up to 15 times).

| Key | Action |
|-----|--------|
| Left / Right arrows | Move (hold to auto-repeat) |
| Up arrow or X | Rotate clockwise |
| Z | Rotate counter-clockwise |
| Down arrow | Soft drop (+1 point per cell) |
| Space | Hard drop (+2 points per cell) |
| C or Shift | Hold piece (once per piece) |
| P or Esc | Pause / resume |
| R | Restart |
| M | Mute / unmute sound |
| Enter | Start / resume from the overlay |

On phones and tablets (or any narrow window) an on-screen button pad appears under
the board: move, rotate both ways, hold, soft drop, hard drop and pause. Move and
soft-drop buttons repeat while held.

### Scoring

- Line clears: 100 / 300 / 500 / 800 points for 1 / 2 / 3 / 4 lines, multiplied by the current level.
- Soft drop: 1 point per cell. Hard drop: 2 points per cell.
- Level goes up every 10 lines; gravity follows the guideline curve
  `(0.8 - (level - 1) * 0.007) ^ (level - 1)` seconds per row, floored at 40 ms.
- The high score is kept in `localStorage` (`pcBuilderTetrisHighScore`).

Completing lines triggers a particle explosion in the colors of the parts that were
destroyed, plus a flash and a short screen shake. A four-line clear (a "Tetris") gets
a much bigger blast.

## The parts

| Piece | Part | How to spot it |
|-------|------|----------------|
| I | RAM stick | Green PCB, black memory chip, gold edge-connector pins along the bottom |
| O | CPU | Grey heat spreader with a silver die in the middle and a gold pin grid around the edge |
| T | Graphics card | Dark shroud with a red accent stripe and a seven-blade cooling fan |
| S | SSD | Navy enclosure, white label with a green activity LED, two NAND chips and a gold connector |
| Z | Chipset / PCB | Green board with copper traces, vias and a black chipset in the centre |
| J | Power supply | Black steel box, round fan grille with spokes, corner screws and a red power switch |
| L | Hard disk | Brushed aluminium chassis with a spinning platter and a red-tipped actuator arm |

The "Parts bin" panel in the game shows the same legend with a live rendering of each piece.

## Easter egg: the RAM market

A small ticker in the corner (bottom-right on desktop, under the title on phones)
tracks the "price" of a DDR5 32 GB kit. It only goes up. It rises every few seconds,
faster and by larger steps the higher your level, with occasional headlines such as
"AI datacenters buy everything". Every line you clear also shoves the price up
(roughly +6 % per line, +22 % extra for a Tetris). It resets to $89.99 when you
restart. It is purely decorative and never blocks play.

Behind the playfield a low-opacity "stonks" chart plots the price live: green
segments for the time-based creep, red spikes (with a label) for line clears, price
labels on the right axis. It scrolls as it fills and resets with the game.

Every line clear also opens a retro alert dialog over the top of the board (a
Windows-95-style grey box with a blue title bar, or a green-on-black terminal box,
with a blinking cursor and scanlines) that yells at you about RAM prices. There are
28 messages; the tone escalates with the number of lines cleared, some quote the
live price, and a handful break the fourth wall. A four-line clear adds a full-screen
red "MARKET CRASH... UPWARDS" flash. The dialog auto-dismisses after ~2.5 s, can be
closed with its X or OK button, and never takes keyboard focus, so play continues
underneath. Screen shake and the dialog glitch animation are disabled when the OS
asks for reduced motion.

## About the framework at blit386.dev

The task asked to first read <https://blit386.dev/mcp-server> and, if it described a
usable browser framework, build the game with it. That domain is blocked by the
network egress proxy in the build environment (`EGRESS_BLOCKED` on every fetch of
`blit386.dev`, including the root page), so nothing could be learned about what it
provides. The game was therefore built with plain HTML5 canvas and vanilla
JavaScript, with no external dependencies, so it works when opened straight from
disk.

## Debug hooks

`window.PCTetris` exposes `start()`, `state()`, `score()`, `fillRows(n)` (fills the
bottom `n` rows except column 0) and `forcePiece(type)` for quick manual testing in
the browser console.
