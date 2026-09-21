# UI-Kit · Animated List

A real-time push feed where new items animate in from the top with spring
physics — Stripe Radar style. Ported from the `animated-list` React reference
in `ui_factory` to the ui-kit idiom: **vanilla JS, no build step, no
dependencies**, one global (`window.AnimatedList`), namespaced CSS (`.al-*`),
colours read from the portal's existing design tokens.

What it reproduces from the reference:

| Reference (React + motion)                  | Here                                                        |
| ------------------------------------------- | ----------------------------------------------------------- |
| `spring({ stiffness: 350, damping: 28 })`   | Same spring, integrated once and handed to WAAPI as `linear()` easing |
| `AnimatePresence mode="popLayout"`          | Exiting rows are lifted out of flow the instant they leave   |
| `layout` prop (rows glide to new positions) | FLIP pass on every update                                    |
| `animation`: scale / slide / fade / bounce  | Same four variants, same numbers, plus `none`                |
| `maxVisible`, `gap`, `className`            | Same                                                         |
| Stable `id` per item                        | Same — `key` option, defaults to `'id'`                      |

Open `demo.html` directly in a browser to see it.

---

## Files

```
ui-kit/animated-list/
├── animated-list.js     the module            (required)
├── animated-list.css    mechanics + row kit   (required)
├── list.presets.js      ready-made row types for our API payloads (optional)
├── animated-list.md     this file
└── demo.html            standalone playground
```

Serve the folder as `/static/ui-kit/animated-list/` alongside `side-nav`.

## Quick start

```html
<link rel="stylesheet" href="/static/ui-kit/animated-list/animated-list.css">
<script src="/static/ui-kit/animated-list/animated-list.js"></script>
<script src="/static/ui-kit/animated-list/list.presets.js"></script>

<div id="occ-event-feed"></div>

<script>
  // 1. A preset — zero row markup to write:
  var feed = AnimatedList.create(LIST_PRESETS.eventFeed('#occ-event-feed'));

  // 2. Push whatever the API sends. Newest goes on top.
  feed.prepend({ event_id: 'EVT-1', kind: 'BLOCK_STARTED', department: 'ENGINEERING_TRACK',
                 severity: 'info', title: 'Block live', message: 'GZB–DER UP, KM 28.5',
                 ref_id: 'DMD-TMS-101', sim_time: new Date().toISOString() });

  // 3. Or replace the whole list — the diff works out enters / exits / moves:
  fetch('/api/sim/events').then(r => r.json()).then(d => feed.setItems(d.events));
</script>
```

Without presets, give it your own renderer:

```js
var list = AnimatedList.create({
  target: '#my-list',
  renderItem: function (item, index) {
    return '<div class="al-row"><div class="al-row-title">' + item.message + '</div></div>';
  }
});
```

`renderItem` may return an **HTML string** or an **Element**. Everything you
interpolate from an API payload must be escaped — `LIST_PRESETS.render.esc`
is there for that.

---

## API

### `AnimatedList.create(options) → list`

