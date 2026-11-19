# The FILM contract

Start every film from `templates/film-skeleton.html`. It already implements this contract.

## Rules

1. **One file.** All images (webp/jpeg as data URIs), fonts and code inside the HTML. No network
   at play time, except an exact-version CDN script if truly needed (prefer none).
2. **Canvas 1920×1080, 16:9, letterboxed.** Draw in 1920×1080 coordinates always.
3. **Every frame is a pure function of time.** `draw(t)` may read only `t`, constants and loaded
   assets. Forbidden inside drawing: `Math.random()` (use `hash()`/`rng(seed)`), `Date`,
   `performance.now()`, state accumulated between frames (particles must be computed from t, not
   stepped), CSS animations or transitions on visible elements, video elements.
4. **`window.FILM`** exposes:
   - `duration` (seconds), `fps` (24), `width`, `height`
   - `ready`: a Promise resolved when every asset and font is loaded
   - `seek(t)`: draws the exact frame for time t (may be async)
   - `audio(from, to)`: resolves to a WAV ArrayBuffer of the soundtrack for that range
   - `subtitles`: `{ fr: [[start, end, text], ...], en: [...] }`
5. **`?render=1`** in the URL: no UI, no autoplay, no subtitles overlay (subtitles are exported as
   VTT tracks instead, so the web player can switch language).
6. **Live playback** uses the audio clock as the master clock and calls the same `draw(t)`.
   Click to start, language choice (FR / EN / off), replay at the end.
7. **Sound** is built by one function `buildAudio(ctx, from, to)` used both by an
   `OfflineAudioContext` (render) and for live playback (the rendered buffer is played), so
   picture and sound can never drift. Everything is scheduled relative to `from`.
8. **Text on screen** (title cards, letters, labels, subtitles) is typed in code with a real font,
   in correct French with accents, never baked into generated images.

## Timing helpers in the skeleton

- `stepT(t, 2)`: quantise time to twos (each drawing held 2 frames at 24 fps); use 3 for slow,
  heavy or tired movement, 1 only for fast camera moves or effects that must be smooth.
- `key(t, [[t0, v0], [t1, v1], ...], ease)`: pose-to-pose interpolation with holds.
- `boil(t, 3)`: which of three slightly different line drawings to show (line boil on threes).
- `hash(a, b)`: stable pseudo-random value for an element and frame.

## Checking

`node scripts/film.mjs check film.html` must return `"deterministic": true` and no errors before
any review or render.
