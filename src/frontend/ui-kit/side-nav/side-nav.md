---
title: Floating Side Nav
description: Config-driven, side-mounted floating navigation rail with collapsible subpages, a sliding hover highlight, flyout submenus and automatic active-route detection.
stack: Vanilla JS + CSS — no build step, no dependencies
inspired-by: ui_factory/file-tree (sliding highlight + spring branch collapse)
---

## What it is

A floating navigation panel mounted to the left or right edge of the viewport.
It sits as a narrow **icon rail** and expands to a **full labelled panel** on
hover (or click, or permanently pinned). Pages nest into subpages to any depth;
while collapsed, a group's subpages open in a **flyout** beside the rail.

Everything is driven by one config object, so a page author adds a page by
adding an entry to an array — no markup and no CSS.

## Files

| File | Purpose |
| --- | --- |
| `side-nav.css` | All styling. Namespaced `.sn-*`, themed through `--sn-*` variables. |
| `side-nav.js` | The component. Exposes the global `SideNav`. |
| `nav.config.js` | **The file the team edits.** Per-portal page trees as `NAV_PRESETS`. |
| `demo.html` | Standalone playground — open it directly in a browser, no server needed. |

## Install into a page

```html
<link rel="stylesheet" href="/static/ui-kit/side-nav/side-nav.css">

<script src="/static/ui-kit/side-nav/side-nav.js"></script>
<script src="/static/ui-kit/side-nav/nav.config.js"></script>
<script>
  const nav = SideNav.create(NAV_PRESETS.tms);
</script>
```

That is the whole integration. The active page is derived from
`location.pathname` (plus `#hash` when the item defines one), so the same
snippet works unchanged on every page.

> **Serving the files.** `/static` is mounted on `Railways/src/frontend`, so
> either copy this folder to `Railways/src/frontend/ui-kit/side-nav/`, or add
> a second mount in `Railways/src/api/main.py`:
>
> ```python
> app.mount("/ui-kit", StaticFiles(directory=BASE_DIR / "ui-kit"), name="ui_kit")
> ```
>
> and reference `/ui-kit/side-nav/side-nav.css`.

### Without writing any JS

Drop the config into a JSON script tag and let the component boot itself:

```html
<script src="/static/ui-kit/side-nav/side-nav.js" data-auto></script>
<script type="application/json" data-side-nav>
{
  "brand": { "label": "Track Management", "crest": "TMS" },
  "items": [
    { "id": "home", "label": "Requisition Desk", "href": "/tms", "icon": "dashboard" },
    { "id": "map",  "label": "Corridor Map",     "href": "/tms#map", "icon": "map" }
  ]
}
</script>
```

## Defining pages and subpages

An item is a page. Give it `children` and it becomes a group whose children are
its subpages. Nesting has no depth limit.

```js
{
  id: 'corridor',              // stable id — setActive()/updateItem() address this
  label: 'Corridor View',
  icon: 'map',
  href: '/#corridor',          // optional: a group can also be a real page
  defaultOpen: true,
  badge: '3',
  badgeTone: 'warn',
  children: [
    { id: 'corridor-map',   label: 'Network Map',   href: '/#corridor-map' },
    { id: 'corridor-marey', label: 'Marey Diagram', href: '/#marey' },
    {
      id: 'corridor-yards', label: 'Station Yards', icon: 'track',
      children: [
        { id: 'yard-ndls', label: 'New Delhi', href: '/#yard-ndls' },
        { id: 'yard-cnb',  label: 'Kanpur',    href: '/#yard-cnb' }
      ]
    }
  ]
}
```

Two structural item types need no `href`:

```js
{ type: 'section', label: 'Operations' }   // small uppercase heading
{ type: 'divider' }                        // hairline rule
```

### Item fields

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | Stable id. Auto-generated if omitted, but supply one if you'll target the item later. |
| `label` | `string` | Row text. |
| `type` | `'item' \| 'group' \| 'section' \| 'divider'` | Inferred: `group` when `children` exist, else `item`. |
| `href` | `string` | Renders the row as `<a>`. Omit for a pure toggle group. |
| `target` | `string` | e.g. `'_blank'` (adds `rel="noopener"`). |
| `icon` | `string` | Built-in name, raw `<svg>…</svg>`, image URL, or an emoji/short glyph. |
| `children` | `Item[]` | Subpages. |
| `defaultOpen` | `boolean` | Group starts expanded. |
| `badge` | `string \| number` | Count pill; shows as a coloured dot when the rail is collapsed. |
| `badgeTone` | `'warn' \| 'danger' \| 'ok' \| 'muted'` | Badge colour. Defaults to the accent. |
| `meta` | `string` | Small monospace text on the right (shortcut hint, code). |
| `disabled` | `boolean` | Dimmed and non-interactive. |
| `onClick` | `(node, event) => boolean` | Return `false` to cancel navigation. |
| `match` | `RegExp \| (location, node) => boolean` | Custom active-route test. |

### Built-in icons

`home` `dashboard` `map` `train` `track` `calendar` `clock` `chart` `bars`
`wrench` `bolt` `signal` `shield` `alert` `bell` `file` `folder` `clipboard`
`layers` `database` `users` `user` `gear` `search` `book` `power` `logout`
`back` `dot` `chevron` `menu` `close`

Add your own once, globally:

```js
SideNav.registerIcons({ yard: 'M3 4h18M3 10h18M3 16h12' });   // 24×24 stroke path
```