| Option         | Type                                       | Default     | Notes |
| -------------- | ------------------------------------------ | ----------- | ----- |
| `target`       | `string \| Element`                        | —           | Selector or element the list mounts into. **Required.** |
| `items`        | `T[]`                                      | `[]`        | Initial items. Index 0 = newest (see `newest`). |
| `key`          | `string \| (item, i) => string`            | `'id'`      | Stable unique id per item. Enter/exit/move tracking depends on this. |
| `renderItem`   | `(item, i) => string \| Element`           | —           | Row content. **Required** unless a preset supplies it. |
| `updateItem`   | `(inner, item, i) => void`                 | `null`      | Optional in-place update for a row whose item changed. Falls back to re-running `renderItem`. |
| `signature`    | `(item) => string`                         | `null`      | If set, a row is only re-rendered when its signature changes — use when the API re-sends equal-but-not-identical objects on every poll. |
| `maxVisible`   | `number`                                   | `8`         | Older items beyond this are dropped (animated out). `0` = unlimited. |
| `gap`          | `number` (px)                              | `12`        | Space between rows. |
| `animation`    | `'scale' \| 'slide' \| 'fade' \| 'bounce' \| 'none'` | `'scale'` | Enter/exit variant. |
| `newest`       | `'top' \| 'bottom'`                        | `'top'`     | Which end new items appear at. `'bottom'` makes rows rise in (chat-log style). |
| `className`    | `string`                                   | `''`        | Extra classes on the root. `al-compact` and `al-bare` are provided. |
| `stiffness`, `damping`, `mass` | `number`                   | `350, 28, 1`| The spring. Same numbers as framer's. |
| `exitDuration` | `number` (ms)                              | `150`       | Exit fade length. |
| `live`         | `'polite' \| 'assertive' \| false`         | `'polite'`  | `aria-live` on the list. |
| `empty`        | `string \| Element`                        | `''`        | Shown when there are no rows. Empty string = nothing. |
| `pauseOnHover` | `boolean`                                  | `false`     | Hold incoming updates while the pointer is inside; shows an "N new items" pill. Right thing for a fast ticker the operator needs to read. |
| `reducedMotion`| `'auto' \| 'always' \| 'never'`            | `'auto'`    | `auto` honours the OS setting and renders instantly. |
| `onItemClick`  | `(item, i, event) => void`                 | `null`      | Delegated click on a row. |
| `onEnter`, `onExit` | `(item, i, node) => void`             | `null`      | Lifecycle hooks. |

### Instance methods

All return the instance, so they chain.

| Method                    | Does |
| ------------------------- | ---- |
| `setItems(items)`         | Replace the list. Diffs by key; enters, exits and moves are all animated. This is the primitive everything else calls. |
| `prepend(item)` / `push(item)` | Add at the newest end. |
| `append(item)`            | Add at the oldest end. |
| `remove(key)`             | Remove one item by key. |
| `update(key, patch)`      | Shallow-merge `patch` into one item and repaint just that row. |
| `getItems()`              | Copy of the current items (the full array, not just the visible window). |
| `clear()`                 | Remove everything. |
| `refresh()`               | Re-run the renderer on every row in place, no animation — for clock ticks, unit toggles. |
| `pause()` / `resume()`    | Hold / release incoming updates manually. |
| `setOption(name, value)`  | Change `gap`, `animation`, `maxVisible`, `newest`, `empty`, `renderItem` … live. |
| `destroy()`               | Cancel animations, unbind, remove DOM. |

### Module

| Member                     | Does |
| -------------------------- | ---- |
| `AnimatedList.instances`   | Live array of every list on the page. |
| `AnimatedList.get(id)`     | Look one up by its `al-N` id. |
| `AnimatedList.destroyAll()`| Tear down everything — call on SPA-style view swaps. |
| `AnimatedList.variants`    | The variant table, in case you want to read the numbers. |

---

## Presets (`list.presets.js`)

Exposes `window.LIST_PRESETS`. Each is `preset(target, overrides?)` and returns
an options object for `AnimatedList.create`. They're shaped around payloads the
API already serves, so a page usually needs no row code at all.

| Preset          | Payload shape                                  | Key           | Look |
| --------------- | ---------------------------------------------- | ------------- | ---- |
| `eventFeed`     | `sim_events.json` events                        | `event_id`    | compact cards, `pauseOnHover` on |
| `demandQueue`   | `pending_demands.json` demands                  | `demand_id`   | cards, priority chips, slide variant |
| `fieldReports`  | `worker_requests.json` requests                 | `request_id`  | cards, slide variant |
| `notices`       | ad-hoc `{ id, title, message, severity, tag }`  | `id`          | `al-bare` rules, bounce variant |

Overrides are shallow-merged on top, so per-page tweaks stay in the page:

