(function () {
    'use strict';

    // Lets CSS tell "JS is running" apart from the no-JS fallback layout.
    document.documentElement.classList.add('js');

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saveData = !!(navigator.connection && navigator.connection.saveData);
    const SVG_NS = 'http://www.w3.org/2000/svg';

    /* ------------------------------------------------------------------
     * Hero background clip: muted ambient loop behind the title. Skipped
     * under reduced motion or Save-Data (the poster stays), and paused
     * while the hero is off-screen.
     * ------------------------------------------------------------------ */
    (function heroBackground() {
        const hero = document.getElementById('hero');
        const v = hero && hero.querySelector('video[data-bg-src]');
        if (!v || reduceMotion || saveData) return;

        v.src = v.dataset.bgSrc;
        v.preload = 'auto';
        const play = () => v.play().catch(() => {});
        play();

        new IntersectionObserver(([e]) => {
            if (e.isIntersecting) play(); else v.pause();
        }).observe(hero);
    })();

    /* ------------------------------------------------------------------
     * Sticky nav: slides in after the hero, highlights the section in view.
     * ------------------------------------------------------------------ */
    (function topNav() {
        const nav = document.getElementById('topnav');
        const hero = document.getElementById('hero');
        if (!nav || !hero) return;
        const list = nav.querySelector('.topnav-links');
        const links = Array.from(list.querySelectorAll('a[href^="#"]'));
        const sections = links.map(a => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
        let current = null;

        function setActive(id) {
            if (id === current) return;
            current = id;
            links.forEach(a => {
                const on = a.getAttribute('href') === '#' + id;
                if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
                // On narrow screens the link row scrolls sideways: keep the active one centred.
                if (on && list.scrollWidth > list.clientWidth) {
                    const left = a.offsetLeft - list.offsetLeft - (list.clientWidth - a.offsetWidth) / 2;
                    list.scrollTo({ left: left, behavior: reduceMotion ? 'auto' : 'smooth' });
                }
            });
        }

        // A thin band ~40% down the viewport decides which section is "current".
        const visible = new Set();
        const io = new IntersectionObserver(entries => {
            entries.forEach(e => { if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target); });
            const hit = sections.filter(s => visible.has(s)).pop();
            if (hit) setActive(hit.id);
        }, { rootMargin: '-40% 0px -55% 0px' });
        sections.forEach(s => io.observe(s));

        // Visibility (and the last section at the very bottom) from scroll position.
        let ticking = false;
        function onScroll() {
            ticking = false;
            const y = window.scrollY;
            nav.classList.toggle('is-visible', y > hero.offsetHeight - 160);
            if (y < hero.offsetHeight * 0.5) setActive(null);
            if (window.innerHeight + y >= document.documentElement.scrollHeight - 2 && sections.length) {
                setActive(sections[sections.length - 1].id);
            }
        }
        window.addEventListener('scroll', () => {
            if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
        }, { passive: true });
        onScroll();
    })();

    /* ------------------------------------------------------------------
     * Videos: load only when near the viewport; autoplay muted and loop
     * (each clip plays through), pause off-screen and resume when back.
     * The wall autoplays even under reduced motion (a deliberate choice);
     * click or Space/Enter still pauses any clip.
     * ------------------------------------------------------------------ */
    (function lazyVideos() {
        const videos = Array.from(document.querySelectorAll('video[data-src]'));

        const io = new IntersectionObserver(entries => {
            for (const { target: v, isIntersecting } of entries) {
                if (isIntersecting) {
                    if (!v.src) { v.src = v.dataset.src; v.preload = 'auto'; }
                    v.play().catch(() => {});
                } else if (!v.paused) {
                    v.pause();
                }
            }
        }, { rootMargin: '200px 0px' });

        videos.forEach(v => {
            io.observe(v);
            // No visible controls on the looping clips, so a click (or Space/Enter) toggles playback.
            const toggle = () => { if (v.paused) v.play().catch(() => {}); else v.pause(); };
            v.addEventListener('click', toggle);
            v.tabIndex = 0;
            v.addEventListener('keydown', e => {
                if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); }
            });
            // Show a play glyph while paused (off-screen pauses are invisible anyway).
            const box = v.closest('.video-item');
            if (box) {
                v.addEventListener('pause', () => box.classList.add('is-paused'));
                v.addEventListener('play', () => box.classList.remove('is-paused'));
            }
        });
    })();

    /* ------------------------------------------------------------------
     * Video wall filter: All / Indoor / Outdoor / Multi-Stage dims the
     * other clips (they keep playing). Old #indoor/#outdoor/#multistage
     * deep links pick the matching filter.
     * ------------------------------------------------------------------ */
    (function wallFilter() {
        const wall = document.getElementById('wall');
        const bar = document.querySelector('.wall-filter');
        if (!wall || !bar) return;
        const btns = Array.from(bar.querySelectorAll('[data-filter]'));

        function set(f) {
            wall.dataset.filter = f;
            btns.forEach(b => {
                const on = b.dataset.filter === f;
                b.classList.toggle('is-active', on);
                b.setAttribute('aria-pressed', on);
            });
        }

        btns.forEach(b => b.addEventListener('click', () => set(b.dataset.filter)));
        const fromHash = () => {
            const k = location.hash.slice(1);
            if (btns.some(b => b.dataset.filter === k)) set(k);
        };
        bar.hidden = false;
        fromHash();
        window.addEventListener('hashchange', fromHash);
    })();

    /* ------------------------------------------------------------------
     * Method explainer: steps 1 (teacher) -> 2 (student) -> 3 (deploy).
     * CSS keys everything off .is-animated, data-stage and the cards'
     * .is-active / .is-done classes; without JS or under reduced motion
     * the explainer simply stays in its fully drawn static state.
     * ------------------------------------------------------------------ */
    (function methodExplainer() {
        const mx = document.getElementById('mx');
        if (!mx || reduceMotion) return;
        const cards = Array.from(mx.querySelectorAll('.mx-card'));
        const steps = Array.from(mx.querySelectorAll('.mx-step'));
        const replay = mx.querySelector('.mx-replay');
        const motion = document.getElementById('mx-robot-motion');
        const DUR = { 1: 4600, 2: 5400, 3: 4200 };   // ms per step while auto-playing
        let timer = null;

        function setStage(n) {
            mx.dataset.stage = n;
            cards.forEach((c, i) => {
                c.classList.toggle('is-active', i + 1 === n);
                c.classList.toggle('is-done', i + 1 < n);
            });
            steps.forEach(b => b.setAttribute('aria-pressed', Number(b.dataset.step) === n));
            // SMIL: drive the robot along the deploy path.
            if (n === 3 && motion && motion.beginElement) {
                try { motion.beginElement(); } catch (e) { /* SMIL unsupported: robot just stays hidden */ }
            }
        }

        // Reset to blank first so CSS animations restart even on the same step.
        function restartAt(n) {
            setStage(0);
            void mx.offsetWidth;
            setStage(n);
        }

        function autoplay() {
            clearTimeout(timer);
            mx.classList.add('is-auto');
            let n = 1;
            (function go() {
                mx.style.setProperty('--dur', DUR[n] + 'ms');
                restartAt(n);
                timer = setTimeout(() => {
                    if (n < 3) { n++; go(); } else { mx.classList.remove('is-auto'); }
                }, DUR[n]);
            })();
        }

        steps.forEach(b => b.addEventListener('click', () => {
            clearTimeout(timer);
            mx.classList.remove('is-auto');
            restartAt(Number(b.dataset.step));
        }));
        replay.addEventListener('click', autoplay);

        mx.classList.add('is-animated');
        mx.querySelector('.mx-controls').hidden = false;
        setStage(0);

        // Start the first time the explainer is well into view.
        const io = new IntersectionObserver(entries => {
            if (entries.some(e => e.isIntersecting)) { autoplay(); io.disconnect(); }
        }, { threshold: 0.35 });
        io.observe(mx.querySelector('.mx-stages'));
    })();

    /* ------------------------------------------------------------------
     * Steerability: same scene, swap the rollout by prompt.
     * Clips live at assets/video/steer/<group>_<key>.mp4. A missing clip
     * shows a placeholder, so new files only need to be dropped in.
     * Two stacked <video>s crossfade: the next clip loads into the hidden
     * one and fades in once it has data. Like the wall, it autoplays and
     * loops even under reduced motion (a deliberate choice).
     * ------------------------------------------------------------------ */
    const STEER = {
        object: [
            { key: 'trash_bin', prompt: 'Navigate to the trash bin' },
            { key: 'monitor',   prompt: 'Navigate to the monitor' },
            { key: 'chair',     prompt: 'Navigate to the chair' },
        ],
        direction: [
            { key: 'left',   prompt: 'Navigate to the chair on the left' },
            { key: 'middle', prompt: 'Navigate to the chair in the middle' },
            { key: 'right',  prompt: 'Navigate to the chair on the right' },
        ],
        color: [
            { key: 'black', prompt: 'Navigate to the black chair' },
            { key: 'blue',  prompt: 'Navigate to the blue chair' },
        ],
    };

    (function steerability() {
        const root = document.getElementById('steer');
        if (!root) return;
        const tabs = Array.from(root.querySelectorAll('.steer-tab'));
        const promptBox = document.getElementById('steer-prompts');
        const screen = document.getElementById('steer-screen');
        const vids = Array.from(screen.querySelectorAll('.steer-vid'));
        const cap = document.getElementById('steer-cap');
        const bar = document.getElementById('steer-bar');
        const ph = document.getElementById('steer-placeholder');
        const phTitle = document.getElementById('steer-ph-title');
        const phBody = document.getElementById('steer-ph-body');
        let front = vids[0];
        let token = 0;
        let inView = false;

        function showPlaceholder(item, src) {
            screen.hidden = true;
            ph.hidden = false;
            phTitle.textContent = 'Steerability rollout: “' + item.prompt + '”';
            phBody.innerHTML =
                'Expected at <code>' + src + '</code> (same scene and start position; portrait or landscape, H.264, &le; 3 MB).<br>' +
                'Refresh once the file is in place; no code change needed. To change the prompt text, edit <code>STEER</code> in <code>static/js/main.js</code>.';
        }

        // Make `v` the visible clip; the other one fades out and is paused.
        function bringToFront(v) {
            if (v === front) return;
            const old = front;
            front = v;
            v.classList.add('is-on');
            old.classList.remove('is-on');
            v.removeAttribute('aria-hidden');
            v.tabIndex = 0;
            v.setAttribute('aria-label', 'Steerability rollout for the selected prompt');
            old.setAttribute('aria-hidden', 'true');
            old.tabIndex = -1;
            old.removeAttribute('aria-label');
            setTimeout(() => { if (old !== front) old.pause(); }, 550);
        }

        function select(group, item, button) {
            promptBox.querySelectorAll('.steer-prompt').forEach(b => {
                b.classList.toggle('is-active', b === button);
                b.setAttribute('aria-pressed', b === button);
            });
            const src = 'assets/video/steer/' + group + '_' + item.key + '.mp4';
            const mine = ++token;
            // First clip goes straight into the visible element; later ones into the hidden one.
            const v = front.currentSrc || front.src ? vids.find(x => x !== front) : front;

            v.onloadeddata = () => {
                if (mine !== token) return;
                ph.hidden = true;
                screen.hidden = false;
                cap.textContent = item.prompt;
                v.currentTime = 0;
                bringToFront(v);
                if (inView) v.play().catch(() => {});
            };
            v.onerror = () => { if (mine === token) showPlaceholder(item, src); };
            v.poster = 'assets/images/posters/steer_' + group + '_' + item.key + '.jpg';
            v.src = src;
        }

        // Playback progress bar for the visible clip (snaps back on loop).
        let last = 0;
        vids.forEach(v => v.addEventListener('timeupdate', () => {
            if (v !== front || !v.duration) return;
            const p = v.currentTime / v.duration;
            bar.style.transition = p < last ? 'none' : '';
            bar.style.width = (p * 100).toFixed(1) + '%';
            last = p;
        }));

        // Only play while the stage is on screen.
        new IntersectionObserver(([e]) => {
            inView = e.isIntersecting;
            if (inView) front.play().catch(() => {}); else front.pause();
        }, { threshold: 0.2 }).observe(root);

        function showGroup(group) {
            tabs.forEach(t => {
                const on = t.dataset.group === group;
                t.classList.toggle('is-active', on);
                t.setAttribute('aria-selected', on);
            });
            promptBox.innerHTML = '';
            STEER[group].forEach((item, i) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'steer-prompt';
                b.textContent = item.prompt;
                b.addEventListener('click', () => select(group, item, b));
                promptBox.appendChild(b);
                if (i === 0) select(group, item, b);
            });
        }

        tabs.forEach(t => t.addEventListener('click', () => showGroup(t.dataset.group)));
        showGroup('object');
    })();

    /* ------------------------------------------------------------------
     * Reasoning traces: type out once they scroll into view. The full text
     * is in the HTML, so without JS (or with reduced motion) it just shows.
     * ------------------------------------------------------------------ */
    (function typewriter() {
        const traces = Array.from(document.querySelectorAll('[data-typewriter]'));
        if (!traces.length || reduceMotion) return;

        const CHARS_PER_FRAME = 2;      // ~120 chars/s for the reasoning text
        const TRAJ_CHARS_PER_FRAME = 8; // numbers fly by faster
        const PARAGRAPH_PAUSE = 250;    // ms between fields

        function prepare(el) {
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            const nodes = [];
            while (walker.nextNode()) {
                const n = walker.currentNode;
                if (!n.textContent.trim() && n.parentNode === el) continue;
                nodes.push({ node: n, text: n.textContent });
            }
            nodes.forEach(n => { n.node.textContent = ''; });
            return nodes;
        }

        function play(el) {
            if (el._typing) return;
            el._typing = true;
            el.style.minHeight = el.offsetHeight + 'px';
            const nodes = el._nodes || (el._nodes = prepare(el));
            nodes.forEach(n => { n.node.textContent = ''; });
            const caret = document.createElement('span');
            caret.className = 'caret';
            let i = 0, pos = 0, lastPara = null;

            function step() {
                if (i >= nodes.length) {
                    caret.remove();
                    el.style.minHeight = '';
                    el._typing = false;
                    return;
                }
                const n = nodes[i];
                const para = n.node.parentNode.closest('p');
                if (para !== lastPara && pos === 0 && lastPara) {
                    lastPara = para;
                    setTimeout(() => requestAnimationFrame(step), PARAGRAPH_PAUSE);
                    return;
                }
                lastPara = para;
                const rate = para && para.classList.contains('traj') ? TRAJ_CHARS_PER_FRAME : CHARS_PER_FRAME;
                pos = Math.min(n.text.length, pos + rate);
                n.node.textContent = n.text.slice(0, pos);
                n.node.parentNode.insertBefore(caret, n.node.nextSibling);
                if (pos >= n.text.length) { i++; pos = 0; }
                requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        }

        const io = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (e.isIntersecting) { play(e.target); io.unobserve(e.target); }
            });
        }, { threshold: 0.35 });

        traces.forEach(el => {
            io.observe(el);
            el.title = 'Click to replay';
            el.style.cursor = 'pointer';
            el.addEventListener('click', () => play(el));
        });
    })();

    /* ------------------------------------------------------------------
     * Charts (inline SVG, no dependencies). Colors are CSS custom
     * properties (see :root in styles.css) so they follow dark mode.
     * ------------------------------------------------------------------ */
    const SERIES = [
        { key: 'omni',   name: 'OmniVLA',              color: 'var(--s-omni)' },
        { key: 'navila', name: 'NaVILA',               color: 'var(--s-navila)' },
        { key: 'asd',    name: 'ASD (Qwen2.5-VL-3B)', color: 'var(--s-asd)' },
        { key: 'asd35',  name: 'ASD (Qwen3.5-VL-9B)', color: 'var(--s-asd35)' },
    ];

    const SUMMARY = [
        { label: 'Indoor (9 tasks)',     omni: 0.54, navila: 0.27, asd: 0.84, asd35: 0.94 },
        { label: 'Multi-stage (2 tasks)', omni: 0.35, navila: 0.40, asd: 0.70, asd35: 0.85 },
        { label: 'Outdoor (4 tasks)',    omni: 0.90, navila: 0.33, asd: 0.95, asd35: 0.98 },
    ];

    const ABLATION = [
        { label: 'ASD (Qwen3.5-VL-9B)', value: 0.92, color: 'var(--s-asd35)' },
        { label: 'ASD (Qwen2.5-VL-3B)', value: 0.80, color: 'var(--s-asd)' },
        { section: 'Remove the reasoning' },
        { label: 'Goal-only supervision',      value: 0.26 },
        { label: 'Reasoning off at inference', value: 0.14 },
        { section: 'Replace self-distillation with offline labels + SFT' },
        { label: 'Claude Opus 5 labels + SFT',         value: 0.36 },
        { label: 'Qwen2.5-VL labels + SFT',            value: 0.22 },
        { label: 'NaVILA, SFT on the same data',       value: 0.16 },
    ];

    const pct = v => Math.round(v * 100) + '%';

    function el(tag, attrs, parent, text) {
        const n = document.createElementNS(SVG_NS, tag);
        for (const k in attrs) n.setAttribute(k, attrs[k]);
        if (text != null) n.textContent = text;
        if (parent) parent.appendChild(n);
        return n;
    }

    // Inline style for a bar: fill from a CSS variable + its grow-in delay.
    const barStyle = (color, delayMs) => 'fill:' + color + ';transition-delay:' + delayMs + 'ms';

    // One shared tooltip, positioned in viewport coordinates.
    const tip = document.createElement('div');
    tip.className = 'chart-tip';
    tip.style.position = 'fixed';
    document.body.appendChild(tip);

    function attachTip(node, html) {
        node.addEventListener('mouseenter', () => { tip.innerHTML = html; tip.classList.add('is-on'); });
        node.addEventListener('mousemove', e => { tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px'; });
        node.addEventListener('mouseleave', () => tip.classList.remove('is-on'));
    }

    function legend() {
        const box = document.getElementById('legend');
        if (!box) return;
        box.innerHTML = SERIES.map(s =>
            '<span class="legend-item"><span class="legend-swatch" style="background:' + s.color + '"></span>' + s.name + '</span>'
        ).join('');
    }

    // Grouped vertical bars. `opts.values` prints the value above each bar;
    // `opts.groups` draws a band label above runs of categories sharing `group`.
    function groupedBars(container, data, opts) {
        if (!container) return;
        const W = opts.width, H = opts.height;
        const m = { top: opts.groups ? 44 : 24, right: 8, bottom: 36, left: 44 };
        const iw = W - m.left - m.right, ih = H - m.top - m.bottom;
        const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': opts.label });

        for (let t = 0; t <= 4; t++) {
            const y = m.top + ih - (ih * t) / 4;
            el('line', { x1: m.left, x2: W - m.right, y1: y, y2: y, class: t === 0 ? 'base-line' : 'grid-line' }, svg);
            el('text', { x: m.left - 8, y: y + 4, 'text-anchor': 'end', class: 'axis-label' }, svg, (t * 25) + '%');
        }

        const band = iw / data.length;
        const inner = band * opts.fill;
        const bw = inner / SERIES.length;

        data.forEach((d, i) => {
            const x0 = m.left + band * i + (band - inner) / 2;
            SERIES.forEach((s, j) => {
                const v = d[s.key];
                const h = Math.max(ih * v, v === 0 ? 0 : 1);
                const x = x0 + bw * j + 1;
                const y = m.top + ih - h;
                const r = el('rect', { x: x, y: y, width: bw - 2, height: h, class: 'bar bar-v', style: barStyle(s.color, i * 120 + j * 60) }, svg);
                attachTip(r, '<b>' + s.name + '</b><br>' + d.label + ': ' + pct(v));
                if (v === 0) {
                    el('text', { x: x + (bw - 2) / 2, y: m.top + ih - 4, 'text-anchor': 'middle', class: 'val-label', style: 'font-size:10px' }, svg, '0');
                }
                if (opts.values) {
                    el('text', { x: x + (bw - 2) / 2, y: y - 6, 'text-anchor': 'middle', class: 'val-label' }, svg, pct(v));
                }
            });
            el('text', { x: m.left + band * i + band / 2, y: H - 12, 'text-anchor': 'middle', class: 'cat-label', style: opts.small ? 'font-size:12px' : '' }, svg, d.label);
        });

        if (opts.groups) {
            let start = 0;
            for (let i = 1; i <= data.length; i++) {
                if (i === data.length || data[i].group !== data[start].group) {
                    const xa = m.left + band * start, xb = m.left + band * i;
                    el('text', { x: (xa + xb) / 2, y: 16, 'text-anchor': 'middle', class: 'group-label' }, svg, data[start].group.toUpperCase());
                    el('line', { x1: xa + 6, x2: xb - 6, y1: 24, y2: 24, class: 'base-line' }, svg);
                    if (i < data.length) el('line', { x1: xb, x2: xb, y1: 30, y2: m.top + ih, class: 'sep-line' }, svg);
                    start = i;
                }
            }
        }

        container.appendChild(svg);
    }

    function hBars(container, rows) {
        if (!container) return;
        const W = 1000, rowH = 34, secH = 34, labelW = 300, right = 60;
        let H = 10;
        rows.forEach(r => { H += r.section ? secH : rowH; });
        const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Ablation success rates' });
        const iw = W - labelW - right;

        let y = 6, k = 0;
        rows.forEach(r => {
            if (r.section) {
                el('text', { x: 0, y: y + 24, class: 'section-label' }, svg, r.section);
                y += secH;
                return;
            }
            el('text', { x: labelW - 14, y: y + rowH / 2 + 5, 'text-anchor': 'end', class: 'cat-label', style: 'font-weight:' + (r.color ? 700 : 500) }, svg, r.label);
            el('rect', { x: labelW, y: y + 6, width: iw, height: rowH - 12, class: 'track' }, svg);
            const bar = el('rect', { x: labelW, y: y + 6, width: iw * r.value, height: rowH - 12, class: 'bar bar-h', style: barStyle(r.color || 'var(--s-ablate)', k++ * 70) }, svg);
            attachTip(bar, '<b>' + r.label + '</b><br>' + pct(r.value) + ' avg. success');
            el('text', { x: labelW + iw * r.value + 8, y: y + rowH / 2 + 5, class: 'val-label', style: 'font-size:13px' }, svg, pct(r.value));
            y += rowH;
        });

        container.appendChild(svg);
    }

    // Hold the bars at zero until the chart is scrolled into view.
    function animateIn(container) {
        if (!container || reduceMotion) return;
        container.classList.add('is-pending');
        const io = new IntersectionObserver(entries => {
            if (entries.some(e => e.isIntersecting)) {
                // Next frame, so the zero state has been painted before it transitions.
                requestAnimationFrame(() => container.classList.remove('is-pending'));
                io.disconnect();
            }
        }, { threshold: 0.3 });
        io.observe(container);
    }

    legend();
    groupedBars(document.getElementById('chart-summary'), SUMMARY,
        { width: 1000, height: 320, fill: 0.62, values: true, label: 'Average success rate by setting' });
    hBars(document.getElementById('chart-ablation'), ABLATION);
    animateIn(document.getElementById('chart-summary'));
    animateIn(document.getElementById('chart-ablation'));

    /* ------------------------------------------------------------------
     * Scroll reveal: sections and cards fade/slide in once. Added from JS
     * only, so content is never hidden without it (or with reduced motion).
     * ------------------------------------------------------------------ */
    (function reveal() {
        if (reduceMotion || !('IntersectionObserver' in window)) return;
        const SELECTOR = [
            // Not the wall clips or the method cards: their opacity is driven by the
            // wall filter / explainer, which a finished reveal animation would override.
            'main .eyebrow', 'main .section-title', 'main .section-sub', '.wall-note', '.tldr', '.explainer',
            '.stat', '.hl-card', '.figure', '.steer', '.reasoning-card', '.legend', '.chart-card',
            'details.tables', '.bibtex',
        ].join(',');
        const items = Array.from(document.querySelectorAll(SELECTOR));

        // Stagger siblings that share a parent (e.g. the cards in one grid).
        const seen = new Map();
        items.forEach(n => {
            const i = seen.get(n.parentNode) || 0;
            seen.set(n.parentNode, i + 1);
            n.style.setProperty('--reveal-delay', Math.min(i, 4) * 80 + 'ms');
            n.classList.add('reveal');
        });

        const io = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
        items.forEach(n => io.observe(n));
    })();

    /* ------------------------------------------------------------------
     * Stat tiles: count up from 0 when they scroll into view.
     * ------------------------------------------------------------------ */
    (function countUp() {
        const nums = Array.from(document.querySelectorAll('[data-count]'));
        if (!nums.length || reduceMotion) return;
        const DURATION = 1200;
        nums.forEach(n => { n.textContent = '0'; });

        function run(n) {
            const end = Number(n.dataset.count);
            const t0 = performance.now();
            (function frame(now) {
                const t = Math.min(1, (now - t0) / DURATION);
                n.textContent = Math.round(end * (1 - Math.pow(1 - t, 3)));
                if (t < 1) requestAnimationFrame(frame);
            })(t0);
        }

        const io = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
            });
        }, { threshold: 0.6 });
        nums.forEach(n => io.observe(n));
    })();

    /* ------------------------------------------------------------------
     * BibTeX copy button.
     * ------------------------------------------------------------------ */
    (function copyBib() {
        const btn = document.getElementById('copy-bib');
        const code = document.getElementById('bib');
        if (!btn || !code) return;
        const label = btn.querySelector('span');
        const flash = text => { label.textContent = text; setTimeout(() => { label.textContent = 'Copy'; }, 1500); };

        // navigator.clipboard only exists in secure contexts; fall back to a selection copy.
        function fallback() {
            const range = document.createRange();
            range.selectNodeContents(code);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            const ok = document.execCommand && document.execCommand('copy');
            sel.removeAllRanges();
            flash(ok ? 'Copied' : 'Press Ctrl+C');
        }

        btn.addEventListener('click', () => {
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(code.textContent).then(() => flash('Copied'), fallback);
            } else {
                fallback();
            }
        });
    })();
})();
