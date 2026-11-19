---
name: anime-studio
description: Run a small animation studio that turns a short story (or any script) into a hand-drawn-looking 2D animated short delivered as a self-contained HTML film AND a frame-exact MP4 with FR/EN subtitles. Direct on paper first (bible, character passports, shot cards, animatic), lock painted plates and character sheets, have Fable 5.2 animate the film, then check it with a fresh reviewer and render it. Use whenever the user wants to adapt a story into an animated short, an anime or French-animation-style scene, an episode, an animatic, a storyboard, or wants an HTML film turned into an MP4, even if they don't say "skill" or "studio".
---

# Anime studio

A model has no memory between attempts, and a model judging its own film is too kind to it.
So the studio folder is the memory, and a fresh reviewer is the judge.
**Direct on paper, lock the look, animate once, check with fresh eyes, render once.**

Everything here is free to run: Claude Code, Fable 5.2 as a subagent, the user's own ChatGPT
account for stills (codex-imagegen skill), Playwright and ffmpeg. Never use a paid generation
service without the user's explicit yes.

## The studio folder

```
<studio>/                       e.g. ~/Documents/Studio Futur antérieur
  studio.md                     series rules: format, languages, credits, laws below
  log.md                        every generation and review: step, tool/model, input, output, verdict
  episodes/<epNN-slug>/
    bible.md                    story, tone, STYLE, palette, never-list   (locked before plates)
    cast/<tag>.md + <tag>/      one passport per character or key object, with reference images
    shots.md                    shot cards                                (locked before animatic)
    animatic/animatic.html      cheap timing pass, zero image generation
    plates/                     approved painted backgrounds and key stills, never overwritten
    film/film.src.html          the film source (images as "asset:..." strings)
    film/film.html              the built single-file film (FILM contract), from embed.mjs
    review/                     contact sheets, reviewer reports, 16-frame check
    renders/film.mp4            final MP4
    subs/fr.vtt, en.vtt         subtitles for the web player
```

Create it with `scripts/new-episode.sh "<studio>" <epNN-slug>`.

**Two laws** (also written at the top of `studio.md`):
1. An approved reference (passport image, plate) is never regenerated, renamed or overwritten.
   A change is a new file with a new version number.
2. Every generation and every review gets one line in `log.md`. An unlogged good result
   cannot be made again.

## Workflow and gates

Work through the steps in order. **Gate** means: show the user and wait for a yes before going on
(if they said "go ahead without me", note your choice in `log.md` and continue).

1. **Bible** (`templates/bible.md`). From the source text: logline, what the viewer must feel,
   the ending image, style (with named references and what to borrow from each), palette with hex
   codes, light, sound, on-screen text (French, with English subtitles), never-list.
   Choose the style deliberately; see `references/styles.md`. **Gate.**
2. **Passports** (`templates/passport.md`), one per character and per key object (the headset,
   the bag...). Exhaustive descriptor with hex colours, signature item, a "tell" gesture, and one
   fixed imperfection that makes drift easy to spot. A variant (soaked, older, hurt) is a separate
   passport. The descriptor is pasted verbatim into every prompt that shows the character.
3. **Shot cards** (`templates/shots.md`). One action per shot, duration in seconds, shot size,
   angle, camera move, sound, emotional beat, on-screen text. Rules: hook in the first 3 s; long
   holds are allowed and often best; the last shot holds its final pose. **Gate.**
4. **Animatic** (no image generation). Build `animatic/animatic.html` from the film skeleton:
   simple shapes in the bible palette, the shot's one action, a timeline, the shot id and
   subtitle on screen; render it to MP4 with `film.mjs render` so the user can judge pacing on
   their phone. **Gate.**
5. **Plates and character sheets** with the codex-imagegen skill (one image per run, approval
   between images). See `references/plates.md`: what to generate (backgrounds, key stills,
   character sheets), how to keep the style consistent (pass approved images back with `--image`),
   and how to prepare them for the film (JPEG, 1920 px, referenced as "asset:" and inlined by embed.mjs). Review each plate against the
   bible and passports before showing it, then have the `anime-reviewer` judge the whole set as a
   grid (`grid.sh`) BEFORE any animation: continuity breaks (the same square drawn twice
   differently, the wrong season in a window, a prop that changes) are cheap to fix as stills and
   expensive after animation. **Gate** on the set.
6. **Animate.** Spawn one Fable 5.2 subagent (`Agent` tool, `model: "fable"`) with the brief from
   `templates/brief-animator.md`, filled in with the episode paths. It builds `film/film.html` from
   `templates/film-skeleton.html`, follows the FILM contract (`references/html-film-contract.md`)
   and the craft rules (`references/craft.md`), and must pass `film.mjs check`.
   For a long film, split the work: one subagent per sequence, each writing its own shot functions
   in a separate file that you merge, all sharing the same passports and helpers.