```js
var q = AnimatedList.create(LIST_PRESETS.demandQueue('#occ-demand-list', {
  maxVisible: 20,
  onItemClick: function (dm) { openDemandReview(dm.demand_id); }
}));
```

`LIST_PRESETS.render` exposes the building blocks (`row`, `chip`, `refChip`,
`esc`, `clock`, `duration`, `chainage` and the four renderers) so one-off rows
can share the visual language without copying markup.

**Adding a row type:** write a renderer in `list.presets.js`, add a preset
below it, done. Every page picks it up on the next load.

---

## Row kit (CSS)

`animated-list.css` ships an optional card language matching the OCC desk.
Use it or ignore it — the mechanics don't depend on it.

```html
<div class="al-row al-sev-critical al-dept-track is-clickable">
  <div class="al-row-head">
    <span class="al-row-dot is-live"></span>
    <span class="al-row-title">Rail Flaw (USFD)</span>
    <span class="al-row-time">21:40</span>
  </div>
  <div class="al-row-body is-clamped">Track Patrol Gang A reported …</div>
  <div class="al-row-meta">
    <span class="al-chip is-critical">CRITICAL</span>
    <span class="al-chip">GZB – DER</span>
    <span class="al-chip is-ref">DMD-TMS-101</span>
  </div>
</div>
```

- Left-edge accent: `al-sev-{critical|warning|success|info|muted}` or
  `al-dept-{track|ohe|sig|bundle}` (department wins if both are present since
  it's declared later).
- `al-row-dot.is-live` pulses — for "block live" rows.
- `al-row-body.is-clamped` clamps to two lines.
- Root densities: `al-compact` (tighter cards), `al-bare` (rules, no cards —
  for narrow side panels).

Every colour is an `--al-*` variable that falls back to the page tokens
(`--bg-surface`, `--text-primary`, `--color-crimson`, `--dept-track-text` …),
so per-instance theming is one override:

```css
#tdms-feed .al-root { --al-accent: #b45309; }
```

---

## How it works (for whoever maintains it)

Every `setItems` is one FLIP pass:

1. **First** — measure where every live row sits.
2. **Exit** — rows whose key is gone get `position:absolute` at their measured
   spot (out of flow → the gap below them starts closing immediately; this is
   `popLayout`) and fade on a 150 ms ease-in, then are removed.
3. **Reconcile** — create new rows (pre-painted at the variant's `initial`
   frame so there is no flash), refresh changed rows, reorder DOM nodes to
   match the new order. Surviving nodes are reused, never recreated.
4. **Last / Invert / Play** — measure again, translate survivors back to where
   they were, animate to zero on the spring. New rows play their enter variant.

Two layers per row on purpose: `.al-item` carries only the FLIP translate,
`.al-item-inner` carries only the enter/exit opacity + transform. That's why a
row can be re-sorted while it is still entering without the two animations
fighting over `transform`.

The spring is a damped harmonic oscillator integrated at 240 Hz until it
settles, sampled to 43 points and emitted as a CSS `linear()` easing. Browsers
without `linear()` (pre-2023) get a `cubic-bezier(0.22, 1, 0.36, 1)` fallback.
Browsers without WAAPI at all get instant updates with no animation and no
errors.

## Notes

- Items **must** have a stable unique key. Two items with the same key in one
  update: the first wins, the second is ignored.
- `getItems()` returns the full array you gave it, not just the visible
  window — `maxVisible` is a render cap, not a data cap. If you stream all day,
  slice on your side: `feed.setItems(all.slice(0, 200))`.
- A row that is re-added while it is still fading out is reclaimed in place —
  no flicker, no duplicate.
- `pauseOnHover` swallows updates into a pending array and applies them all at
  once on leave, so the operator never has a row yanked from under the cursor.
- Not a virtual list. It is for feeds of a dozen or two rows, not tables of a
  thousand. Use `maxVisible`.
