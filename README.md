# Project Page — Training Generalist Navigation Policies via Action Self-Distillation

Static project page for the CoRL 2026 paper. This is an **orphan branch**: it
contains only the website, with no shared history with `main`.

## Viewing it

Live at <https://rsd-nav.github.io/>, served by GitHub Pages from the `main`
branch of [`rsd-nav/rsd-nav.github.io`](https://github.com/rsd-nav/rsd-nav.github.io).
`.nojekyll` makes Pages publish the files as-is (no Jekyll build).

To preview locally, serve the folder over HTTP rather than opening it as a
`file://` URL (browsers block video playback and some asset loads otherwise):

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

`python3 -m http.server` does not support HTTP range requests, so the explainer
video cannot be scrubbed locally (and may not play in Safari). This is a
limitation of the local server only; GitHub Pages serves it normally.

## Deploying

Commit on `websitev3`, then push it to the Pages repo's `main`; the site
updates within a minute or two:

```bash
git push pages websitev3:main   # remote "pages" = https://github.com/rsd-nav/rsd-nav.github.io.git
```

## Layout

```
index.html              the entire page (single file)
static/css/styles.css   custom styles
static/js/main.js       nav, lazy/autoplay videos, wall filter, method explainer,
                        steerability crossfade, charts, typewriter, scroll reveal
assets/images/          figures (webp) + video poster frames
assets/video/           encoded clips (h.264, faststart), incl. the explainer video
assets/video/steer/     steerability rollouts, <group>_<target>.mp4
```

Page order: dark hero (title, authors, links; muted background clip) →
Real-World video wall (all indoor / outdoor / multi-stage clips, filterable,
plus rollout composites) → overview (explainer video, TL;DR, headline stats,
highlights) → Method (animated teacher → student → deploy explainer, then the
static figures) → Steerability → Reasoning → Results → BibTeX. A sticky nav
bar appears once the hero is scrolled past. The page follows the system
light/dark setting; the hero, video wall and method sections are always dark.

Result charts are drawn from the data arrays at the top of the charts block in
`static/js/main.js`; the full tables in `index.html` must be kept in sync by hand.

Fonts (Inter, JetBrains Mono) and two icon stylesheets (Font Awesome,
Academicons) load from CDNs; everything else is vendored.

## Editing

`index.html` is hand-written — edit it directly. If you change
`static/css/styles.css` or `static/js/main.js`, bump the `?v=N` query on its
tag in `index.html` so browsers don't serve a stale cached copy.

The steerability prompts shown on the buttons live in the `STEER` table in
`static/js/main.js`. Adding a clip only requires dropping
`assets/video/steer/<group>_<key>.mp4` (plus an optional poster at
`assets/images/posters/steer_<group>_<key>.jpg`) and a matching `STEER` entry.

## Assets

All clips are re-encoded for web delivery; full-resolution originals are **not**
in this branch.

| Clips | Size | Notes |
|---|---|---|
| `ASD_full_3m21s.mp4` | 1920×1080, ~22 MB | explainer video, has audio |
| `indoor_*`, `outdoor_*` | 1080×960 | side-by-side ASD vs. best baseline, labels burned in |
| `multistage_*` | 720×1280, 640×1138 | portrait, prompt and success rate burned in |
| `steer/*` | 720×810 | portrait phone clips, no audio |

The steerability clips were cut from 720×1280 `.MOV` recordings: each is
trimmed to ~0.5 s before the robot starts moving and ~0.6 s after it stops, and
all eight share one crop so the scene lines up when switching prompts:

```bash
ffmpeg -ss <start> -to <end> -i <clip>.MOV -an \
  -vf crop=720:810:0:310 \
  -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -movflags +faststart \
  assets/video/steer/<group>_<key>.mp4
```

The crop removes the ceiling and the floor reflection below the robot's start
position; going lower would cut the robot's wheels in the `direction_*` clips.

## Still to fill in

- The **Paper**, **arXiv**, and **Code** buttons in the hero are `href="#"`
  placeholders.
- **Keqin Wang** and **Yulong Yang** have no author links; the other five
  authors link to personal or faculty pages.
