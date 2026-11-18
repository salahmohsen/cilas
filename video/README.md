# CILAS demo film

The README's demo, composed with [Remotion](https://www.remotion.dev) from screen recordings of the real app.

- `src/film.ts` is the film: the shots in order, with their captions, trims and speeds.
- `src/clips.json` and `public/clips/` come from `scripts/demo/capture.mjs`. The clips are not in Git; record them again to render.
- `npm run dev` opens Remotion Studio. `npm run render` writes `docs/demo/cilas-demo.mp4`. The README GIF comes from `scripts/demo/hero.sh`, not from the film.
