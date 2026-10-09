(function () {
    'use strict';

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const SVG_NS = 'http://www.w3.org/2000/svg';

    /* ------------------------------------------------------------------
     * Videos: load only when near the viewport, pause when off-screen.
     * ------------------------------------------------------------------ */
    (function lazyVideos() {
        const videos = Array.from(document.querySelectorAll('video[data-src]'));
        if (reduceMotion) videos.forEach(v => { v.controls = true; });

        const io = new IntersectionObserver(entries => {
            for (const { target: v, isIntersecting } of entries) {
                if (isIntersecting) {
                    if (!v.src) { v.src = v.dataset.src; v.preload = 'auto'; }
                    if (!reduceMotion) v.play().catch(() => {});
                } else if (!v.paused) {
                    v.pause();
                }
            }
        }, { rootMargin: '200px 0px' });

        videos.forEach(v => {
            io.observe(v);
            // No visible controls on the looping clips, so a click toggles playback.
            v.addEventListener('click', () => { if (v.paused) v.play().catch(() => {}); else v.pause(); });
        });
    })();

    /* ------------------------------------------------------------------
     * Steerability: same scene, swap the rollout by prompt.
     * Clips live at assets/video/steer/<group>_<key>.mp4. A missing clip
     * shows a placeholder, so new files only need to be dropped in.
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
        const video = document.getElementById('steer-video');
        const ph = document.getElementById('steer-placeholder');
        const phTitle = document.getElementById('steer-ph-title');
        const phBody = document.getElementById('steer-ph-body');
        let token = 0;

        if (reduceMotion) video.controls = true;

        function showPlaceholder(item, src) {
            video.hidden = true;
            ph.hidden = false;
            phTitle.textContent = 'Steerability rollout: “' + item.prompt + '”';
            phBody.innerHTML =
                '放到 <code>' + src + '</code>（同一场景、同一起点；竖屏或横屏均可，H.264，&le; 3 MB）。<br>' +
                '文件放好后刷新即可，无需改代码。实际 prompt 文案不同的话，改 <code>static/js/main.js</code> 里的 <code>STEER</code>。';
        }

        function select(group, item, button) {
            promptBox.querySelectorAll('.steer-prompt').forEach(b => {
                b.classList.toggle('is-active', b === button);
                b.setAttribute('aria-pressed', b === button);
            });
            const src = 'assets/video/steer/' + group + '_' + item.key + '.mp4';
            const mine = ++token;

            video.onloadeddata = () => {
                if (mine !== token) return;
                ph.hidden = true;
                video.hidden = false;
                if (!reduceMotion) video.play().catch(() => {});
            };
            video.onerror = () => { if (mine === token) showPlaceholder(item, src); };
            video.poster = 'assets/images/posters/steer_' + group + '_' + item.key + '.jpg';
            video.src = src;
        }

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
     * Charts (inline SVG, no dependencies).
     * ------------------------------------------------------------------ */
    const SERIES = [
        { key: 'omni',   name: 'OmniVLA',              color: '#9a9a9a' },
        { key: 'navila', name: 'NaVILA',               color: '#d4d4d4' },
        { key: 'asd',    name: 'ASD (Qwen2.5-VL-3B)', color: '#e77500' },
        { key: 'asd35',  name: 'ASD (Qwen3.5-VL-9B)', color: '#121212' },
    ];

    const SUMMARY = [
        { label: 'Indoor (9 tasks)',     omni: 0.54, navila: 0.27, asd: 0.84, asd35: 0.94 },
        { label: 'Multi-stage (2 tasks)', omni: 0.35, navila: 0.40, asd: 0.70, asd35: 0.85 },
        { label: 'Outdoor (4 tasks)',    omni: 0.90, navila: 0.33, asd: 0.95, asd35: 0.98 },
    ];

    const ABLATION = [
        { label: 'ASD (Qwen3.5-VL-9B)', value: 0.92, color: '#121212' },
        { label: 'ASD (Qwen2.5-VL-3B)', value: 0.80, color: '#e77500' },
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
                const r = el('rect', { x: x, y: y, width: bw - 2, height: h, fill: s.color, class: 'bar' }, svg);
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
                    el('line', { x1: xa + 6, x2: xb - 6, y1: 24, y2: 24, stroke: '#d6d3d1' }, svg);
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

        let y = 6;
        rows.forEach(r => {
            if (r.section) {
                el('text', { x: 0, y: y + 24, class: 'section-label' }, svg, r.section);
                y += secH;
                return;
            }
            el('text', { x: labelW - 14, y: y + rowH / 2 + 5, 'text-anchor': 'end', class: 'cat-label', style: 'font-weight:' + (r.color ? 700 : 500) }, svg, r.label);
            el('rect', { x: labelW, y: y + 6, width: iw, height: rowH - 12, fill: '#f3f1ee' }, svg);
            const bar = el('rect', { x: labelW, y: y + 6, width: iw * r.value, height: rowH - 12, fill: r.color || '#a8a29e', class: 'bar' }, svg);
            attachTip(bar, '<b>' + r.label + '</b><br>' + pct(r.value) + ' avg. success');
            el('text', { x: labelW + iw * r.value + 8, y: y + rowH / 2 + 5, class: 'val-label', style: 'font-size:13px' }, svg, pct(r.value));
            y += rowH;
        });

        container.appendChild(svg);
    }

    legend();
    groupedBars(document.getElementById('chart-summary'), SUMMARY,
        { width: 1000, height: 320, fill: 0.62, values: true, label: 'Average success rate by setting' });
    hBars(document.getElementById('chart-ablation'), ABLATION);

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
