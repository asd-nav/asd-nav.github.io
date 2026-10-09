# Project Page — Training Generalist Navigation Policies via Action Self-Distillation

Static project page for the CoRL 2026 submission. This is an **orphan branch**: it
contains only the website, with no shared history with `main`.

## Viewing it

The page uses relative paths and no build step, but it must be served over HTTP
rather than opened as a `file://` URL — browsers block video playback and some
asset loads otherwise.

```bash
git clone -b website https://github.com/fengb2-coder/self-distilled-reasoning-planning site
cd site
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Layout

```
index.html              the entire page (single file)
static/css/styles.css   custom styles
static/js/main.js       lazy video loading, steerability selector, charts, typewriter
assets/images/          figures (webp) + video poster frames
assets/video/           encoded clips (h.264, faststart), incl. the explainer video
assets/video/steer/     steerability rollouts, <group>_<target>.mp4 (720x810)
```

Result charts are drawn from the data arrays at the top of the charts block in
`static/js/main.js`; the full tables in `index.html` must be kept in sync by hand.

Fonts (Inter, JetBrains Mono) and two icon stylesheets (Font Awesome,
Academicons) load from CDNs; everything else is vendored.

## Editing

`index.html` is hand-written — edit it directly. If you change
`static/css/styles.css` or `static/js/main.js`, bump the `?v=N` query on its
tag in `index.html` so browsers don't serve a stale cached copy.

## Assets

The clips in `assets/video/` are re-encoded for web delivery (1080px wide for
the comparison grid, 640–720px for the portrait multi-stage clips). The
full-resolution originals are **not** in this branch — they live in
`videos/video_in_paper/` in the working directory, outside version control.

## Still to fill in

- The **Paper**, **arXiv**, and **Code** buttons in the hero are `href="#"`
  placeholders.
- **Keqin Wang** and **Yulong Yang** have no author links; the other five
  authors link to personal or faculty pages.
