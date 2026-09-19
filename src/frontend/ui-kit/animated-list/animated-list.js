/* ==========================================================================
   UI-KIT · ANIMATED LIST  (animated-list)
   Vanilla JS. No build step, no dependencies. UMD-ish global: window.AnimatedList
   --------------------------------------------------------------------------
   A real-time push feed: new items animate in from the top with spring
   physics, removed rows fade out *without* holding their slot open, and
   every surviving row glides to its new position instead of jumping.

   Quick start:

     <link rel="stylesheet" href="/static/ui-kit/animated-list/animated-list.css">
     <script src="/static/ui-kit/animated-list/animated-list.js"></script>
     <script>
       var feed = AnimatedList.create({
         target: '#event-feed',
         renderItem: function (ev) {
           return '<div class="al-row">' + ev.message + '</div>';
         }
       });
       feed.prepend({ id: 'EVT-1', message: 'Block sanctioned at KM 312' });
     </script>

   Full docs in animated-list.md
   ========================================================================== */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.AnimatedList = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var instances = [];
    var uid = 0;

    /* ======================================================================
       Motion primitives

       The React reference leans on framer's spring (stiffness 350, damping
       28). We have no animation library here, so we integrate the same
       spring once, sample it, and hand the samples to the Web Animations
       API as a linear() easing — same curve, zero dependencies. Browsers
       without linear() fall back to a bezier close enough that nobody in
       the control room will spot the difference.
       ====================================================================== */

    var SUPPORTS_LINEAR = (function () {
        try {
            return typeof CSS !== 'undefined' && !!CSS.supports &&
                CSS.supports('animation-timing-function', 'linear(0, 0.5, 1)');
        } catch (e) { return false; }
    })();

    var SUPPORTS_WAAPI = typeof Element !== 'undefined' &&
        typeof Element.prototype.animate === 'function';

    var springCache = {};

    /**
     * Integrate a damped harmonic oscillator from 0 to 1 and sample it.
     * @returns {{easing: string, duration: number}} duration in ms.
     */
    function spring(stiffness, damping, mass) {
        var cacheKey = stiffness + ':' + damping + ':' + mass;
        if (springCache[cacheKey]) return springCache[cacheKey];

        var dt = 1 / 240;
        var x = 0, v = 0, t = 0;
        var settled = 0;
        var trace = [];

        /* Capped at 4s so a pathological config can never hang the loop. */
        while (t < 4) {
            var a = (-stiffness * (x - 1) - damping * v) / mass;
            v += a * dt;
            x += v * dt;
            t += dt;
            trace.push(x);
            if (Math.abs(1 - x) < 0.0015 && Math.abs(v) < 0.0015) {
                settled += dt;
                if (settled > 0.02) break;
            } else {
                settled = 0;
            }
        }

        var duration = Math.round(t * 1000);
        var out;
        if (SUPPORTS_LINEAR && trace.length > 1) {
            /* 42 samples keeps the easing string short and the curve honest. */
            var pts = [];
            for (var i = 0; i <= 42; i++) {
                var at = Math.round((i / 42) * (trace.length - 1));
                pts.push(Math.round(trace[at] * 10000) / 10000);
            }
            pts[0] = 0;
            pts[pts.length - 1] = 1;
            out = { easing: 'linear(' + pts.join(',') + ')', duration: duration };
        } else {
            out = { easing: 'cubic-bezier(0.22, 1, 0.36, 1)', duration: Math.round(duration * 0.8) };
        }
        springCache[cacheKey] = out;
        return out;
    }

    var EXIT_EASE = 'cubic-bezier(0.4, 0, 1, 1)';

    /* ======================================================================
       Enter / exit variants — mirrors the reference component 1:1.
       ====================================================================== */
    var VARIANTS = {
        slide: {
            initial: { opacity: 0, y: -30, scale: 1 },
            animate: { opacity: 1, y: 0, scale: 1 },
            exit: { opacity: 0, y: -20, scale: 1 }
        },
        fade: {
            initial: { opacity: 0, y: 0, scale: 1 },
            animate: { opacity: 1, y: 0, scale: 1 },
            exit: { opacity: 0, y: 0, scale: 1 }
        },
        bounce: {
            initial: { opacity: 0, y: -20, scale: 0.8 },
            animate: { opacity: 1, y: 0, scale: 1 },
            exit: { opacity: 0, y: 0, scale: 0.8 }
        },
        scale: {
            initial: { opacity: 0, y: -20, scale: 0.95 },
            animate: { opacity: 1, y: 0, scale: 1 },
            exit: { opacity: 0, y: 0, scale: 0.9 }
        },
        none: {
            initial: { opacity: 1, y: 0, scale: 1 },
            animate: { opacity: 1, y: 0, scale: 1 },
            exit: { opacity: 0, y: 0, scale: 1 }
        }
    };

    function variantsFor(name, newest) {
        var v = VARIANTS[name] || VARIANTS.scale;
        if (newest !== 'bottom') return v;
        /* Appending at the bottom: rows should rise into place, not drop in. */
        return {
            initial: { opacity: v.initial.opacity, y: -v.initial.y, scale: v.initial.scale },
            animate: v.animate,
            exit: { opacity: v.exit.opacity, y: -v.exit.y, scale: v.exit.scale }
        };
    }

    function frame(t) {
        return {
            opacity: t.opacity,
            transform: 'translate3d(0, ' + t.y + 'px, 0) scale(' + t.scale + ')'
        };
    }

    /* ======================================================================
       Small DOM helpers
       ====================================================================== */
    function el(tag, cls) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        return node;
    }

    function resolveTarget(target) {
        if (!target) return null;
        if (typeof target === 'string') return document.querySelector(target);
        if (target.nodeType === 1) return target;
        return null;
    }

    /** Accepts an element, an HTML string, or anything stringifiable. */
    function fill(host, content) {
        if (content == null) { host.textContent = ''; return; }
        if (content.nodeType) { host.textContent = ''; host.appendChild(content); return; }
        host.innerHTML = String(content);
    }

    function prefersReducedMotion() {
        try {
            return !!(window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        } catch (e) { return false; }
    }

    function keyOf(item, key, index) {
        if (typeof key === 'function') return String(key(item, index));
        var k = item != null ? item[key] : undefined;
        return k == null ? '@' + index : String(k);
    }

    function closestItem(node, root) {
        while (node && node !== root) {
            if (node.nodeType === 1 && node.classList.contains('al-item')) return node;
            node = node.parentNode;
        }
        return null;
    }

    /* ======================================================================
       AnimatedList instance
       ====================================================================== */
    function List(options) {
        var o = options || {};

        this.id = 'al-' + (++uid);
        this.root = resolveTarget(o.target);
        if (!this.root) throw new Error('AnimatedList: `target` did not resolve to an element.');

        this.opts = {
            key: o.key || 'id',
            renderItem: o.renderItem || function (item) { return String(item); },
            updateItem: o.updateItem || null,
            signature: o.signature || null,
            maxVisible: o.maxVisible == null ? 8 : o.maxVisible,
            gap: o.gap == null ? 12 : o.gap,
            animation: o.animation || 'scale',
            /** 'top' = newest first: index 0 renders at the top. */
            newest: o.newest === 'bottom' ? 'bottom' : 'top',
            className: o.className || '',
            stiffness: o.stiffness == null ? 350 : o.stiffness,
            damping: o.damping == null ? 28 : o.damping,
            mass: o.mass == null ? 1 : o.mass,
            exitDuration: o.exitDuration == null ? 150 : o.exitDuration,
            live: o.live === undefined ? 'polite' : o.live,
            empty: o.empty === undefined ? '' : o.empty,
            pauseOnHover: !!o.pauseOnHover,
            reducedMotion: o.reducedMotion || 'auto',
            onItemClick: o.onItemClick || null,
            onEnter: o.onEnter || null,
            onExit: o.onExit || null
        };

        this.items = [];
        this.entries = {};     /* key -> entry record */
        this.order = [];       /* keys, in render order */
        this.pending = null;   /* items held back while hovered */
        this.paused = false;
        this.destroyed = false;

        this._build();
        this.setItems(o.items || []);

        instances.push(this);
    }

    List.prototype._build = function () {
        var self = this;
        var o = this.opts;

        this.el = el('div', 'al-root' + (o.className ? ' ' + o.className : ''));
        this.el.id = this.id;
        this.el.style.setProperty('--al-gap', o.gap + 'px');
        this.el.setAttribute('data-newest', o.newest);

        this.listEl = el('div', 'al-list');
        this.listEl.setAttribute('role', 'list');
        if (o.live) {
            this.listEl.setAttribute('aria-live', o.live);
            this.listEl.setAttribute('aria-relevant', 'additions');
        }

        this.emptyEl = el('div', 'al-empty');
        fill(this.emptyEl, o.empty);
        this.emptyEl.hidden = true;

        this.el.appendChild(this.listEl);
        this.el.appendChild(this.emptyEl);

        if (o.pauseOnHover) {
            this.resumeEl = el('button', 'al-resume');
            this.resumeEl.type = 'button';
            this.resumeEl.hidden = true;
            this.resumeEl.addEventListener('click', function () { self.resume(); });
            this.el.appendChild(this.resumeEl);

            this._onPointerEnter = function () { self.paused = true; };
            this._onPointerLeave = function () { self.resume(); };
            this.el.addEventListener('pointerenter', this._onPointerEnter);
            this.el.addEventListener('pointerleave', this._onPointerLeave);
        }

        if (o.onItemClick) {
            this._onClick = function (evt) {
                var node = closestItem(evt.target, self.listEl);
                if (!node) return;
                var entry = self.entries[node.getAttribute('data-al-key')];
                if (entry && !entry.exiting) o.onItemClick(entry.item, entry.index, evt);
            };
            this.listEl.addEventListener('click', this._onClick);
        }

        this.root.appendChild(this.el);
    };

    List.prototype._still = function () {
        return this.opts.reducedMotion === 'always' ||
            !SUPPORTS_WAAPI ||
            (this.opts.reducedMotion === 'auto' && prefersReducedMotion());
    };

    /** The window of items actually rendered. */
    List.prototype._visible = function (items) {
        var max = this.opts.maxVisible;
        if (max == null || max <= 0 || items.length <= max) return items.slice();
        return this.opts.newest === 'bottom' ? items.slice(items.length - max) : items.slice(0, max);
    };

    /* ----------------------------------------------------------------------
       The reconcile — one FLIP pass per update.

       Order matters: departing rows are lifted out of flow *before* the new
       layout is measured, which is what reproduces the reference's
       mode="popLayout" — a removed row never holds its slot open while it
       fades, so the rows below start closing the gap immediately.
       ---------------------------------------------------------------------- */
    List.prototype.setItems = function (items) {
        if (this.destroyed) return this;
        items = items || [];

        if (this.paused) {
            this.pending = items.slice();
            this._badge();
            return this;
        }

        this.items = items.slice();
        var o = this.opts;
        var visible = this._visible(this.items);
        var still = this._still();

        var nextOrder = [];
        var nextKeys = {};
        var i, k, entry;

        for (i = 0; i < visible.length; i++) {
            k = keyOf(visible[i], o.key, i);
            if (nextKeys[k]) continue;            /* duplicate id — first one wins */
            nextKeys[k] = true;
            nextOrder.push(k);
        }

        var containerRect = this.listEl.getBoundingClientRect();

        /* --- 1. First: where every live row sits right now ----------------- */
        var first = {};
        for (i = 0; i < this.order.length; i++) {
            entry = this.entries[this.order[i]];
            if (entry && !entry.exiting) first[this.order[i]] = entry.node.getBoundingClientRect();
        }

        /* --- 2. Lift departing rows out of flow and fade them --------------- */
        for (i = 0; i < this.order.length; i++) {
            k = this.order[i];
            entry = this.entries[k];
            if (!entry || entry.exiting || nextKeys[k]) continue;
            this._exit(entry, first[k], containerRect, still);
        }

        /* --- 3. Create, refresh and reorder --------------------------------- */
        var entering = [];
        for (i = 0; i < nextOrder.length; i++) {
            k = nextOrder[i];
            entry = this.entries[k];
            if (entry && entry.exiting) {
                /* Re-added mid-exit: cancel the fade and reclaim the node. */
                this._reclaim(entry);
            }
            if (!entry) {
                entry = this._create(k, visible[i], i, still);
                entering.push(entry);
            } else {
                this._refresh(entry, visible[i], i);
            }
            entry.index = i;
        }

        var anchor = null;
        for (i = nextOrder.length - 1; i >= 0; i--) {
            var node = this.entries[nextOrder[i]].node;
            if (node.parentNode !== this.listEl || node.nextSibling !== anchor) {
                this.listEl.insertBefore(node, anchor);
            }
            anchor = node;
        }

        this.order = nextOrder;

        /* --- 4. Last + Invert + Play for everything that survived ----------- */
        if (!still) {
            var moves = [];
            for (i = 0; i < nextOrder.length; i++) {
                k = nextOrder[i];
                if (!first[k]) continue;          /* brand new; it gets an enter instead */
                entry = this.entries[k];
                if (entry.layoutAnim) { entry.layoutAnim.cancel(); entry.layoutAnim = null; }
                entry.node.style.transform = '';
                var last = entry.node.getBoundingClientRect();
                var dy = first[k].top - last.top;
                var dx = first[k].left - last.left;
                if (Math.abs(dy) > 0.5 || Math.abs(dx) > 0.5) {
                    moves.push({ entry: entry, dx: dx, dy: dy });
                }
            }
            for (i = 0; i < moves.length; i++) this._flip(moves[i]);
            for (i = 0; i < entering.length; i++) this._play(entering[i]);
        }

        this._syncEmpty();
        return this;
    };

    List.prototype._create = function (key, item, index, still) {
        var o = this.opts;
        var node = el('div', 'al-item');
        node.setAttribute('data-al-key', key);
        node.setAttribute('role', 'listitem');

        /* Two layers on purpose: the outer box carries the FLIP transform for
           position changes, the inner one carries the enter/exit transform.
           Keeping them apart is what lets a row be re-sorted mid-entrance
           without the two transforms fighting over the same property. */
        var inner = el('div', 'al-item-inner');
        fill(inner, o.renderItem(item, index));
        node.appendChild(inner);

        /* Paint the entry frame before the browser ever shows the row. */
        if (!still) {
            var f = frame(variantsFor(o.animation, o.newest).initial);
            inner.style.opacity = f.opacity;
            inner.style.transform = f.transform;
        }

        var entry = {
            key: key, node: node, inner: inner, item: item, index: index,
            exiting: false, sig: this._sig(item),
            enterAnim: null, exitAnim: null, layoutAnim: null
        };
        this.entries[key] = entry;
        return entry;
    };

    List.prototype._sig = function (item) {
        return this.opts.signature ? this.opts.signature(item) : null;
    };

    /** Same key, possibly new data — keep the node, refresh the content. */
    List.prototype._refresh = function (entry, item, index) {
        var o = this.opts;
        var changed = entry.item !== item;
        if (changed && o.signature) {
            var sig = this._sig(item);
            changed = sig !== entry.sig;
            entry.sig = sig;
        }
        entry.item = item;
        if (!changed) return;
        if (o.updateItem) o.updateItem(entry.inner, item, index);
        else fill(entry.inner, o.renderItem(item, index));
    };

    List.prototype._play = function (entry) {
        var o = this.opts;
        var v = variantsFor(o.animation, o.newest);
        var s = spring(o.stiffness, o.damping, o.mass);
        var inner = entry.inner;

        if (entry.enterAnim) entry.enterAnim.cancel();
        entry.enterAnim = inner.animate([frame(v.initial), frame(v.animate)], {
            duration: s.duration, easing: s.easing, fill: 'both'
        });
        entry.enterAnim.onfinish = function () {
            inner.style.opacity = '';
            inner.style.transform = '';
            try { entry.enterAnim.cancel(); } catch (e) { /* already gone */ }
            entry.enterAnim = null;
        };
        if (o.onEnter) o.onEnter(entry.item, entry.index, entry.node);
    };

    List.prototype._flip = function (move) {
        var o = this.opts;
        var s = spring(o.stiffness, o.damping, o.mass);
        var entry = move.entry;
        var node = entry.node;
        var from = 'translate3d(' + move.dx + 'px, ' + move.dy + 'px, 0)';

        entry.layoutAnim = node.animate(
            [{ transform: from }, { transform: 'translate3d(0, 0, 0)' }],
            { duration: s.duration, easing: s.easing, fill: 'both' }
        );
        entry.layoutAnim.onfinish = function () {
            node.style.transform = '';
            try { entry.layoutAnim.cancel(); } catch (e) { /* already gone */ }
            entry.layoutAnim = null;
        };
    };

    List.prototype._exit = function (entry, rect, containerRect, still) {
        var self = this;
        var o = this.opts;
        entry.exiting = true;
        entry.node.setAttribute('aria-hidden', 'true');

        if (o.onExit) o.onExit(entry.item, entry.index, entry.node);

        if (still || !rect) return this._drop(entry);

        /* Freeze the row where it sits so the rows below can close the gap. */
        var node = entry.node;
        if (entry.layoutAnim) { entry.layoutAnim.cancel(); entry.layoutAnim = null; }
        node.classList.add('is-exiting');
        node.style.transform = '';
        node.style.width = rect.width + 'px';
        node.style.height = rect.height + 'px';
        node.style.top = (rect.top - containerRect.top) + 'px';
        node.style.left = (rect.left - containerRect.left) + 'px';

        var v = variantsFor(o.animation, o.newest);
        if (entry.enterAnim) { entry.enterAnim.cancel(); entry.enterAnim = null; }
        entry.exitAnim = entry.inner.animate([frame(v.animate), frame(v.exit)], {
            duration: o.exitDuration, easing: EXIT_EASE, fill: 'both'
        });
        entry.exitAnim.onfinish = function () { self._drop(entry); };
    };

    /** An exiting row came back before its fade finished. */
    List.prototype._reclaim = function (entry) {
        if (entry.exitAnim) { entry.exitAnim.cancel(); entry.exitAnim = null; }
        entry.exiting = false;
        entry.node.classList.remove('is-exiting');
        entry.node.removeAttribute('aria-hidden');
        entry.node.style.width = '';
        entry.node.style.height = '';
        entry.node.style.top = '';
        entry.node.style.left = '';
        entry.inner.style.opacity = '';
        entry.inner.style.transform = '';
    };

    List.prototype._drop = function (entry) {
        if (entry.exitAnim) { try { entry.exitAnim.cancel(); } catch (e) { /* already gone */ } }
        if (entry.node.parentNode) entry.node.parentNode.removeChild(entry.node);
        if (this.entries[entry.key] === entry) delete this.entries[entry.key];
    };

    List.prototype._syncEmpty = function () {
        if (!this.emptyEl) return;
        var has = this.order.length > 0;
        this.emptyEl.hidden = has || !this.opts.empty;
        this.el.classList.toggle('is-empty', !has);
    };

    List.prototype._badge = function () {
        if (!this.resumeEl) return;
        var held = this.pending ? Math.max(0, this.pending.length - this.items.length) : 0;
        if (!this.paused || held <= 0) { this.resumeEl.hidden = true; return; }
        this.resumeEl.hidden = false;
        this.resumeEl.textContent = held + (held === 1 ? ' new item' : ' new items');
    };

    /* ======================================================================
       Public API
       ====================================================================== */

    /** Add to the newest end — the top, unless newest: 'bottom'. */
    List.prototype.prepend = function (item) {
        var base = this.pending || this.items;
        return this.setItems(
            this.opts.newest === 'bottom' ? base.concat([item]) : [item].concat(base)
        );
    };

    /** Add to the oldest end. */
    List.prototype.append = function (item) {
        var base = this.pending || this.items;
        return this.setItems(
            this.opts.newest === 'bottom' ? [item].concat(base) : base.concat([item])
        );
    };

    /** Alias — reads better on a live feed. */
    List.prototype.push = function (item) { return this.prepend(item); };

    List.prototype.remove = function (key) {
        var o = this.opts;
        var target = String(key);
        var base = this.pending || this.items;
        return this.setItems(base.filter(function (item, i) {
            return keyOf(item, o.key, i) !== target;
        }));
    };

    /** Shallow-merge a patch into one item and re-render just that row. */
    List.prototype.update = function (key, patch) {
        var o = this.opts;
        var target = String(key);
        var base = this.pending || this.items;
        return this.setItems(base.map(function (item, i) {
            if (keyOf(item, o.key, i) !== target) return item;
            var next = {}, p;
            for (p in item) if (Object.prototype.hasOwnProperty.call(item, p)) next[p] = item[p];
            for (p in patch) if (Object.prototype.hasOwnProperty.call(patch, p)) next[p] = patch[p];
            return next;
        }));
    };

    List.prototype.getItems = function () { return this.items.slice(); };

    List.prototype.clear = function () { return this.setItems([]); };

    /** Hold incoming updates. Used by pauseOnHover, also callable directly. */
    List.prototype.pause = function () { this.paused = true; return this; };

    List.prototype.resume = function () {
        this.paused = false;
        if (this.resumeEl) this.resumeEl.hidden = true;
        if (this.pending) {
            var next = this.pending;
            this.pending = null;
            this.setItems(next);
        }
        return this;
    };

    /** Re-render every row in place — after a clock tick or a format change. */
    List.prototype.refresh = function () {
        for (var i = 0; i < this.order.length; i++) {
            var entry = this.entries[this.order[i]];
            if (!entry || entry.exiting) continue;
            if (this.opts.updateItem) this.opts.updateItem(entry.inner, entry.item, entry.index);
            else fill(entry.inner, this.opts.renderItem(entry.item, entry.index));
        }
        return this;
    };

    List.prototype.setOption = function (name, value) {
        this.opts[name] = value;
        if (name === 'gap') this.el.style.setProperty('--al-gap', value + 'px');
        if (name === 'empty') { fill(this.emptyEl, value); this._syncEmpty(); }
        if (name === 'newest') this.el.setAttribute('data-newest', value);
        if (name === 'maxVisible' || name === 'newest') this.setItems(this.items);
        if (name === 'renderItem' || name === 'updateItem') this.refresh();
        return this;
    };

    List.prototype.destroy = function () {
        if (this.destroyed) return;
        this.destroyed = true;
        for (var k in this.entries) {
            if (!Object.prototype.hasOwnProperty.call(this.entries, k)) continue;
            var e = this.entries[k];
            if (e.enterAnim) e.enterAnim.cancel();
            if (e.exitAnim) e.exitAnim.cancel();
            if (e.layoutAnim) e.layoutAnim.cancel();
        }
        if (this._onPointerEnter) this.el.removeEventListener('pointerenter', this._onPointerEnter);
        if (this._onPointerLeave) this.el.removeEventListener('pointerleave', this._onPointerLeave);
        if (this._onClick) this.listEl.removeEventListener('click', this._onClick);
        if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
        this.entries = {};
        this.order = [];
        var i = instances.indexOf(this);
        if (i > -1) instances.splice(i, 1);
    };

    /* ======================================================================
       Module surface
       ====================================================================== */
    return {
        create: function (options) { return new List(options); },
        instances: instances,
        get: function (id) {
            for (var i = 0; i < instances.length; i++) {
                if (instances[i].id === id) return instances[i];
            }
            return null;
        },
        destroyAll: function () {
            instances.slice().forEach(function (l) { l.destroy(); });
        },
        variants: VARIANTS,
        version: '1.0.0'
    };
});