## Options

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `items` | `Item[]` | `[]` | The page tree. |
| `footer` | `Item[]` | `[]` | Items pinned to the bottom of the panel. |
| `brand` | `{ label, sub, crest, icon, href }` | — | Header block. `crest` is 2–3 letters. |
| `side` | `'left' \| 'right'` | `'left'` | Which edge it mounts to. |
| `align` | `'center' \| 'top' \| 'bottom' \| 'stretch'` | `'center'` | Vertical placement. |
| `mode` | `'hover' \| 'click' \| 'pinned'` | `'hover'` | How the rail expands. |
| `theme` | `'light' \| 'dark'` | `'light'` | Panel surface. |
| `accent` | `string` | `--color-primary` | Brand crest / FAB colour. |
| `accentInk` | `string` | `--color-blue` | Active-row colour. |
| `width` | `number` | `250` | Expanded width in px. |
| `railWidth` | `number` | `58` | Collapsed width in px. |
| `offset` | `number` | `16` | Gap from the viewport edges in px. |
| `activeId` | `string` | — | Force the active page instead of deriving it. |
| `activeMatch` | `'pathname' \| 'exact' \| 'none'` | `'pathname'` | `pathname` also matches path prefixes (longest wins). |
| `autoOpenActive` | `boolean` | `true` | Expand the ancestors of the active page. |
| `defaultOpenIds` | `string[]` | `[]` | Groups open on first render. |
| `accordion` | `boolean` | `false` | Opening a group closes its siblings. |
| `collapsible` | `boolean` | `true` | Allow collapsing to the rail. |
| `showToggle` | `boolean` | `true` | The pin tab on the panel edge. |
| `compact` | `boolean` | `true` | Below 860px, become a floating button + drawer. |
| `storageKey` | `string` | `null` | `localStorage` key for pinned/expanded state. |
| `offsetSelector` | `string` | `null` | CSS selector for a wrapper to pad, so content isn't overlapped. |
| `hoverDelay` | `number` | `90` | ms before hover-expand and before flyouts. |
| `closeDelay` | `number` | `260` | ms before collapsing after the pointer leaves. |
| `onNavigate` | `(node, event) => boolean` | — | Return `false` to cancel navigation (SPA routing hook). |
| `onToggle` | `(isOpen, instance) => void` | — | Fires on expand/collapse. |
| `mount` | `Element \| string` | `document.body` | Where the root is appended. |
| `vars` | `Record<string,string>` | — | Raw `--sn-*` overrides for one instance. |

## Instance API

```js
const nav = SideNav.create(config);

nav.open();  nav.close();  nav.toggle();     // expansion
nav.togglePinned();                           // pin open / unpin
nav.expand('corridor');  nav.collapse('corridor');
nav.toggleGroup('corridor');

nav.setActive('corridor-marey');              // highlight a page by id
nav.refreshActive();                          // re-derive from the URL

nav.updateItem('demands', { badge: 7, badgeTone: 'danger' });
nav.updateItem('simulator', { disabled: true });

nav.setItems(newItems, newFooter);            // swap the whole tree (e.g. by role)
nav.destroy();
```

`SideNav.create()` returns the instance; `SideNav.get()` returns the first one
created, and `SideNav.instances` holds them all.

### Live badge counts

```js
setInterval(async () => {
  const res = await fetch('/api/demand/pending');
  const rows = await res.json();
  nav.updateItem('demands', {
    badge: rows.length || null,
    badgeTone: rows.length > 5 ? 'danger' : 'warn'
  });
}, 30000);
```

## Theming

Every colour is a CSS variable that falls back to the tokens already defined in
`style.css` (`--bg-surface`, `--text-primary`, `--color-primary`, …), so the nav
inherits the portal's look with no configuration. To restyle one instance:

```js
SideNav.create({
  accentInk: '#047857',                 // S&T emerald
  vars: {
    '--sn-radius': '12px',
    '--sn-row-h': '34px',
    '--sn-dur': '220ms'
  },
  items: [...]
});
```

Departmental accents are already wired up in `nav.config.js` (`NAV_ACCENT`):
navy for OCC, steel blue for TMS, amber for TDMS, emerald for SMMS.

## Behaviour notes

- **Sliding highlight.** One highlight element springs between rows rather than
  each row painting its own hover background — taken from the file-tree
  reference. It hides on scroll and on pointer-leave.
- **Spring collapse.** Subpage groups animate `height: 0 → scrollHeight → auto`,
  so nested content stays measurable after opening.
- **Collapsed rail.** Subpages are hidden on the rail and open as a flyout
  positioned beside the hovered row, clamped to the viewport.
- **Active detection.** Exact path beats prefix; an item with a `#hash` only
  matches when the hash matches too, so hash-linked subpages resolve correctly
  on single-page portals. Listens to `hashchange`.
- **Keyboard.** `↑`/`↓` move between visible rows, `→` expands a group (or steps
  in), `←` collapses or jumps to the parent, `Home`/`End` jump to the ends,
  `Esc` collapses the panel. Rows carry `aria-expanded` and `aria-current="page"`.
- **Small screens.** Under 860px the rail is replaced by a floating button that
  opens the panel as a drawer over a scrim.
- **Reduced motion.** All transitions collapse to ~0ms under
  `prefers-reduced-motion: reduce`.

## Layout: float over vs. push content

By default the nav floats over the page. If a page's content would sit under
the rail, pad the wrapper:

```js
SideNav.create({ offsetSelector: '.app-container', ...config });
```

The padding is applied on the mounted side and updates when the nav is pinned
or unpinned, and is removed on small screens. Adding the `sn-page-offset` class
to that wrapper makes the change animate with the panel.
