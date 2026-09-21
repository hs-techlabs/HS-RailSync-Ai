---
title: Corridor Strip
description: Full-width corridor bar for the top of every OCC page — two rails, station anchors, and every block request / sanctioned window / live execution as a pulsing dot at its true chainage. Hover to magnify, hover a dot for its card, click to pin.
stack: TypeScript source, shipped as one plain JS file (GSAP bundled) — no build step to use it, `npm run build` in source/ to change it
inspired-by: focus+context lenses (but bounded — see "Behaviour worth knowing")
---

## What it is

A strip that goes at the top of a page, full width, ~108px tall. Two rails (UP / DN) run the
corridor's length; stations sit on them as navy anchors with a gridline down through the km ruler;
every request, sanctioned window and live block is a dot at its real chainage, coloured by priority
and treated by status (live pulses hard, sanctioned pulses slow, pending is hollow, completed and
cancelled are small and muted). Alternating section tint between stations gives position a zonal
read before any label is involved.

Hover the strip and a **bounded lens** opens under the cursor — a 700m worksite that is 2px at
rest becomes 15px — while everything else stays put. Hover a dot for its card, click to pin,
`Esc` to release.

It runs **without React**: the core builds its own DOM and drives every frame itself, so it mounts
on the existing Flask-served pages exactly the way side-nav does. A thin React wrapper is included
for anything bundled.

## Files

| File | Purpose |
| --- | --- |
| `corridor-strip.js` | The component. UMD-ish global `CorridorStrip`. GSAP is bundled in. |
| `corridor-strip.css` | All styling. Namespaced `.cs-*` / `.hc-*`, themed through `--cs-*` variables that fall back to the app's tokens. |
| `corridor.presets.js` | **The file the team edits.** Corridors as `CORRIDOR_PRESETS`, and `CORRIDOR_MAP` to turn raw API records into markers. |
| `demo.html` | Standalone playground — open it directly in a browser, no server needed. |
| `demo-data.js` | Raw API-shaped sample records for the demo only. |
| `source/` | TypeScript source and build. Only needed to *change* the component. Also holds `dist/` (ESM + React wrapper + types) for bundled consumers. |

## Install into a page

```html
<link rel="stylesheet" href="/static/ui-kit/corridor-strip/corridor-strip.css">

<!-- at the top of the page, full width; the strip sets its own height -->
<div id="corridor"></div>

<script src="/static/ui-kit/corridor-strip/corridor-strip.js"></script>
<script src="/static/ui-kit/corridor-strip/corridor.presets.js"></script>
<script>
  var preset = CORRIDOR_PRESETS['ndls-cnb'];
  var strip = CorridorStrip.create('#corridor', {
    stations: preset.stations,
    totalKm:  preset.totalKm,
    label:    preset.label,
    markers:  requests.map(CORRIDOR_MAP.request)
                .concat(demands.map(CORRIDOR_MAP.demand)),
    onSelect: function (marker) {
      // marker is the pinned request, or null on release
    }
  });

  // when data changes:
  strip.setMarkers(newMarkers);
</script>
```

That is the whole integration. The host `<div>` decides width and position; nothing else on the
page needs to change. `requests` and `demands` are the arrays the API already returns from
`worker_requests.json` and `pending_demands.json` — `CORRIDOR_MAP` does the field renaming.

> **Serving the files.** Same as side-nav: copy this folder to
> `Railways/src/frontend/ui-kit/corridor-strip/`, or mount `ui-kit/` in `main.py` and reference
> `/ui-kit/corridor-strip/…`.

### React

```bash
npm install ../ui-kit/corridor-strip/source gsap
```

```tsx
import { CorridorStrip } from '@railways/corridor-strip/react';
import '@railways/corridor-strip/style.css';

<CorridorStrip stations={stations} markers={markers} totalKm={440} label="…" onSelect={setSelected} />
```

Props are the options below. Inline callbacks are fine — they are read through a ref and do not
remount the strip.

## Options

| option | type | default | |
| --- | --- | --- | --- |
| `stations` | `Station[]` | required | ascending by `km` |
| `markers` | `Marker[]` | required | |
| `totalKm` | `number` | required | corridor length; chainages plot against it |
| `label` | `string` | `''` | left of the meta rail |
| `height` | `number` | `108` | total strip height |
| `magnify` | `number` | `6` | peak scale under the cursor; `1` disables the lens |
| `bands` | `boolean` | `true` | alternating tint between stations |
| `ruler` | `boolean` | `true` | km ruler; `false` saves 15px |
| `card` | `boolean` | `true` | built-in hover card; `false` to drive your own from `onHover` |
| `onSelect` | `(marker \| null) => void` | | click pins, `Esc` / click-away releases |
| `onHover` | `(target \| null) => void` | | every hover change; `{type:'marker', marker}` or `{type:'station', station}` |