7. **Review with fresh eyes.** Make a contact sheet (`film.mjs contact --n 18`, plus `--random 1`
   on later passes) and stills of every shot's key moment (`film.mjs stills --at ...`). Spawn the
   `anime-reviewer` agent (`~/.claude/agents/anime-reviewer.md`), which has seen none of the work,
   with the bible, passports, shot cards and the images. It returns PASS/FAIL per shot with exact
   fixes. Send the FAIL list back to the animator (same subagent through SendMessage if it still
   exists). At most 3 rounds; then simplify the shot instead of retrying. Log every round.
8. **Render.** `film.mjs subs` then `film.mjs render --fps 24 --subs fr=...,en=...`. Then the
   16-frame check: `scripts/framecheck.sh renders/film.mp4 review/framecheck 16`, look at the grid
   yourself and have the reviewer look at it too. Fix and re-render only the failing shots
   (`--from/--to` to preview a range).
9. **Deliver**: the MP4, the VTT files, and the HTML film (as an optional "interactive version").
   Film grain makes MP4s big: `render` caps the bitrate (6 Mb/s, ~75 MB for 100 s). SendUserFile
   only reaches the phone under 30 MB, so also make a 720p copy:
   `ffmpeg -i film.mp4 -map 0 -vf scale=1280:-2 -c:v libx264 -b:v 1900k -maxrate 2300k -bufsize 4M -c:a aac -b:a 128k -c:s copy -movflags +faststart film-phone.mp4`
   Send the phone copy with SendUserFile. Never publish anywhere without the user's yes.

## Motion design reference

`references/motion-design/` is the LottieFiles motion-design skill (MIT, vendored): Disney's 12
principles, emotion-to-motion mapping, choreography, narrative structure, timing and easing tables.
It is written for UI; read `director/disney-principles.md`, `director/emotion-mapping.md` and
`director/narrative-structure.md` for the principles, and use `references/craft.md` for the
film-specific numbers (24 fps, twos and threes, holds), which take precedence.

## Scripts

All in `scripts/` (Playwright is installed there; run with `node`):

| Command | What it does |
|---|---|
| `new-episode.sh <studio> <slug>` | creates the studio and episode folders from templates |
| `node embed.mjs film.src.html film.html` | inlines every "asset:path" as a data URI: the self-contained film |
| `node film.mjs check film.html` | verifies the FILM contract and that seek(t) is deterministic, reports page errors |
| `node film.mjs stills film.html --at 3.5,12 --out dir` | exact PNG stills at given times |
| `node film.mjs contact film.html --n 18 [--random 1] --out x.png` | contact sheet |
| `node film.mjs subs film.html --out subs` | writes one .vtt per language from FILM.subtitles |
| `node film.mjs render film.html --out x.mp4 [--fps 24] [--from a --to b] [--subs fr=..,en=..]` | frame-exact MP4 with the film's own audio and soft subtitle tracks |
| `gen-image.sh <dir> <name> [version]` | runs codex-imagegen on `<dir>/<name>-prompt.txt` with the style key and the cast sheets listed in `plates/_refs.json`; several can run in parallel (6 at once works) |
| `grid.sh out.jpg a.png b.png ...` | side-by-side review grid of plates or stills |
| `framecheck.sh film.mp4 outdir [16]` | 16 evenly spaced frames + grid from the final MP4 |

Each prints one JSON line. Render time is roughly 1 s per second of film at 1080p.

## What each tool is for (and not for)

- **Fable 5.2**: the animator and the long-context planner. Give it files, not memories.
- **codex-imagegen**: painted plates, key stills, character sheets. This is where the
  hand-painted look comes from; code-drawn gouache never quite gets there.
- **Canvas 2D in the film**: characters as cels (flat colour, hard shadow, boiling line),
  effects (rain, dust, light, glow), camera moves over plates, transitions, abstract sequences.
- **3D (Three.js)** only for layout or camera reference, never visible in the final frame.
- Motion libraries (GSAP and similar) are optional; the skeleton's `key()`/`stepT()` helpers give
  pose-to-pose timing on twos with no dependency. If used, the timeline must be paused and driven
  by `FILM.seek(t)` only.

## Pitfalls

- A film that is not a pure function of time renders differently from how it plays. `check` catches it.
- Text on screen must be typed in the film (canvas or DOM), never inside a generated image:
  generated text is misspelled.
- Generated plates drift in style from one run to the next. Lock one approved plate as the style
  key and pass it with `--image` to every later plate.
- Characters described "from memory" change between shots: paste the passport descriptor verbatim.
- A self-review always passes. Only the fresh reviewer's verdict counts.
- Keep the user's machine usable: render in the background for long films, one browser at a time.
