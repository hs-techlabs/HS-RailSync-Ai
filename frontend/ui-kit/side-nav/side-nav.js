/* ==========================================================================
   UI-KIT · FLOATING SIDE-MOUNTED NAV BAR  (side-nav)
   Vanilla JS. No build step, no dependencies. UMD-ish global: window.SideNav
   --------------------------------------------------------------------------
   Quick start:

     <link rel="stylesheet" href="/static/ui-kit/side-nav/side-nav.css">
     <script src="/static/ui-kit/side-nav/side-nav.js"></script>
     <script>
       SideNav.create({
         brand: { label: 'Block Planning', sub: 'NDLS–CNB', crest: 'IR' },
         items: [
           { id: 'occ', label: 'Control Desk', href: '/', icon: 'home' },
           { id: 'tms', label: 'Track (TMS)', icon: 'wrench', children: [
             { id: 'tms-req', label: 'Requisitions', href: '/tms' },
             { id: 'tms-map', label: 'Corridor Map', href: '/tms#map' }
           ]}
         ]
       });
     </script>

   Full docs in side-nav.md
   ========================================================================== */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.SideNav = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var SVG_NS = 'http://www.w3.org/2000/svg';
    var instances = [];
    var uid = 0;

    /* ======================================================================
       Built-in icon set — 24x24 stroke paths, Fluent/Lucide flavoured so it
       sits naturally beside the icons already used across the portals.
       ====================================================================== */
    var ICONS = {
        home: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5M9.5 20v-6h5v6',
        dashboard: 'M3 3h7v8H3zM14 3h7v5h-7zM14 11h7v10h-7zM3 14h7v7H3z',
        map: 'M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4zM8 2v16M16 6v16',
        train: 'M8 3h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zM5 10h14M8.5 13.5h.01M15.5 13.5h.01M7 21l2-3M17 21l-2-3',
        track: 'M6 2v20M18 2v20M3 7h18M3 12h18M3 17h18',
        calendar: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 9h18M8 2v4M16 2v4',
        clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3.2 1.9',
        chart: 'M3 3v18h18M7 15l3.5-4 3 2.6L20 7',
        bars: 'M4 20V10M10 20V4M16 20v-7M22 20v-3',
        wrench: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
        bolt: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
        signal: 'M12 20V9M12 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 20h8M5 13a7 7 0 0 1 0-4M19 13a7 7 0 0 0 0-4',
        shield: 'M12 3l8 3v6c0 5-3.4 8.3-8 9-4.6-.7-8-4-8-9V6z',
        alert: 'M12 3 2 20h20zM12 9v5M12 17.5h.01',
        bell: 'M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7M13.7 20a2 2 0 0 1-3.4 0',
        file: 'M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7zM14 2v5h5M9 13h6M9 17h4',
        folder: 'M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
        clipboard: 'M9 4H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2M9 4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1H9zM9 12h6M9 16h4',
        layers: 'M12 2 2 8l10 6 10-6zM2 14l10 6 10-6M2 11l10 6 10-6',
        database: 'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
        users: 'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-2a4 4 0 0 0-3-3.9M16 2.1a4 4 0 0 1 0 7.8',
        user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
        gear: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H1a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 2.6 7a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 8 2.6h.1A1.7 1.7 0 0 0 9.3 1V1a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 16 2.6a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.6 1h.2a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1z',
        search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
        book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
        power: 'M12 3v9M18.4 6.6a9 9 0 1 1-12.8 0',
        logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
        back: 'M19 12H5M12 19l-7-7 7-7',
        dot: 'M12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
        chevron: 'M9 18l6-6-6-6',
        chevronLeft: 'M15 18l-6-6 6-6',
        menu: 'M4 7h16M4 12h16M4 17h16',
        close: 'M6 6l12 12M18 6L6 18'
    };

    /* ======================================================================
       Small DOM helpers
       ====================================================================== */
    function el(tag, cls, attrs) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (attrs) for (var k in attrs) if (attrs[k] != null) node.setAttribute(k, attrs[k]);
        return node;
    }

    function svgIcon(path) {
        var svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.setAttribute('aria-hidden', 'true');
        path.split('M').forEach(function (seg) {
            if (!seg.trim()) return;
            var p = document.createElementNS(SVG_NS, 'path');
            p.setAttribute('d', 'M' + seg.trim());
            svg.appendChild(p);
        });
        return svg;
    }

    /**
     * icon can be: a built-in name, a raw '<svg…>' string, an image URL,
     * or any short text/emoji used as a glyph.
     */
    function renderIcon(icon, fallback) {
        var host = el('span', 'sn-icon');
        var value = icon || fallback;
        if (!value) return host;

        if (ICONS[value]) {
            host.appendChild(svgIcon(ICONS[value]));
        } else if (typeof value === 'string' && value.trim().charAt(0) === '<') {
            host.innerHTML = value;                          // caller-supplied markup
        } else if (/^(https?:|\/|\.\/|data:image)/.test(value) && /\.(svg|png|jpe?g|webp|gif)(\?|$)|^data:image/.test(value)) {
            host.appendChild(el('img', null, { src: value, alt: '' }));
        } else {
            var glyph = el('span', 'sn-icon-glyph');
            glyph.textContent = value;
            host.appendChild(glyph);
        }
        return host;
    }

    function normalizePath(href) {
        if (!href) return null;
        if (/^(https?:|mailto:|tel:|#)/.test(href)) {
            if (href.charAt(0) === '#') return null;
            try {
                var u = new URL(href, window.location.origin);
                if (u.origin !== window.location.origin) return null;
                return u.pathname.replace(/\/+$/, '') || '/';
            } catch (e) { return null; }
        }
        return href.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
    }

    function storage(key) {
        return {
            get: function () {
                if (!key) return null;
                try { return JSON.parse(window.localStorage.getItem(key) || 'null'); }
                catch (e) { return null; }
            },
            set: function (value) {
                if (!key) return;
                try { window.localStorage.setItem(key, JSON.stringify(value)); }
                catch (e) { /* private mode — state is simply not persisted */ }
            }
        };
    }

    function prefersReducedMotion() {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    /* ======================================================================
       Config normalisation — turns the author-facing item list into an
       internal tree with resolved ids, parents and depth.
       ====================================================================== */
    function buildTree(items, parent, depth, index) {
        return (items || []).map(function (raw, i) {
            var node = {
                id: raw.id || (parent ? parent.id + '.' : '') + 'n' + (index ? index() : i),
                type: raw.type || (raw.children && raw.children.length ? 'group' : 'item'),
                label: raw.label != null ? raw.label : (raw.name || ''),
                href: raw.href || null,
                target: raw.target || null,
                icon: raw.icon || null,
                badge: raw.badge != null ? raw.badge : null,
                badgeTone: raw.badgeTone || raw.tone || null,
                meta: raw.meta || null,
                disabled: !!raw.disabled,
                defaultOpen: !!raw.defaultOpen,
                onClick: typeof raw.onClick === 'function' ? raw.onClick : null,
                data: raw.data || null,
                match: raw.match || null,
                depth: depth,
                parent: parent,
                raw: raw,
                children: []
            };
            if (raw.children && raw.children.length) {
                node.children = buildTree(raw.children, node, depth + 1);
            }
            return node;
        });
    }

    function walk(nodes, fn) {
        nodes.forEach(function (n) {
            fn(n);
            if (n.children.length) walk(n.children, fn);
        });
    }

    /* ======================================================================
       Instance
       ====================================================================== */
    function SideNavInstance(options) {
        var self = this;
        var opts = options || {};

        this.id = 'sn' + (++uid);
        this.options = {
            side: opts.side === 'right' ? 'right' : 'left',
            align: opts.align || 'center',
            offset: opts.offset != null ? opts.offset : 16,
            width: opts.width || 250,
            railWidth: opts.railWidth || 58,
            mode: opts.mode || 'hover',            // 'hover' | 'click' | 'pinned'
            theme: opts.theme || 'light',          // 'light' | 'dark'
            accent: opts.accent || null,
            accentInk: opts.accentInk || null,
            brand: opts.brand || null,
            items: opts.items || [],
            footer: opts.footer || [],
            activeId: opts.activeId || null,
            activeMatch: opts.activeMatch || 'pathname',   // 'pathname' | 'exact' | 'none'
            defaultOpenIds: opts.defaultOpenIds || [],
            autoOpenActive: opts.autoOpenActive !== false,
            accordion: !!opts.accordion,
            collapsible: opts.collapsible !== false,
            showToggle: opts.showToggle !== false,
            compact: opts.compact !== false,       // drawer behaviour on small screens
            storageKey: opts.storageKey || null,
            offsetSelector: opts.offsetSelector || null,
            hoverDelay: opts.hoverDelay != null ? opts.hoverDelay : 90,
            closeDelay: opts.closeDelay != null ? opts.closeDelay : 260,
            onNavigate: typeof opts.onNavigate === 'function' ? opts.onNavigate : null,
            onToggle: typeof opts.onToggle === 'function' ? opts.onToggle : null,
            mount: opts.mount || document.body
        };

        this.store = storage(this.options.storageKey);
        this.nodes = buildTree(this.options.items, null, 0);
        this.footerNodes = buildTree(this.options.footer, null, 0);
        this.index = {};
        this.rowOf = {};
        this.expanded = {};
        this.isOpen = false;
        this.pinned = this.options.mode === 'pinned';
        this.activeNode = null;
        this._hoverTimer = null;
        this._closeTimer = null;
        this._flyoutTimer = null;
        this._highlightPrimed = false;

        walk(this.nodes.concat(this.footerNodes), function (n) { self.index[n.id] = n; });

        this._restoreState();
        this._resolveActive();
        this._render();
        this._bind();
        this._syncOpen(this.pinned, true);
        this._applyPageOffset();
    }

    /** True when the compact drawer layout is in effect (matches the CSS query). */
    SideNavInstance.prototype._isNarrow = function () {
        return this.options.compact && window.matchMedia('(max-width: 860px)').matches;
    };

    /* ---------------------------------------------------------------- state */

    SideNavInstance.prototype._restoreState = function () {
        var saved = this.store.get() || {};
        var self = this;

        this.options.defaultOpenIds.forEach(function (id) { self.expanded[id] = true; });
        walk(this.nodes, function (n) { if (n.defaultOpen) self.expanded[n.id] = true; });

        if (saved.expanded) {
            Object.keys(saved.expanded).forEach(function (id) {
                if (self.index[id]) self.expanded[id] = !!saved.expanded[id];
            });
        }
        if (typeof saved.pinned === 'boolean' && this.options.mode !== 'hover') {
            this.pinned = saved.pinned;
        } else if (typeof saved.pinned === 'boolean' && this.options.collapsible) {
            this.pinned = saved.pinned;
        }
    };

    SideNavInstance.prototype._persist = function () {
        this.store.set({ expanded: this.expanded, pinned: this.pinned });
    };

    /* --------------------------------------------------------- active route */

    SideNavInstance.prototype._resolveActive = function () {
        var self = this;
        var explicit = this.options.activeId;

        if (explicit && this.index[explicit]) {
            this.activeNode = this.index[explicit];
        } else if (this.options.activeMatch !== 'none') {
            var here = normalizePath(window.location.pathname);
            var hash = window.location.hash || '';
            var best = null;
            var bestScore = -1;

            walk(this.nodes.concat(this.footerNodes), function (n) {
                if (!n.href) return;
                var score = -1;

                if (typeof n.match === 'function') {
                    score = n.match(window.location, n) ? 1000 : -1;
                } else if (n.match instanceof RegExp) {
                    score = n.match.test(window.location.pathname + hash) ? 900 : -1;
                } else {
                    var target = normalizePath(n.href);
                    if (target == null) return;
                    var nodeHash = n.href.indexOf('#') > -1 ? n.href.slice(n.href.indexOf('#')) : '';
                    if (target === here) {
                        // Exact path. A matching hash outranks a bare path.
                        score = nodeHash ? (nodeHash === hash ? 800 : -1) : 500;
                    } else if (self.options.activeMatch === 'pathname' && target !== '/' &&
                               here.indexOf(target + '/') === 0) {
                        score = 100 + target.length;       // longest prefix wins
                    }
                }
                if (score > bestScore) { bestScore = score; best = n; }
            });
            this.activeNode = best;
        }

        if (this.activeNode && this.options.autoOpenActive) {
            var p = this.activeNode.parent;
            while (p) { this.expanded[p.id] = true; p = p.parent; }
        }
    };

    /* -------------------------------------------------------------- render */

    SideNavInstance.prototype._render = function () {
        var o = this.options;
        var self = this;

        var root = el('div', 'sn-root', {
            'data-side': o.side,
            'data-align': o.align,
            'data-theme': o.theme,
            'data-open': 'false',
            'data-pinned': String(this.pinned),
            'data-compact': String(o.compact),
            'data-mode': o.mode,
            'id': this.id
        });
        // The flyout is portalled to <body>, so every per-instance token has to
        // be applied to it as well — it can't inherit them from the root.
        this._applyVars = function (node) {
            node.style.setProperty('--sn-w', o.width + 'px');
            node.style.setProperty('--sn-rail', o.railWidth + 'px');
            node.style.setProperty('--sn-offset', o.offset + 'px');
            if (o.accent) node.style.setProperty('--sn-accent', o.accent);
            if (o.accentInk) {
                node.style.setProperty('--sn-accent-ink', o.accentInk);
                node.style.setProperty('--sn-accent-wash', 'color-mix(in srgb, ' + o.accentInk + ' 11%, transparent)');
                node.style.setProperty('--sn-accent-edge', 'color-mix(in srgb, ' + o.accentInk + ' 26%, transparent)');
            }
            if (o.vars) for (var v in o.vars) node.style.setProperty(v, o.vars[v]);
        };
        this._applyVars(root);

        var panel = el('nav', 'sn-panel', {
            'aria-label': (o.brand && o.brand.label) ? o.brand.label + ' navigation' : 'Section navigation'
        });

        if (o.brand) panel.appendChild(this._renderBrand(o.brand));

        var scroll = el('div', 'sn-scroll');
        var highlight = el('div', 'sn-highlight', { 'data-visible': 'false', 'aria-hidden': 'true' });
        scroll.appendChild(highlight);
        scroll.appendChild(this._renderList(this.nodes, 0));
        panel.appendChild(scroll);

        if (this.footerNodes.length || (o.showToggle && o.collapsible)) {
            var footer = el('div', 'sn-footer');
            if (this.footerNodes.length) footer.appendChild(this._renderList(this.footerNodes, 0));
            if (o.showToggle && o.collapsible) {
                var toggle = el('button', 'sn-toggle', {
                    type: 'button',
                    'aria-label': 'Pin or collapse navigation',
                    title: 'Pin / collapse'
                });
                toggle.appendChild(svgIcon(ICONS.chevron));
                toggle.addEventListener('click', function (e) {
                    e.stopPropagation();
                    self.togglePinned();
                });
                footer.appendChild(toggle);
                this.toggleEl = toggle;
            }
            panel.appendChild(footer);
            this.footerEl = footer;
        }

        var fab = el('button', 'sn-fab', { type: 'button', 'aria-label': 'Open navigation' });
        fab.appendChild(svgIcon(ICONS.menu));
        fab.addEventListener('click', function () { self.toggle(); });

        var scrim = el('div', 'sn-scrim', { 'data-visible': 'false' });
        scrim.addEventListener('click', function () { self.close(true); });

        var flyout = el('div', 'sn-flyout', {
            'data-visible': 'false',
            'data-side': o.side,
            'data-theme': o.theme
        });
        this._applyVars(flyout);

        root.appendChild(panel);
        root.appendChild(fab);
        root.appendChild(scrim);

        (typeof o.mount === 'string' ? document.querySelector(o.mount) : o.mount).appendChild(root);
        document.body.appendChild(flyout);

        this.root = root;
        this.panel = panel;
        this.scroll = scroll;
        this.highlight = highlight;
        this.fab = fab;
        this.scrim = scrim;
        this.flyout = flyout;

        // Expanded groups start open without animating on first paint.
        Object.keys(this.expanded).forEach(function (id) {
            if (self.expanded[id]) self._setExpanded(id, true, true);
        });
    };

    SideNavInstance.prototype._renderBrand = function (brand) {
        var wrap = el(brand.href ? 'a' : 'div', 'sn-brand',
            brand.href ? { href: brand.href } : null);

        var crest = el('div', 'sn-brand-crest');
        if (brand.icon) {
            var ic = renderIcon(brand.icon);
            while (ic.firstChild) crest.appendChild(ic.firstChild);
        } else {
            crest.textContent = brand.crest || (brand.label || '?').slice(0, 2).toUpperCase();
        }
        wrap.appendChild(crest);

        var text = el('div', 'sn-brand-text');
        var title = el('div', 'sn-brand-title');
        title.textContent = brand.label || '';
        text.appendChild(title);
        if (brand.sub) {
            var sub = el('div', 'sn-brand-sub');
            sub.textContent = brand.sub;
            text.appendChild(sub);
        }
        wrap.appendChild(text);
        return wrap;
    };

    SideNavInstance.prototype._renderList = function (nodes, depth) {
        var self = this;
        var list = el('ul', 'sn-list', { role: 'list' });

        nodes.forEach(function (node) {
            if (node.type === 'divider') {
                list.appendChild(el('li', 'sn-divider', { 'aria-hidden': 'true' }));
                return;
            }
            if (node.type === 'section') {
                var section = el('li', 'sn-section');
                var lbl = el('span', 'sn-section-label');
                lbl.textContent = node.label;
                section.appendChild(lbl);
                list.appendChild(section);
                return;
            }

            var item = el('li', 'sn-item', {
                'data-id': node.id,
                'data-depth': String(depth),
                'data-expanded': String(!!self.expanded[node.id])
            });
            item.appendChild(self._renderRow(node));

            if (node.children.length) {
                var wrap = el('div', 'sn-children');
                wrap.appendChild(self._renderList(node.children, depth + 1));
                item.appendChild(wrap);
                node._childrenEl = wrap;
            }

            node._itemEl = item;
            list.appendChild(item);
        });

        return list;
    };

    SideNavInstance.prototype._renderRow = function (node, forFlyout) {
        var self = this;
        var isGroup = node.children.length > 0;
        var isLink = !!node.href;              // a group may also be a real page
        var row = el(isLink ? 'a' : 'button', 'sn-row',
            isLink ? { href: node.href, target: node.target || null,
                       rel: node.target === '_blank' ? 'noopener' : null }
                   : { type: 'button' });

        if (node.disabled) row.setAttribute('aria-disabled', 'true');
        row.setAttribute('data-id', node.id);
        if (isGroup && !forFlyout) {
            row.setAttribute('aria-expanded', String(!!this.expanded[node.id]));
        }

        row.appendChild(renderIcon(node.icon, isGroup ? 'folder' : 'dot'));

        var label = el('span', 'sn-label');
        label.textContent = node.label;
        row.appendChild(label);

        if (node.meta) {
            var meta = el('span', 'sn-meta');
            meta.textContent = node.meta;
            row.appendChild(meta);
        }

        if (node.badge != null && node.badge !== '') {
            var badge = el('span', 'sn-badge', node.badgeTone ? { 'data-tone': node.badgeTone } : null);
            badge.textContent = node.badge;
            row.appendChild(badge);
            if (!forFlyout) {
                row.appendChild(el('span', 'sn-dot', node.badgeTone ? { 'data-tone': node.badgeTone } : null));
            }
        }

        if (isGroup && !forFlyout) {
            var chev = el('span', 'sn-chev', { 'aria-hidden': 'true' });
            chev.appendChild(svgIcon(ICONS.chevron));
            row.appendChild(chev);
        }

        // -- state flags
        if (this.activeNode === node) {
            row.setAttribute('data-active', 'true');
            row.setAttribute('aria-current', 'page');
        } else if (isGroup && this._containsActive(node)) {
            row.setAttribute('data-active-within', 'true');
        }

        // -- interactions
        row.addEventListener('mouseenter', function () {
            if (!forFlyout) self._moveHighlight(row);
            if (!forFlyout && !self.isOpen) self._openFlyout(node, row);
        });

        row.addEventListener('click', function (e) { self._onRowClick(e, node, isGroup, forFlyout); });
        row.addEventListener('keydown', function (e) { self._onRowKey(e, node, row, forFlyout); });

        if (!forFlyout) this.rowOf[node.id] = row;
        return row;
    };

    SideNavInstance.prototype._containsActive = function (node) {
        var found = false;
        var active = this.activeNode;
        if (!active) return false;
        walk(node.children, function (n) { if (n === active) found = true; });
        return found;
    };

    /* --------------------------------------------------------- interactions */

    SideNavInstance.prototype._onRowClick = function (e, node, isGroup, forFlyout) {
        if (node.disabled) { e.preventDefault(); return; }

        // A group with no href toggles; a group with an href navigates and
        // also opens its subpages.
        if (isGroup && !forFlyout) {
            if (!node.href) {
                e.preventDefault();
                this.toggleGroup(node.id);
                return;
            }
            this._setExpanded(node.id, true);
        }

        if (node.onClick) {
            var handled = node.onClick(node, e);
            if (handled === false) { e.preventDefault(); return; }
        }

        if (this.options.onNavigate) {
            var proceed = this.options.onNavigate(node, e);
            if (proceed === false) { e.preventDefault(); return; }
        }

        this._closeFlyout(true);
        if (this._isNarrow()) this.close(true);
    };

    SideNavInstance.prototype._onRowKey = function (e, node, row, forFlyout) {
        var key = e.key;

        if (key === 'ArrowRight' && node.children.length && !forFlyout) {
            e.preventDefault();
            if (!this.expanded[node.id]) this.toggleGroup(node.id);
            else this._focusStep(row, 1);
            return;
        }
        if (key === 'ArrowLeft' && !forFlyout) {
            e.preventDefault();
            if (node.children.length && this.expanded[node.id]) this.toggleGroup(node.id);
            else if (node.parent) {
                var parentRow = this.rowOf[node.parent.id];
                if (parentRow) parentRow.focus();
            }
            return;
        }
        if (key === 'ArrowDown') { e.preventDefault(); this._focusStep(row, 1); return; }
        if (key === 'ArrowUp')   { e.preventDefault(); this._focusStep(row, -1); return; }
        if (key === 'Home' || key === 'End') {
            e.preventDefault();
            var rows = this._visibleRows();
            if (rows.length) rows[key === 'Home' ? 0 : rows.length - 1].focus();
            return;
        }
        if (key === 'Escape') {
            this._closeFlyout(true);
            if (!this.pinned) this.close(true);
        }
    };

    SideNavInstance.prototype._visibleRows = function () {
        return Array.prototype.filter.call(
            this.panel.querySelectorAll('.sn-row'),
            function (r) { return r.offsetParent !== null && r.getAttribute('aria-disabled') !== 'true'; }
        );
    };

    SideNavInstance.prototype._focusStep = function (from, dir) {
        var rows = this._visibleRows();
        var i = rows.indexOf(from);
        if (i === -1) return;
        var next = rows[(i + dir + rows.length) % rows.length];
        if (next) { this.open(); next.focus(); this._moveHighlight(next); }
    };

    /* ----------------------------------------------------- sliding highlight */

    SideNavInstance.prototype._moveHighlight = function (row) {
        if (!this.highlight || !row) return;
        var containerRect = this.scroll.getBoundingClientRect();
        var rect = row.getBoundingClientRect();
        var top = rect.top - containerRect.top + this.scroll.scrollTop;
        var left = rect.left - containerRect.left;

        // The very first appearance should not slide in from the corner.
        if (!this._highlightPrimed) {
            this.highlight.setAttribute('data-warp', 'true');
            this._highlightPrimed = true;
            var h = this.highlight;
            window.setTimeout(function () { h.removeAttribute('data-warp'); }, 30);
        }

        this.highlight.style.width = rect.width + 'px';
        this.highlight.style.height = rect.height + 'px';
        this.highlight.style.transform = 'translate3d(' + left + 'px,' + top + 'px,0)';
        this.highlight.setAttribute('data-visible', 'true');
    };

    SideNavInstance.prototype._hideHighlight = function () {
        if (!this.highlight) return;
        this.highlight.setAttribute('data-visible', 'false');
        this._highlightPrimed = false;
    };

    /* --------------------------------------------------- expand / collapse */

    SideNavInstance.prototype._setExpanded = function (id, open, immediate) {
        var node = this.index[id];
        if (!node || !node.children.length) return;

        var wrap = node._childrenEl;
        var item = node._itemEl;
        if (!wrap || !item) return;

        this.expanded[id] = open;
        item.setAttribute('data-expanded', String(open));
        var row = this.rowOf[id];
        if (row) row.setAttribute('aria-expanded', String(open));

        if (immediate || prefersReducedMotion()) {
            wrap.style.height = open ? 'auto' : '0px';
            return;
        }

        var target = wrap.scrollHeight;
        if (open) {
            wrap.style.height = '0px';
            void wrap.offsetHeight;                          // force reflow
            wrap.style.height = target + 'px';
            var onEnd = function (e) {
                if (e.propertyName !== 'height') return;
                wrap.style.height = 'auto';
                wrap.removeEventListener('transitionend', onEnd);
            };
            wrap.addEventListener('transitionend', onEnd);
        } else {
            wrap.style.height = wrap.scrollHeight + 'px';
            void wrap.offsetHeight;
            wrap.style.height = '0px';
        }
    };

    SideNavInstance.prototype.toggleGroup = function (id) {
        var open = !this.expanded[id];
        var self = this;

        if (open && this.options.accordion) {
            var node = this.index[id];
            var siblings = node.parent ? node.parent.children : this.nodes;
            siblings.forEach(function (s) {
                if (s.id !== id && s.children.length && self.expanded[s.id]) {
                    self._setExpanded(s.id, false);
                }
            });
        }

        this._setExpanded(id, open);
        this._persist();

        // Row geometry shifts as children reveal — re-seat the highlight.
        var row = this.rowOf[id];
        if (row) window.setTimeout(function () { self._moveHighlight(row); }, 0);
        return open;
    };

    /* --------------------------------------------------------------- open  */

    SideNavInstance.prototype._syncOpen = function (open, immediate) {
        this.isOpen = open;
        this.root.setAttribute('data-open', String(open));
        this.root.setAttribute('data-pinned', String(this.pinned));
        this.scrim.setAttribute('data-visible', String(open && this._isNarrow()));
        if (!open) this._closeFlyout(true);
        this._applyPageOffset();
        if (!immediate && this.options.onToggle) this.options.onToggle(open, this);
    };

    SideNavInstance.prototype.open = function () {
        window.clearTimeout(this._closeTimer);
        if (!this.isOpen) this._syncOpen(true);
    };

    SideNavInstance.prototype.close = function (force) {
        window.clearTimeout(this._hoverTimer);
        if (this.pinned && !force) return;
        if (this.isOpen) this._syncOpen(false);
        this._hideHighlight();
    };

    SideNavInstance.prototype.toggle = function () {
        if (this.isOpen) this.close(true); else this.open();
    };

    SideNavInstance.prototype.togglePinned = function () {
        this.pinned = !this.pinned;
        this._syncOpen(this.pinned);
        this._persist();
        return this.pinned;
    };

    SideNavInstance.prototype._applyPageOffset = function () {
        if (!this.options.offsetSelector) return;
        var target = document.querySelector(this.options.offsetSelector);
        if (!target) return;
        var o = this.options;
        var width = (this.pinned ? o.width : o.railWidth) + o.offset * 2;
        target.style[o.side === 'left' ? 'paddingLeft' : 'paddingRight'] =
            this._isNarrow() ? '' : width + 'px';
    };

    /* -------------------------------------------------------------- flyout */

    SideNavInstance.prototype._openFlyout = function (node, row) {
        var self = this;
        window.clearTimeout(this._flyoutTimer);
        if (this._isNarrow()) return;

        this._flyoutTimer = window.setTimeout(function () {
            if (self.isOpen) return;

            self.flyout.innerHTML = '';
            var title = el('div', 'sn-flyout-title');
            title.textContent = node.label;
            self.flyout.appendChild(title);

            if (node.children.length) {
                var list = el('ul', 'sn-list', { role: 'list' });
                node.children.forEach(function (child) {
                    if (child.type === 'divider') { list.appendChild(el('li', 'sn-divider')); return; }
                    if (child.type === 'section') {
                        var s = el('li', 'sn-section');
                        var sl = el('span', 'sn-section-label');
                        sl.textContent = child.label;
                        s.appendChild(sl);
                        list.appendChild(s);
                        return;
                    }
                    var li = el('li', 'sn-item');
                    li.appendChild(self._renderRow(child, true));
                    list.appendChild(li);
                });
                self.flyout.appendChild(list);
            }

            var rect = row.getBoundingClientRect();
            var panelRect = self.panel.getBoundingClientRect();
            self.flyout.setAttribute('data-side', self.options.side);
            self.flyout.style.visibility = 'hidden';
            self.flyout.setAttribute('data-visible', 'true');

            var fh = self.flyout.offsetHeight;
            var top = Math.min(
                Math.max(8, rect.top - 6),
                Math.max(8, window.innerHeight - fh - 8)
            );
            self.flyout.style.top = top + 'px';
            if (self.options.side === 'left') {
                self.flyout.style.left = (panelRect.right + 10) + 'px';
                self.flyout.style.right = '';
            } else {
                self.flyout.style.right = (window.innerWidth - panelRect.left + 10) + 'px';
                self.flyout.style.left = '';
            }
            self.flyout.style.visibility = '';
        }, this.options.hoverDelay);
    };

    SideNavInstance.prototype._closeFlyout = function (immediate) {
        window.clearTimeout(this._flyoutTimer);
        var self = this;
        if (immediate) { this.flyout.setAttribute('data-visible', 'false'); return; }
        this._flyoutTimer = window.setTimeout(function () {
            self.flyout.setAttribute('data-visible', 'false');
        }, 120);
    };

    /* --------------------------------------------------------------- bind */

    SideNavInstance.prototype._bind = function () {
        var self = this;
        var o = this.options;

        if (o.mode === 'hover') {
            this.panel.addEventListener('mouseenter', function () {
                window.clearTimeout(self._closeTimer);
                self._hoverTimer = window.setTimeout(function () { self.open(); }, o.hoverDelay);
            });
            this.panel.addEventListener('mouseleave', function () {
                window.clearTimeout(self._hoverTimer);
                self._closeTimer = window.setTimeout(function () { self.close(); }, o.closeDelay);
                self._hideHighlight();
            });
        } else if (o.mode === 'click') {
            this.panel.addEventListener('click', function (e) {
                if (!self.isOpen && !e.target.closest('.sn-row, .sn-toggle')) self.open();
            });
            document.addEventListener('click', function (e) {
                if (!self.pinned && self.isOpen && !self.root.contains(e.target) &&
                    !self.flyout.contains(e.target)) self.close();
            });
            this.panel.addEventListener('mouseleave', function () { self._hideHighlight(); });
        } else {
            this.panel.addEventListener('mouseleave', function () { self._hideHighlight(); });
        }

        this.flyout.addEventListener('mouseenter', function () {
            window.clearTimeout(self._flyoutTimer);
        });
        this.flyout.addEventListener('mouseleave', function () { self._closeFlyout(); });
        this.panel.addEventListener('mouseleave', function () { self._closeFlyout(); });

        this.scroll.addEventListener('scroll', function () { self._hideHighlight(); });

        // Crossing the compact breakpoint resets the panel: a rail left open by
        // hover must not become an already-open drawer on a small screen.
        this._wasNarrow = this._isNarrow();
        this._onResize = function () {
            var narrow = self._isNarrow();
            if (narrow !== self._wasNarrow) {
                self._wasNarrow = narrow;
                if (narrow) self.close(true);
                else if (self.pinned) self.open();
            }
            self._applyPageOffset();
            self._closeFlyout(true);
        };
        window.addEventListener('resize', this._onResize);

        this._onKey = function (e) {
            if (e.key === 'Escape' && self.isOpen && !self.pinned) self.close(true);
        };
        document.addEventListener('keydown', this._onKey);

        window.addEventListener('hashchange', function () { self.refreshActive(); });
    };

    /* ------------------------------------------------------------ public API */

    /** Replace the whole item list (e.g. after a role/permission change). */
    SideNavInstance.prototype.setItems = function (items, footer) {
        var self = this;
        this.options.items = items || [];
        if (footer) this.options.footer = footer;
        this.nodes = buildTree(this.options.items, null, 0);
        this.footerNodes = buildTree(this.options.footer, null, 0);
        this.index = {};
        this.rowOf = {};
        walk(this.nodes.concat(this.footerNodes), function (n) { self.index[n.id] = n; });
        this._resolveActive();

        this.scroll.innerHTML = '';
        this.scroll.appendChild(this.highlight);
        this.scroll.appendChild(this._renderList(this.nodes, 0));

        if (this.footerEl) {
            var oldList = this.footerEl.querySelector('.sn-list');
            if (oldList) oldList.remove();
            if (this.footerNodes.length) {
                this.footerEl.insertBefore(this._renderList(this.footerNodes, 0), this.footerEl.firstChild);
            }
        }

        Object.keys(this.expanded).forEach(function (id) {
            if (self.expanded[id]) self._setExpanded(id, true, true);
        });
    };

    /** Update one item in place — badge counts, labels, disabled state. */
    SideNavInstance.prototype.updateItem = function (id, patch) {
        var node = this.index[id];
        var row = this.rowOf[id];
        if (!node || !row) return false;

        if (patch.label != null) {
            node.label = patch.label;
            var l = row.querySelector('.sn-label');
            if (l) l.textContent = patch.label;
        }
        if ('badge' in patch) {
            node.badge = patch.badge;
            var badge = row.querySelector('.sn-badge');
            var dot = row.querySelector('.sn-dot');
            var tone = patch.badgeTone || node.badgeTone;
            if (patch.badge == null || patch.badge === '') {
                if (badge) badge.remove();
                if (dot) dot.remove();
            } else {
                if (!badge) {
                    badge = el('span', 'sn-badge');
                    var chev = row.querySelector('.sn-chev');
                    row.insertBefore(badge, chev || null);
                }
                badge.textContent = patch.badge;
                if (tone) badge.setAttribute('data-tone', tone); else badge.removeAttribute('data-tone');
                if (!dot) {
                    dot = el('span', 'sn-dot');
                    row.appendChild(dot);
                }
                if (tone) dot.setAttribute('data-tone', tone); else dot.removeAttribute('data-tone');
            }
        }
        if ('disabled' in patch) {
            node.disabled = !!patch.disabled;
            if (node.disabled) row.setAttribute('aria-disabled', 'true');
            else row.removeAttribute('aria-disabled');
        }
        if (patch.href != null && row.tagName === 'A') {
            node.href = patch.href;
            row.setAttribute('href', patch.href);
        }
        return true;
    };

    /** Mark a page active by id, or re-derive it from the URL. */
    SideNavInstance.prototype.setActive = function (id) {
        var self = this;
        Object.keys(this.rowOf).forEach(function (key) {
            self.rowOf[key].removeAttribute('data-active');
            self.rowOf[key].removeAttribute('data-active-within');
            self.rowOf[key].removeAttribute('aria-current');
        });
        this.options.activeId = id || null;
        this._resolveActive();
        if (this.activeNode) {
            var row = this.rowOf[this.activeNode.id];
            if (row) {
                row.setAttribute('data-active', 'true');
                row.setAttribute('aria-current', 'page');
            }
            var p = this.activeNode.parent;
            while (p) {
                var prow = this.rowOf[p.id];
                if (prow) prow.setAttribute('data-active-within', 'true');
                if (this.options.autoOpenActive) this._setExpanded(p.id, true);
                p = p.parent;
            }
        }
        return this.activeNode;
    };

    SideNavInstance.prototype.refreshActive = function () {
        return this.setActive(this.options.activeId);
    };

    SideNavInstance.prototype.expand = function (id) { this._setExpanded(id, true); this._persist(); };
    SideNavInstance.prototype.collapse = function (id) { this._setExpanded(id, false); this._persist(); };

    SideNavInstance.prototype.destroy = function () {
        window.removeEventListener('resize', this._onResize);
        document.removeEventListener('keydown', this._onKey);
        if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
        if (this.flyout && this.flyout.parentNode) this.flyout.parentNode.removeChild(this.flyout);
        var i = instances.indexOf(this);
        if (i > -1) instances.splice(i, 1);
    };

    /* ======================================================================
       Module surface
       ====================================================================== */
    var SideNav = {
        /** Create a nav from a config object. Returns the instance. */
        create: function (options) {
            var inst = new SideNavInstance(options);
            instances.push(inst);
            return inst;
        },

        /**
         * Declarative boot. Put the config in a JSON script tag so page authors
         * never have to write JS:
         *
         *   <script type="application/json" data-side-nav>{ "items": [...] }</script>
         *
         * Then call SideNav.auto() — or just load this file with `data-auto`
         * on the script tag and it boots itself on DOMContentLoaded.
         */
        auto: function (selector) {
            var nodes = document.querySelectorAll(selector || 'script[type="application/json"][data-side-nav]');
            var made = [];
            Array.prototype.forEach.call(nodes, function (script) {
                try {
                    made.push(SideNav.create(JSON.parse(script.textContent)));
                } catch (e) {
                    if (window.console) console.error('[side-nav] invalid config JSON', e);
                }
            });
            return made;
        },

        /** Register extra icons: SideNav.registerIcons({ yard: 'M3 3…' }) */
        registerIcons: function (map) {
            for (var k in map) ICONS[k] = map[k];
            return ICONS;
        },

        icons: ICONS,
        instances: instances,
        get: function (i) { return instances[i || 0]; },
        version: '1.0.0'
    };

    // Self-boot when the script tag carries data-auto.
    (function () {
        var current = document.currentScript;
        if (!current || !current.hasAttribute('data-auto')) return;
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () { SideNav.auto(); });
        } else {
            SideNav.auto();
        }
    })();

    return SideNav;
});
