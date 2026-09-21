import gsap from 'gsap';
import type {
  CorridorStripOptions,
  HoverTarget,
  Marker,
  Station,
  TrackId,
} from './types';
import { damp, lensInverse, lensMap, makeLens } from './lens';
import { HoverCard, MARKER_CARD_W, STATION_CARD_W } from './card';

const PAD = 34;
const META_H = 20;
const RULER_H = 15;
const MARK_HIT_PX = 13;
const STATION_HIT_PX = 11;
/** Half-width of the magnified window, in screen px. */
const LENS_RADIUS = 46;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Stable per-id jitter so pulses desync without a random() call per mount. */
function hashDelay(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 1000) / 1000) * 2.4;
}

function niceKmStep(totalKm: number, plotW: number) {
  const want = (totalKm * 62) / Math.max(plotW, 1);
  return [5, 10, 20, 25, 50, 100, 200].find((s) => s >= want) ?? 200;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  style?: Partial<CSSStyleDeclaration>,
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (style) Object.assign(n.style, style);
  return n;
}

interface MarkNode {
  el: HTMLElement;
  inner: HTMLElement;
  span: HTMLElement;
  fill: HTMLElement | null;
  stem: HTMLElement;
  marker: Marker;
  x0: number;
  x1: number;
  y: number;
  prog: number;
  cx: number;
  spanW: number;
  hot: boolean;
}

interface StationNode {
  el: HTMLElement;
  km: HTMLElement;
  code: HTMLElement;
  tieA: HTMLElement;
  tieB: HTMLElement;
  station: Station;
  x: number;
  fx: number;
  need: number;
  base: number;
  codeShown: boolean;
  hot: boolean;
}

interface BandNode {
  el: HTMLElement;
  x0: number;
  x1: number;
}

interface TickNode {
  el: HTMLElement;
  label: HTMLElement;
  x: number;
  need: number;
  fx: number;
}

/**
 * A corridor strip mounted into a host element.
 *
 * The DOM is built once on mount and then never rebuilt for animation: a
 * single `gsap.ticker` callback writes transforms, resolves the hover target
 * by nearest-mark on the cursor's rail, and drives the card. Nothing in the
 * hot path allocates or touches the framework layer, which is why the React
 * wrapper is thin enough to be optional.
 */
export class CorridorStrip {
  readonly element: HTMLElement;

  private opts: Required<
    Pick<CorridorStripOptions, 'height' | 'magnify' | 'label' | 'bands' | 'ruler' | 'card'>
  > &
    CorridorStripOptions;

  private plot!: HTMLElement;
  private lensEl!: HTMLElement;
  private cursorEl!: HTMLElement;
  private readoutEl!: HTMLElement;
  private rulerEl: HTMLElement | null = null;
  private metaEl!: HTMLElement;

  private marks: MarkNode[] = [];
  private stationNodes: StationNode[] = [];
  private bands: BandNode[] = [];
  private ticks: TickNode[] = [];

  private card: HoverCard | null = null;
  private hover: HoverTarget = null;
  private pinned = false;

  private width = 0;
  private layout = {
    plotW: 0,
    trackH: 0,
    upY: 0,
    dnY: 0,
    midY: 0,
    breakTop: 0,
    breakBottom: 0,
    minPlatforms: 0,
    tickKms: [] as number[],
    showLegend: true,
    showDetail: true,
    ready: false,
  };

  private ro: ResizeObserver | null = null;
  private io: IntersectionObserver | null = null;
  private roFrame = 0;

  private rt = {
    focus: 0,
    targetFocus: 0,
    lens: { m: 1 },
    inside: false,
    dormant: false,
    progAccum: 0,
    px: 0,
    py: 0,
    rect: null as DOMRect | null,
    needsWrite: true,
    hotKey: '',
  };

