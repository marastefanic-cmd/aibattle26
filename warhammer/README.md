# Waaagh Codex

A phone-first Warhammer 40,000 (11th edition) army companion. Pick an army, then
Units, Stratagems, Ranged/Melee weapons by unit, Abilities, Army rules, or the
Battle tracker.

| File | What it is |
|---|---|
| `data.js` | every army, plus the faction/core rules they use. **Edit this to add a list.** |
| `app.html` | the app (published as the Claude artifact as-is) |
| `index.html` | generated: `app.html` wrapped as a full page for GitHub Pages |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | home-screen install + offline support |
| `version.json` | generated: installed copies compare it to reload themselves |

## Adding an army

1. Add the army to `ARMIES` in `data.js` (units transcribed from the New Recruit PDF), and any
   new faction, detachment, or rule text to `FACTIONS` / `RULES`.
2. Bump `VERSION` in `data.js`.
3. `node warhammer/build.js` (regenerates `index.html`, `version.json`, and the worker version).
4. Commit and push; republish the artifact from `warhammer/app.html` with `data.js` alongside.

## Home-screen install

GitHub Pages serves this folder at `https://marastefanic-cmd.github.io/aibattle26/warhammer/`
once Pages is enabled for the repo (Settings → Pages → Deploy from a branch). Open that URL
in Safari → Share → Add to Home Screen. The installed app fetches the newest version every
time it opens (network-first service worker, plus a `version.json` check when it comes back
to the foreground), so it never needs reinstalling.

Stratagem text is a summary, not the rulebook wording. Unit datasheets are transcribed from
the New Recruit export; detachment rules and enhancements come from the BSData wh40k-11e files.