### Instance

```js
strip.update({ markers, magnify: 8 })   // any subset of options; rebuilds only if it must
strip.setMarkers(markers)               // shorthand
strip.release()                         // drop a pinned card
strip.destroy()                         // remove everything, stop the ticker
strip.element                           // the host element
```

## Data shape

Only six marker fields affect the plot. Everything else is card content and optional.

```ts
interface Marker {
  id: string;
  line: 'UP' | 'DN';
  kmStart: number;
  kmEnd: number;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'EXECUTING' | 'SANCTIONED' | 'PENDING_REVIEW' | 'COMPLETED' | 'CANCELLED';

  // card only — all optional
  defect?, section?, asset?, crew?, machine?, durationMin?, window?, memo?,
  powerBlock?, disconnection?, attachments?, failurePct?, deptLabel?,
  dept?: 'ENGINEERING_TRACK' | 'TRACTION_DISTRIBUTION_OHE' | 'SIGNAL_AND_TELECOM',
  progress?: number   // 0..1, EXECUTING only
}

interface Station {
  code: string; name: string; km: number; platforms: number;
  division?, speedLimit?, depots?   // card only
}
```

`CORRIDOR_MAP.request` / `.demand` in the presets file do the renaming from the API's snake_case.
A `PENDING_SANCTION` demand plots as `SANCTIONED`; set `status: 'EXECUTING'` (and `progress`)
from the simulator when a block goes live.

## Theming

Every colour goes through a `--cs-*` token that falls back to the app's token, then to a built-in
default. On a page that defines `--bg-surface`, `--text-primary`, `--color-primary` and so on
(style.css does), the strip adopts them. On a bare page it still looks right.

Dark mode: set `data-theme="dark"` on `<html>` (or on the host). If the app supplies dark tokens
those win; otherwise the built-in dark palette is used.

Overridable, on `:root` or the host: `--bg-surface --bg-subtle --border-color --text-primary
--text-secondary --text-muted --text-subtle --color-primary --rail --tie --band --sev-critical
--sev-high --sev-medium --sev-low --dept-track --dept-ohe --dept-sig --font-main --font-mono
--card-bg --card-border`.

## Behaviour worth knowing

- **The lens is bounded, not a d3 fisheye.** A plain fisheye pays for magnification by compressing
  everything toward the two ends — hover the middle and the corridor evacuates to the edges. This
  one spreads the compression thinly across the rest of the strip instead: 6× under the cursor,
  1.3× at 100px, 0.7× at 400px, ends pinned. It is strictly monotonic at every magnification
  (verified — zero folds), and `magnify: 1` is an exact identity, which is what lets it animate.
- **Labels fade on room, not thresholds.** A station code shows only while its warped neighbours
  leave space for it, so codes dissolve out of a compressed region instead of colliding. Chainage
  appears when there is room for it. Ruler numbers within 17px of a gridline give way to it.
- **Gridlines break around the code** rather than sitting under an opaque chip (which would punch
  a hole in the band). Where a code fades out, the line closes back up.
- **Nothing rebuilds per frame.** DOM is built once; one `gsap.ticker` callback writes transforms
  and hit-tests by nearest dot on the cursor's rail. An unhovered strip costs one comparison per
  frame; one scrolled offscreen costs nothing.
- `prefers-reduced-motion` disables the pulses and the lens glide.

## Changing it

```
cd ui-kit/corridor-strip/source
npm install
npm run build     # rewrites ../corridor-strip.js + .css, and dist/ for bundled consumers
```

Source is `source/src/`: `strip.ts` (the element), `card.ts` (the popup), `lens.ts` (the maths),
`styles.css`, `react.tsx` (wrapper). The only runtime dependency is GSAP, bundled into the served
file; React is an optional peer for the wrapper only.

## Known limits

- Dots are not individually keyboard-focusable; `Esc` is the only key.
- `magnify` is a peak *request* — at the strip ends the achievable peak drops (≈4.1× for `6`),
  since there is less room on the short side to borrow from.
- The two narrowest sections (GZB→DER, TDL→FZD) do not register as bands at normal panel widths;
  the gridlines carry those, not the tint.
