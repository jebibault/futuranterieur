# Craft: making code look hand-drawn and hand-timed

Adapted from Disney's 12 principles (the full LottieFiles motion-design skill is in
`references/motion-design/`) for film animation rather than UI, plus what anime and French
studios actually do. Where the two disagree, this file wins for films.

## Layers of a shot

1. **Painted plate** (background, from codex-imagegen): the hand-painted look lives here.
2. **Cels** (characters, props that move): drawn in code as flat colour areas with one hard-edged
   shadow tone and one highlight at most, outlined with a variable-width ink line. Or generated
   character art cut into parts, if the user accepts held-cel animation.
3. **Effects**: rain, dust in sunbeams, smoke, screen glow, light leaks. Hand-drawn effects in
   anime are also cels: hard edges, flat colours, animated on twos or threes.
4. **Camera**: pans, push-ins, trucks over the plates as a multiplane camera would do: each layer
   moves at its own speed (far slow, near fast). Never smooth-scroll the whole frame as one image.
5. **Film finish**: very light grain (seeded per frame), a hint of vignette, never a blur filter
   over everything.

## The ink line

- Variable width: thicker on the shadow side and at overlaps, tapering at the ends.
- Line boil: draw each outline from 3 slightly jittered versions and switch on threes (`boil()`).
  Subtle: 0.5–1.5 px. Static held drawings in anime do not boil; use it on characters in motion
  or in nervous, subjective moments.
- Never a uniform 2 px stroke on a perfect bezier: that reads as vector art.

## Timing (24 fps)

| Situation | Timing |
|---|---|
| Normal character action | on twos |
| Slow, heavy, old, tired, sad | on threes, with longer holds |
| Fast action, camera pans | on ones |
| Emotional hold | 1.5–4 s with only a blink, breath or light change |
| Blink | close 2 frames, closed 1–2, open 2–3 |
| Head turn | 6–10 frames with an anticipation dip and a slight overshoot on the eyes |
| Walk | 12-frame step (on twos) for a normal walk; 16 for a tired one |

- **Anticipation**: a small move the other way (10–20 % of the action) before every big move.
- **Follow-through and overlap**: hair, scarf, coat tails, cables stop 2–6 frames after the body.
- **Arcs**: hands, heads and eyes move on arcs, never straight lines.
- **Slow in / slow out** into key poses; never linear motion for anything organic.
- **Holds are not frozen**: keep one living element (rain, breath, a flicker) during a hold.
- **Secondary action**: smaller (30–50 %), later (2–3 frames), different rhythm.
- **Personality**: the same character always moves with the same tempo. Write it in the passport.

## Staging

- One action per shot, readable as a silhouette.
- The eye goes to the brightest, most saturated, most detailed area: put the action there.
- Hold the first frame of a new shot a beat before anything moves.
- Cuts: on action, or on a look. A hard cut to silence is a strong tool; use it once.

## Faults that betray code

Perfect circles and symmetry, identical repeated elements (raindrops, trees, windows all alike),
uniform outlines, linear gradients, everything moving at once, smooth 60 fps easing on
characters, parts floating or bobbing, puppet joints rotating around a pin, text with no kerning,
particle systems that look like a screensaver. When in doubt: add hand variation with `hash()`,
put the motion on twos, and hold.