  private reduced = false;
  private tickFn = (_t: number, deltaMs: number) => this.frame(deltaMs);
  private onScroll = () => this.readRect();
  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.pinned) this.release();
  };

  constructor(target: HTMLElement | string, options: CorridorStripOptions) {
    const host =
      typeof target === 'string'
        ? (document.querySelector(target) as HTMLElement | null)
        : target;
    if (!host) throw new Error(`CorridorStrip: mount target not found (${String(target)})`);

    this.opts = {
      height: 108,
      magnify: 6,
      label: '',
      bands: true,
      ruler: true,
      card: true,
      ...options,
    };

    this.element = host;
    host.classList.add('cs-host');
    host.style.height = `${this.opts.height}px`;
    host.style.setProperty('--cs-meta-h', `${META_H}px`);
    host.style.setProperty('--cs-ruler-h', `${this.opts.ruler ? RULER_H : 0}px`);
    host.setAttribute('role', 'img');

    this.reduced =
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    this.buildChrome();
    if (this.opts.card) this.card = new HoverCard(() => this.release());

    this.bindEvents();
    this.observe();
    gsap.ticker.add(this.tickFn);
  }

  // ---- public API -------------------------------------------------------

  /** Swap data or options in place; the DOM is rebuilt only if it must be. */
  update(next: Partial<CorridorStripOptions>) {
    const structural =
      ('markers' in next && next.markers !== this.opts.markers) ||
      ('stations' in next && next.stations !== this.opts.stations) ||
      ('totalKm' in next && next.totalKm !== this.opts.totalKm) ||
      ('bands' in next && next.bands !== this.opts.bands) ||
      ('ruler' in next && next.ruler !== this.opts.ruler);

    const heightChanged = next.height !== undefined && next.height !== this.opts.height;
    Object.assign(this.opts, next);

    if (heightChanged) {
      this.element.style.height = `${this.opts.height}px`;
      this.element.style.setProperty('--cs-ruler-h', `${this.opts.ruler ? RULER_H : 0}px`);
    }
    if (structural || heightChanged) {
      this.clearHot();
      this.buildChrome();
      this.measure();
      this.build();
    }
    this.rt.needsWrite = true;
  }

  setMarkers(markers: Marker[]) {
    this.update({ markers });
  }

  /** Programmatically drop the pinned card. */
  release() {
    this.pinned = false;
    this.card?.setPinned(false);
    this.opts.onSelect?.(null);
    if (!this.rt.inside) {
      this.clearHot();
      this.setHover(null);
    }
  }

  destroy() {
    gsap.ticker.remove(this.tickFn);
    this.ro?.disconnect();
    this.io?.disconnect();
    cancelAnimationFrame(this.roFrame);
    window.removeEventListener('scroll', this.onScroll, true);
    window.removeEventListener('resize', this.onScroll);
    window.removeEventListener('keydown', this.onKey);
    this.card?.destroy();
    this.element.innerHTML = '';
    this.element.classList.remove('cs-host', 'is-live', 'is-dormant');
  }

  // ---- construction -----------------------------------------------------

  private buildChrome() {
    const host = this.element;
    host.innerHTML = '';

    this.metaEl = el('div', 'cs-meta');
    host.appendChild(this.metaEl);

    this.plot = el('div', 'cs-plot');
    host.appendChild(this.plot);

    if (this.opts.ruler) {
      this.rulerEl = el('div', 'cs-ruler');
      host.appendChild(this.rulerEl);
    } else {
      this.rulerEl = null;
    }

    this.cursorEl = el('div', 'cs-cursor');
    host.appendChild(this.cursorEl);
  }

  private renderMeta() {
    const c = { executing: 0, sanctioned: 0, pending: 0 };
    for (const m of this.opts.markers) {
      if (m.status === 'EXECUTING') c.executing++;
      else if (m.status === 'SANCTIONED') c.sanctioned++;
      else if (m.status === 'PENDING_REVIEW') c.pending++;
    }

    const legend = ['critical', 'high', 'medium', 'low']
      .map(
        (k) =>
          `<span class="cs-legend-item" style="color:var(--cs-sev-${k})"><span class="cs-legend-swatch" style="background:currentColor"></span>${k[0].toUpperCase()}${k.slice(1)}</span>`,
      )
      .join('');

    this.metaEl.innerHTML = `
      <span class="cs-meta-title">${this.opts.label ?? ''}</span>
      <span class="cs-meta-sep"></span>
      <span class="cs-count is-exec"><b>${c.executing}</b> live</span>
      ${
        this.layout.showDetail
          ? `<span class="cs-count"><b>${c.sanctioned}</b> sanctioned</span>
             <span class="cs-count"><b>${c.pending}</b> pending</span>`
          : ''
      }
      <span class="cs-meta-spacer"></span>
      ${this.layout.showLegend ? `<span class="cs-legend">${legend}</span>` : ''}
      ${this.layout.showDetail ? '<span class="cs-meta-sep"></span><span class="cs-readout"></span>' : ''}`;

    this.readoutEl = this.metaEl.querySelector('.cs-readout') as HTMLElement;
    this.element.setAttribute(
      'aria-label',
      `${this.opts.label ?? 'Corridor'}: ${this.opts.markers.length} works across ${this.opts.totalKm} km, ${c.executing} block${c.executing === 1 ? '' : 's'} live`,
    );
  }

  private measure() {
    const w = this.width;
    const rulerH = this.opts.ruler ? RULER_H : 0;
    const plotW = Math.max(0, w - PAD * 2);
    const trackH = this.opts.height - META_H - rulerH;
    const upY = trackH * 0.25;
    const dnY = trackH * 0.78;
    const midY = (upY + dnY) / 2;

    const step = niceKmStep(this.opts.totalKm, plotW);
    const tickKms: number[] = [];
    for (let km = 0; km <= this.opts.totalKm + 0.001; km += step) tickKms.push(km);
    if (tickKms[tickKms.length - 1] !== this.opts.totalKm) tickKms.push(this.opts.totalKm);

    this.layout = {
      plotW,
      trackH,
      upY,
      dnY,
      midY,
      // Vertical break the station code sits in, so the gridline runs past it.
      breakTop: midY - 10,
      breakBottom: midY + 10,
      // Label density follows the real width, not a guess.
      minPlatforms: plotW < 440 ? 7 : plotW < 700 ? 5 : 0,
      tickKms,
      showLegend: w >= 900,
      showDetail: w >= 620,
      ready: plotW > 40,
    };
  }

  private kmToX = (km: number) => PAD + (km / this.opts.totalKm) * this.layout.plotW;

  private build() {
    if (!this.layout.ready) return;
    const { stations, markers } = this.opts;
    const L = this.layout;

    this.renderMeta();
    this.plot.innerHTML = '';
    this.marks = [];
    this.stationNodes = [];
    this.bands = [];
    this.ticks = [];

    // Section bands sit behind everything.
    if (this.opts.bands) {
      for (let i = 0; i + 1 < stations.length; i += 2) {
        const node = el('div', 'cs-band');
        this.plot.appendChild(node);
        this.bands.push({
          el: node,
          x0: this.kmToX(stations[i].km),
          x1: this.kmToX(stations[i + 1].km),
        });
      }
    }

    this.lensEl = el('div', 'cs-lens');
    this.plot.appendChild(this.lensEl);

    for (const [y, name] of [
      [L.upY, 'UP'],
      [L.dnY, 'DN'],
    ] as const) {
      this.plot.appendChild(el('div', 'cs-rail', { top: `${y}px` }));
      const lab = el('span', 'cs-rail-label', { top: `${y}px` });
      lab.textContent = name;
      this.plot.appendChild(lab);
    }

    for (const s of stations) {
      const node = el('div', `cs-station${s.platforms >= 7 ? ' is-major' : ''}`);
      const x = this.kmToX(s.km);
      const need = s.code.length * 7.9 + 9;

      const tieA = el('span', 'cs-station-tie cs-tie-a', {
        top: '0px',
        height: `${L.breakTop}px`,
      });
      const tieB = el('span', 'cs-station-tie cs-tie-b', {
        top: `${L.breakBottom}px`,
        height: `${L.trackH - L.breakBottom + (this.opts.ruler ? RULER_H : 0)}px`,
      });
      node.append(tieA, tieB);

      node.appendChild(el('span', 'cs-station-dot', { top: `${L.upY}px` }));
      node.appendChild(el('span', 'cs-station-dot', { top: `${L.dnY}px` }));

      const code = el('span', 'cs-station-code', {
        top: `${L.midY}px`,
        transform: 'translate(-50%, -50%)',
      });
      code.textContent = s.code;
      const km = el('span', 'cs-station-km');
      km.textContent = s.km.toFixed(0);
      // Decided from the resting position so the lens can't make it flicker.
      km.classList.toggle('is-flipped', x + need / 2 + 26 > this.width);
      code.appendChild(km);
      node.appendChild(code);
      this.plot.appendChild(node);

      this.stationNodes.push({
        el: node,
        km,
        code,
        tieA,
        tieB,
        station: s,
        x,
        fx: 0,
        need,
        base: s.platforms >= L.minPlatforms ? 1 : 0,
        codeShown: true,
        hot: false,
      });
    }

    for (const m of markers) {
      const node = el('div', 'cs-mark');
      node.dataset.status = m.status;
      node.dataset.priority = m.priority;
      node.style.setProperty('--cs-delay', `${hashDelay(m.id)}s`);

      const y = m.line === 'UP' ? L.upY : L.dnY;
      const stem = el('span', 'cs-mark-stem', {
        height: `${L.trackH - y + (this.opts.ruler ? RULER_H : 0)}px`,
      });
      const inner = el('span', 'cs-mark-inner');
      const span = el('span', 'cs-mark-span');
      const fill = m.status === 'EXECUTING' ? el('span', 'cs-mark-progress') : null;
      inner.appendChild(span);
      if (fill) inner.appendChild(fill);
      inner.appendChild(el('span', 'cs-mark-pulse'));
      inner.appendChild(el('span', 'cs-mark-dot'));
      node.append(stem, inner);
      this.plot.appendChild(node);

      this.marks.push({
        el: node,
        inner,
        span,
        fill,
        stem,
        marker: m,
        x0: this.kmToX(m.kmStart),
        x1: this.kmToX(m.kmEnd),
        y,
        prog: m.progress ?? 0,
        cx: 0,
        spanW: 2,
        hot: false,
      });
    }

    if (this.rulerEl) {
      this.rulerEl.innerHTML = '';
      for (const km of L.tickKms) {
        const node = el('div', 'cs-tick');
        node.appendChild(el('span', 'cs-tick-line'));
        const label = el('span', 'cs-tick-label');
        label.textContent = km.toFixed(0);
        node.appendChild(label);
        this.rulerEl.appendChild(node);
        this.ticks.push({
          el: node,
          label,
          x: this.kmToX(km),
          need: km.toFixed(0).length * 4.6 + 8,
          fx: 0,
        });
      }
    }

    this.rt.needsWrite = true;
  }

  // ---- observers & events ----------------------------------------------

  private observe() {
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver((entries) => {
        const e = entries[0];
        if (!e) return;
        const size = Array.isArray(e.contentBoxSize)
          ? e.contentBoxSize[0]
          : (e.contentBoxSize as unknown as ResizeObserverSize | undefined);
        const w = size ? size.inlineSize : e.contentRect.width;
        cancelAnimationFrame(this.roFrame);
        this.roFrame = requestAnimationFrame(() => {
          if (Math.abs(this.width - w) < 0.5) return;
          this.width = w;
          this.clearHot();
          this.measure();
          this.build();
        });
      });
      this.ro.observe(this.element);
    } else {
      this.width = this.element.clientWidth;
      this.measure();
      this.build();
    }

    // A strip scrolled out of view stops animating entirely.
    if (typeof IntersectionObserver !== 'undefined') {
      this.io = new IntersectionObserver(
        ([entry]) => {
          this.rt.dormant = !entry.isIntersecting;
          this.element.classList.toggle('is-dormant', this.rt.dormant);
        },
        { rootMargin: '120px' },
      );
      this.io.observe(this.element);
    }
  }

  private bindEvents() {
    const host = this.element;
    host.addEventListener('pointerenter', () => {
      this.readRect();
      this.rt.inside = true;
      host.classList.add('is-live');
      gsap.to(this.rt.lens, {
        m: this.opts.magnify,
        duration: 0.52,
        ease: 'power3.out',
        overwrite: true,
      });
      if (this.lensEl) gsap.to(this.lensEl, { opacity: 1, duration: 0.4 });
      gsap.to(this.cursorEl, { opacity: 1, duration: 0.25 });
    });

    host.addEventListener('pointermove', (e) => {
      const rect = this.rt.rect;
      if (!rect) return;
      this.rt.px = e.clientX - rect.left;
      this.rt.py = e.clientY - rect.top - META_H;
      this.rt.targetFocus = clamp(this.rt.px, 0, this.width);
      this.cursorEl.style.transform = `translate3d(${this.rt.px}px, 0, 0)`;
    });

    host.addEventListener('pointerleave', () => {
      this.rt.inside = false;
      host.classList.remove('is-live');
      gsap.to(this.rt.lens, { m: 1, duration: 0.6, ease: 'power2.inOut', overwrite: true });
      if (this.lensEl) gsap.to(this.lensEl, { opacity: 0, duration: 0.35 });
      gsap.to(this.cursorEl, { opacity: 0, duration: 0.25 });
      if (!this.pinned) {
        this.clearHot();
        this.setHover(null);
      }
    });

    host.addEventListener('pointerdown', () => {
      if (!this.hover) {
        if (this.pinned) this.release();
        return;
      }
      if (this.hover.type === 'marker') {
        this.pinned = true;
        this.card?.setPinned(true);
        this.opts.onSelect?.(this.hover.marker);
      }
    });

    window.addEventListener('scroll', this.onScroll, true);
    window.addEventListener('resize', this.onScroll);
    window.addEventListener('keydown', this.onKey);
  }

  private readRect() {
    this.rt.rect = this.element.getBoundingClientRect();
  }

  private setHover(t: HoverTarget) {
    this.hover = t;
    this.opts.onHover?.(t);
    if (!this.card) return;
    if (t) this.card.show(t, t.type === 'station' ? this.stationLoad(t.station) : { up: 0, dn: 0 });
    else this.card.hide();
  }

  private stationLoad(s: Station) {
    const { stations, markers } = this.opts;
    const load = { up: 0, dn: 0 };
    for (const m of markers) {
      if (m.status === 'COMPLETED' || m.status === 'CANCELLED') continue;
      let host = stations[0];
      for (const st of stations) if (st.km <= m.kmStart) host = st;
      if (host.code === s.code) load[m.line === 'UP' ? 'up' : 'dn']++;
    }
    return load;
  }

  private clearHot() {
    for (const n of this.marks) {
      if (!n.hot) continue;
      n.hot = false;
      n.el.classList.remove('is-hot');
      gsap.to(n.inner, { scale: 1, duration: 0.3, ease: 'power2.out' });
      gsap.to(n.stem, { opacity: 0, scaleY: 0, duration: 0.22, ease: 'power2.in' });
    }
    for (const s of this.stationNodes) {
      s.hot = false;
      s.el.classList.remove('is-hot');
    }
    this.rt.hotKey = '';
  }

  // ---- the frame loop ---------------------------------------------------

  private frame(deltaMs: number) {
    const rt = this.rt;
    if (rt.dormant || !this.layout.ready) return;

    const dt = Math.min(deltaMs, 50) / 1000;
    const m = rt.lens.m;
    const active = rt.inside || m > 1.001 || rt.needsWrite;

    // Live blocks creep forward so the strip never looks like a static mock.
    // Off the hot path a few Hz is plenty, and reusing the cached span width
    // means an idle strip never has to evaluate the lens at all.
    rt.progAccum += dt;
    if (active || rt.progAccum >= 0.25) {
      const step = active ? dt : rt.progAccum;
      rt.progAccum = 0;
      for (const n of this.marks) {
        if (n.marker.status !== 'EXECUTING' || n.prog >= 1) continue;
        n.prog = Math.min(1, n.prog + step * 0.004);
        if (!active && n.fill) n.fill.style.width = `${n.spanW * n.prog}px`;
      }
    }

    // An unhovered strip costs one comparison per frame from here on.
    if (!active) return;

    rt.focus = this.reduced ? rt.targetFocus : damp(rt.focus, rt.targetFocus, 20, dt);
    const focus = rt.focus;
    const lens = makeLens(focus, this.width, m, LENS_RADIUS);
    const L = this.layout;

    for (const n of this.marks) {
      const fx0 = lensMap(n.x0, lens);
      const fx1 = lensMap(n.x1, lens);
      const w = Math.max(2, fx1 - fx0);
      const cx = (fx0 + fx1) / 2;
      n.cx = cx;
      n.spanW = w;
      n.el.style.transform = `translate3d(${cx}px, ${n.y}px, 0)`;
      n.span.style.width = `${w}px`;
      n.span.style.left = `${-w / 2}px`;
      if (n.fill) {
        n.fill.style.width = `${w * n.prog}px`;
        n.fill.style.left = `${-w / 2}px`;
      }
    }

    for (const b of this.bands) {
      const fx0 = lensMap(b.x0, lens);
      b.el.style.transform = `translate3d(${fx0}px, 0, 0)`;
      b.el.style.width = `${Math.max(0, lensMap(b.x1, lens) - fx0)}px`;
    }

    const sn = this.stationNodes;
    for (const s of sn) {
      s.fx = lensMap(s.x, lens);
      s.el.style.transform = `translate3d(${s.fx}px, 0, 0)`;
    }
    // Second pass: a label only shows while its warped neighbours leave room
    // for it, so codes dissolve out of the compressed context instead of
    // piling up. Self-tuning across any width or magnification.
    for (let i = 0; i < sn.length; i++) {
      const s = sn[i];
      const gap = Math.min(
        i > 0 ? s.fx - sn[i - 1].fx : Infinity,
        i < sn.length - 1 ? sn[i + 1].fx - s.fx : Infinity,
      );
      const codeOn = s.base * clamp((gap - s.need * 0.78) / (s.need * 0.45), 0, 1);
      s.code.style.opacity = `${codeOn}`;
      s.km.style.opacity = `${s.base * clamp((gap - s.need * 1.9) / (s.need * 1.4), 0, 1)}`;
      // With no code to make room for, the gridline closes back up rather
      // than leaving a gap that reads as a rendering fault.
      const shown = codeOn > 0.15;
      if (shown !== s.codeShown) {
        s.codeShown = shown;
        s.tieA.style.height = `${shown ? L.breakTop : L.trackH + (this.opts.ruler ? RULER_H : 0)}px`;
        s.tieB.style.opacity = shown ? '1' : '0';
      }
    }

    const tn = this.ticks;
    for (const tk of tn) {
      tk.fx = lensMap(tk.x, lens);
      tk.el.style.transform = `translate3d(${tk.fx}px, 0, 0)`;
    }
    for (let i = 0; i < tn.length; i++) {
      const tk = tn[i];
      const gap = Math.min(
        i > 0 ? tk.fx - tn[i - 1].fx : Infinity,
        i < tn.length - 1 ? tn[i + 1].fx - tk.fx : Infinity,
      );
      let o = clamp((gap - tk.need * 0.55) / (tk.need * 0.45), 0, 1);
      // A gridline landing on a tick number wins — the station is the anchor.
      for (const s of sn) {
        if (Math.abs(s.fx - tk.fx) < 17) {
          o = 0;
          break;
        }
      }
      tk.label.style.opacity = `${o}`;
    }

    this.lensEl.style.transform = `translate3d(${focus}px, 0, 0)`;

    if (rt.inside && !this.pinned) this.hitTest(lens, dt);
    else if (this.pinned && this.card && this.hover) this.placeCard(dt);

    rt.needsWrite = false;
  }

  private hitTest(lens: ReturnType<typeof makeLens>, dt: number) {
    const rt = this.rt;
    const L = this.layout;
    const band: TrackId = rt.py < L.midY ? 'UP' : 'DN';

    let mBest: MarkNode | null = null;
    let mDist = Infinity;
    for (const n of this.marks) {
      if (n.marker.line !== band) continue;
      const d = Math.abs(n.cx - rt.px);
      if (d < mDist) {
        mDist = d;
        mBest = n;
      }
    }

    let sBest: StationNode | null = null;
    let sDist = Infinity;
    for (const s of this.stationNodes) {
      const d = Math.abs(s.fx - rt.px);
      if (d < sDist) {
        sDist = d;
        sBest = s;
      }
    }

    let key = '';
    let nextMark: MarkNode | null = null;
    let nextStation: StationNode | null = null;
    const markHit = mBest && mDist <= MARK_HIT_PX;
    const stationHit = sBest && sDist <= STATION_HIT_PX;
    // Markers are the actionable thing, so they win ties by a small bias.
    if (markHit && (!stationHit || mDist - 2 <= sDist)) {
      nextMark = mBest;
      key = `m:${mBest!.marker.id}`;
    } else if (stationHit) {
      nextStation = sBest;
      key = `s:${sBest!.station.code}`;
    }

    if (key !== rt.hotKey) {
      for (const n of this.marks) {
        if (n.hot && n !== nextMark) {
          n.hot = false;
          n.el.classList.remove('is-hot');
          gsap.to(n.inner, { scale: 1, duration: 0.26, ease: 'power2.out' });
          gsap.to(n.stem, { opacity: 0, scaleY: 0, duration: 0.2, ease: 'power2.in' });
        }
      }
      for (const s of this.stationNodes) {
        if (s.hot && s !== nextStation) {
          s.hot = false;
          s.el.classList.remove('is-hot');
        }
      }
      if (nextMark) {
        nextMark.hot = true;
        nextMark.el.classList.add('is-hot');
        gsap.to(nextMark.inner, { scale: 1.85, duration: 0.42, ease: 'elastic.out(1, 0.62)' });
        gsap.to(nextMark.stem, { opacity: 0.5, scaleY: 1, duration: 0.3, ease: 'power2.out' });
      }
      if (nextStation) {
        nextStation.hot = true;
        nextStation.el.classList.add('is-hot');
      }

      rt.hotKey = key;
      if (nextMark) {
        this.setHover({
          type: 'marker',
          marker: { ...nextMark.marker, progress: nextMark.prog },
        });
      } else if (nextStation) {
        this.setHover({ type: 'station', station: nextStation.station });
      } else {
        this.setHover(null);
      }
    }

    if (this.card && this.hover) {
      const anchor = nextMark ? nextMark.cx : nextStation ? nextStation.fx : rt.px;
      this.placeCard(dt, anchor);
    }

    if (this.readoutEl) {
      const ux = lensInverse(rt.px, lens);
      const km = clamp(((ux - PAD) / L.plotW) * this.opts.totalKm, 0, this.opts.totalKm);
      const st = this.opts.stations;
      let from = st[0];
      let to = st[st.length - 1];
      for (let i = 0; i < st.length - 1; i++) {
        if (km >= st[i].km && km <= st[i + 1].km) {
          from = st[i];
          to = st[i + 1];
          break;
        }
      }
      this.readoutEl.textContent = `${km.toFixed(2)} km · ${from.code}–${to.code} · ${band}`;
    }
  }

  private placeCard(dt: number, anchorX?: number) {
    const rect = this.rt.rect;
    if (!rect || !this.card || !this.hover) return;
    const w = this.hover.type === 'station' ? STATION_CARD_W : MARKER_CARD_W;
    const ax = anchorX ?? this.rt.px;
    this.card.place(rect.left + ax, rect.bottom + 8, w, dt);
  }
}

/** Functional shorthand: `createCorridorStrip('#strip', { ... })`. */
export function createCorridorStrip(
  target: HTMLElement | string,
  options: CorridorStripOptions,
): CorridorStrip {
  return new CorridorStrip(target, options);
}
