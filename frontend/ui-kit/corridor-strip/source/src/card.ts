import gsap from 'gsap';
import type { HoverTarget, Marker, Station } from './types';
import { damp } from './lens';

export const MARKER_CARD_W = 328;
export const STATION_CARD_W = 268;

const DEPT_VAR: Record<string, string> = {
  ENGINEERING_TRACK: 'var(--cs-dept-track)',
  TRACTION_DISTRIBUTION_OHE: 'var(--cs-dept-ohe)',
  SIGNAL_AND_TELECOM: 'var(--cs-dept-sig)',
};

const STATUS_LABEL: Record<string, string> = {
  EXECUTING: 'Block live',
  SANCTIONED: 'Sanctioned',
  PENDING_REVIEW: 'Pending review',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const esc = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (ch) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string,
  );

function durationText(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

const row = (k: string, v: unknown) =>
  v === undefined || v === null || v === ''
    ? ''
    : `<div class="hc-row"><span class="hc-k">${esc(k)}</span><span class="hc-v">${esc(v)}</span></div>`;

function markerBody(m: Marker) {
  const accent = DEPT_VAR[m.dept ?? ''] ?? 'var(--cs-dept-track)';
  const len = Math.max(0, m.kmEnd - m.kmStart);
  const prog = m.progress ?? 0;

  const flags: string[] = [];
  if (m.powerBlock) flags.push('<span class="hc-flag is-power">Power block</span>');
  if (m.disconnection) flags.push('<span class="hc-flag is-disc">Disconnection</span>');
  if (m.attachments) flags.push(`<span class="hc-flag">${m.attachments} attachments</span>`);

  return `
    <div class="hc-head">
      <span class="hc-id">${esc(m.id)}</span>
      <span class="hc-chip hc-sev-${m.priority.toLowerCase()}">${esc(m.priority)}</span>
    </div>
    ${m.defect ? `<div class="hc-title">${esc(m.defect)}</div>` : ''}
    <div class="hc-statusline">
      <span class="hc-dot hc-st-${m.status.toLowerCase()}"></span>
      <span class="hc-status">${STATUS_LABEL[m.status] ?? esc(m.status)}</span>
      <span class="hc-line-tag">${esc(m.line)} line</span>
      ${m.memo ? `<span class="hc-memo">${esc(m.memo)}</span>` : ''}
    </div>
    ${
      m.status === 'EXECUTING'
        ? `<div class="hc-progress">
             <div class="hc-progress-track"><div class="hc-progress-fill" style="transform:scaleX(${prog})"></div></div>
             <span class="hc-progress-pct">${Math.round(prog * 100)}%</span>
           </div>`
        : ''
    }
    <div class="hc-grid">
      ${row('Section', m.section)}
      ${row('Chainage', `${m.kmStart.toFixed(2)} - ${m.kmEnd.toFixed(2)} km (${(len * 1000).toFixed(0)} m)`)}
      ${row('Asset', m.asset)}
      ${row('Crew', m.crew)}
      ${row('Machine', m.machine ? m.machine.replace(/_/g, ' ') : undefined)}
      ${row('Duration', m.durationMin ? durationText(m.durationMin) : undefined)}
      ${row('Window', m.window)}
      ${row('Failure risk', m.failurePct != null ? `${m.failurePct.toFixed(1)}%` : undefined)}
    </div>
    ${flags.length ? `<div class="hc-flags">${flags.join('')}</div>` : ''}
    ${
      m.deptLabel
        ? `<div class="hc-foot"><span class="hc-dept" style="background:${accent}"></span>${esc(m.deptLabel)}</div>`
        : ''
    }`;
}

function stationBody(s: Station, load: { up: number; dn: number }) {
  return `
    <div class="hc-head">
      <span class="hc-id">${esc(s.code)}</span>
      <span class="hc-chip hc-neutral">${s.km.toFixed(0)} km</span>
    </div>
    <div class="hc-title">${esc(s.name)}</div>
    <div class="hc-grid">
      ${row('Division', s.division)}
      ${row('Platforms', s.platforms)}
      ${row('Speed limit', s.speedLimit ? `${s.speedLimit} kmph` : undefined)}
      ${row('Open work', `${load.up} UP / ${load.dn} DN`)}
    </div>
    ${
      s.depots && s.depots.length
        ? `<div class="hc-flags">${s.depots.map((d) => `<span class="hc-flag">${esc(d)}</span>`).join('')}</div>`
        : ''
    }`;
}

/**
 * The popup, portalled to <body> and positioned imperatively.
 *
 * Position is eased with the same exponential damping the lens focus uses,
 * which gives the critically-damped glide a spring would, without pulling in
 * a React-only animation library — the whole point of this package is that it
 * has to mount on plain pages too.
 */
export class HoverCard {
  readonly el: HTMLElement;
  private inner: HTMLElement;
  private closeBtn: HTMLButtonElement;
  private x = 0;
  private y = 0;
  private tx = 0;
  private ty = 0;
  private placed = false;
  private visible = false;
  private key = '';
  private onClose: () => void;

  constructor(onClose: () => void) {
    this.onClose = onClose;
    this.el = document.createElement('div');
    this.el.className = 'hc-card';
    this.el.setAttribute('role', 'tooltip');
    this.el.style.opacity = '0';
    this.el.style.pointerEvents = 'none';
    this.inner = document.createElement('div');
    this.inner.className = 'hc-inner';
    this.closeBtn = document.createElement('button');
    this.closeBtn.className = 'hc-close';
    this.closeBtn.type = 'button';
    this.closeBtn.textContent = 'Esc';
    this.closeBtn.setAttribute('aria-label', 'Dismiss');
    this.closeBtn.addEventListener('click', () => this.onClose());
    this.el.appendChild(this.inner);
    document.body.appendChild(this.el);
  }

  width(target: HoverTarget) {
    return target?.type === 'station' ? STATION_CARD_W : MARKER_CARD_W;
  }

  show(target: HoverTarget, load: { up: number; dn: number }) {
    if (!target) return this.hide();
    const key = target.type === 'marker' ? `m:${target.marker.id}` : `s:${target.station.code}`;
    if (key === this.key) return;
    this.key = key;

    this.inner.innerHTML =
      target.type === 'marker' ? markerBody(target.marker) : stationBody(target.station, load);
    this.inner.appendChild(this.closeBtn);
    this.el.style.width = `${this.width(target)}px`;

    if (!this.visible) {
      this.visible = true;
      gsap.killTweensOf(this.el);
      gsap.fromTo(
        this.el,
        { opacity: 0, scale: 0.955 },
        { opacity: 1, scale: 1, duration: 0.22, ease: 'power3.out', overwrite: true },
      );
    }
  }

  hide() {
    this.key = '';
    if (!this.visible) return;
    this.visible = false;
    this.placed = false;
    gsap.killTweensOf(this.el);
    gsap.to(this.el, { opacity: 0, scale: 0.97, duration: 0.13, ease: 'power2.in' });
  }

  setPinned(pinned: boolean) {
    this.el.classList.toggle('is-pinned', pinned);
    this.el.style.pointerEvents = pinned ? 'auto' : 'none';
    this.closeBtn.style.display = pinned ? '' : 'none';
  }

  /** Called once per frame while a target is resolved. */
  place(anchorX: number, anchorY: number, width: number, dt: number) {
    this.tx = Math.max(8, Math.min(anchorX - width / 2, window.innerWidth - width - 8));
    this.ty = anchorY;
    if (!this.placed) {
      this.placed = true;
      this.x = this.tx;
      this.y = this.ty;
    } else {
      this.x = damp(this.x, this.tx, 26, dt);
      this.y = damp(this.y, this.ty, 26, dt);
    }
    this.el.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;
  }

  destroy() {
    gsap.killTweensOf(this.el);
    this.el.remove();
  }
}
