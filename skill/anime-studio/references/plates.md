# Plates and character sheets (codex-imagegen)

Load the `codex-imagegen` skill and follow it: one image per run, prompt in a .txt file, log to
`plates/SOURCES.md`, look at every image yourself before showing it.

## What to generate, in this order

1. **Style key**: the single most important background of the film. Iterate until it is right.
   It becomes the reference (`--image`) for every later plate.
2. **Character sheets**, one per passport: full body, front + three-quarter + profile, neutral
   background, flat even light, in the film's style. Pass the style key too.
3. **The other backgrounds**, each with the style key as `--image`.
4. **Key stills** only for held shots where the character barely moves (a held image with living
   effects on top is a real anime technique). Pass the character sheet and style key.

5. **Same place, same drawing**: every plate of a location already drawn gets that earlier
   plate as an extra `--image` ("the SAME square as in the attached image"), and every recurring
   prop (a van, a kiosk, a box) gets the plate where it was first approved. Check the season, the
   time of day and the light against the shot's date in the bible.
6. **Pose pairs** for actions that matter and cannot be drawn convincingly in code over a plate
   (a hand closing, someone putting on a headset): generate the "after" key with the "before" plate
   as `--image` and "same framing, same light", then the animator cuts on action with 2–3
   transition drawings. Cheaper and better-looking than a code-drawn limb.

## Prompt rules

- Start with the style sentence from the bible, word for word, in every prompt.
- Paste the passport descriptor verbatim for every character in frame.
- "wide 16:9", the time of day and the light source, the camera height and lens.
- Backgrounds: "empty of people" unless the shot needs them; leave room where cels will go.
- Always: "no text, no letters, no logos, no watermark, no signature".
- Humans: "an original person, not anyone real".

## Preparing a plate for the film

```
ffmpeg -i plates/office-v2.png -vf scale=1920:-2:flags=lanczos -q:v 3 plates/office-v2.jpg   (this ffmpeg has no webp encoder)
```
Reference it in the film source as "asset:../plates/office-v2.jpg"; scripts/embed.mjs inlines it as a data URI when building film.html (keep the film under ~25 MB). For camera moves,
generate the plate wider than the frame (or ask for "extra margin on the left and right") so the
pan never reaches an edge. Cut foreground elements into their own layer only if the shot needs
parallax.

## Checking a plate (before showing the user)

Matches the bible's style and palette? Light direction consistent with the neighbouring shots?
No text or fake letters? No extra people? Hands and faces correct? Room for the action?
Anything that would fight the animation (busy detail where the character stands)?
