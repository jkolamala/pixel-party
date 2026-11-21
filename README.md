# Pixel Party

A small, buildless arcade made with plain HTML, CSS, and JavaScript.

## Play locally

Open `index.html` in a browser. No install or build step is needed.

## Publish with GitHub Pages

In the repository settings, enable GitHub Pages and choose the branch and repository root (`/`) as the source. GitHub Pages will serve `index.html` directly.

## Games

- **Blackjack:** deal a hand, then hit or stand. Each hand costs 100 free-play chips.
- **2048:** use the arrow keys or swipe to combine matching tiles.
- **Snow Rider 3D:** an original local 3D sled game. Arrow keys or A/D steer; Space or Up jumps; P pauses. Touch controls are included. Choose a Classic sleigh, Toboggan, or Alpine racer. Crashes splinter the sleigh, and speed increases gradually with distance. The renderer, models, course generation, and physics are plain JavaScript with no external game assets or libraries.

2048 and Snow Rider 3D save records in browser storage. Snow Rider also saves collected gifts. Its game files run locally and on GitHub Pages without a build step.

## Coins and shop

The shared wallet, milestone progress, owned upgrades, and equipped cosmetics are saved in `pixelPartyShopV1` in localStorage. Coins are separate from Blackjack betting chips. Browser/device storage is local, with no accounts or server.

Each milestone pays 10 coins: 2 Blackjack win-equivalents (win 1, push 0.5, loss 0.25; average the two hands in two-player mode), 512 new merged points in 2048, or 750 Snow Rider metres (gifts add 25 metres each). Snow settles at the end of a ride. Fractional progress carries over, and resets/restarts do not replay rewards. These are initial comparable-effort targets, not empirically proven equal difficulty.

Shop purchases are permanent cosmetics: two arcade themes (60 coins each), Royal Blackjack card backs, Ocean 2048 tiles, and an Aurora sleigh finish (40 coins each). Purchases auto-equip; owned items can be toggled without paying again.

## Fonts and interface

Press Start 2P, Silkscreen, and Space Grotesk are bundled in `assets/fonts` with their SIL Open Font Licenses. Fonts load locally without a font service. Card suits and shop illustrations use SVG rather than emoji. Detailed coin rules are available in the shop's expandable reward section.
