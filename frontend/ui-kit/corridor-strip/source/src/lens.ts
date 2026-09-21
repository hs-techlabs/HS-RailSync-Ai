/**
 * Bounded magnifying lens over one axis.
 *
 * The strip is ~1500 px wide and 440 km long, so a 700 m worksite is about
 * 2 px. We warp x around the cursor instead of scrolling or clipping.
 *
 * A plain d3-style fisheye — g(u) = (d+1)u / (du+1) — magnifies the focus but
 * pays for it by compressing *everything* else towards the two ends: hover the
 * middle and the corridor evacuates to the edges, which destroys the reader's
 * spatial anchor on what is fundamentally a ruler.
 *
 * Any bijection of [0,1] that magnifies near 0 has to compress somewhere; the
 * only real choice is where to put it. So we spread it thinly and uniformly
 * across everything outside the lens:
 *
 *   H(u) = (1 - a) * (1 - e^(-u/s)) / (1 - e^(-1/s)) + a * u
 *
 * with u the normalised distance from the focus to that end of the strip.
 * H(0) = 0, H(1) = 1, and H'(u) = (1-a)/(s*E) * e^(-u/s) + a is a sum of
 * positive terms, so the map is strictly monotonic for every parameter choice
 * — no folding, ever. `s` sets the lens radius and `a` is solved from the
 * requested peak magnification; beyond the lens the scale settles to a
 * constant `a` (~0.7), a gentle squeeze rather than an evacuation.
 */

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

interface LensSide {
  /** Distance from focus to this end of the strip. */
  m: number;
  /** Lens radius as a fraction of m. */
  s: number;
  /** Normalising constant 1 - e^(-1/s). */
  e: number;
  /** Far-field scale. */
  a: number;
}

export interface Lens {
  focus: number;
  left: LensSide | null;
  right: LensSide | null;
}

/**
 * @param magnify peak scale directly under the cursor; 1 is the identity.
 * @param radiusPx half-width of the magnified window, in screen px.
 */
export function makeLens(focus: number, width: number, magnify: number, radiusPx: number): Lens {
  const side = (m: number): LensSide | null => {
    if (m <= 1) return null;
    const s = clamp(radiusPx / m, 0.015, 0.5);
    const e = 1 - Math.exp(-1 / s);
    // Peak scale achievable at a = 0.
    const c = 1 / (s * e);
    const a = magnify >= c ? 0 : (magnify - c) / (1 - c);
    return { m, s, e, a: clamp(a, 0, 1) };
  };
  return { focus, left: side(focus), right: side(width - focus) };
}

function shape(u: number, side: LensSide): number {
  return ((1 - side.a) * (1 - Math.exp(-u / side.s))) / side.e + side.a * u;
}

/** Corridor x -> screen x. */
export function lensMap(x: number, lens: Lens): number {
  const dx = x - lens.focus;
  if (dx === 0) return lens.focus;
  const side = dx < 0 ? lens.left : lens.right;
  if (!side) return x;
  const u = Math.min(Math.abs(dx) / side.m, 1);
  return lens.focus + (dx < 0 ? -1 : 1) * side.m * shape(u, side);
}

/**
 * Screen x -> corridor x. Bisection: `shape` has no closed-form inverse, but
 * it is monotonic, and this runs once per frame for the chainage readout.
 */
export function lensInverse(fx: number, lens: Lens): number {
  const dfx = fx - lens.focus;
  if (dfx === 0) return lens.focus;
  const side = dfx < 0 ? lens.left : lens.right;
  if (!side) return fx;
  const target = Math.min(Math.abs(dfx) / side.m, 1);
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 26; i++) {
    const mid = (lo + hi) / 2;
    if (shape(mid, side) < target) lo = mid;
    else hi = mid;
  }
  return lens.focus + (dfx < 0 ? -1 : 1) * side.m * ((lo + hi) / 2);
}

/** Frame-rate independent exponential smoothing — the organic follow. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}
