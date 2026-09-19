/* ==========================================================================
   UI-KIT · ANIMATED-LIST — SHARED ROW PRESETS
   --------------------------------------------------------------------------
   This is the file the team edits to add row types. Nothing else needs to
   change: every portal page loads animated-list.css + animated-list.js +
   this file, then calls

       AnimatedList.create(LIST_PRESETS.eventFeed('#occ-event-feed'));

   Each preset is a function returning a ready-made options object for
   AnimatedList.create — target first, then any overrides you want merged on
   top. The presets are shaped around the payloads the API already serves:

       eventFeed     → /api/sim/events        (sim_events.json)
       demandQueue   → /api/demands/pending   (pending_demands.json)
       fieldReports  → /api/worker/requests   (worker_requests.json)
       notices       → anything ad-hoc: { id, title, message, severity }

   Adding a row type   → write a renderer, add a preset below.
   Tweaking one page   → pass overrides, don't fork the preset.
   ========================================================================== */

(function (global) {
    'use strict';

    /* ---- Departmental accents, mirrored from style.css tokens ------------ */
    var DEPT = {
        ENGINEERING_TRACK:            { cls: 'al-dept-track',  label: 'TRACK' },
        TRACTION_DISTRIBUTION_OHE:    { cls: 'al-dept-ohe',    label: 'OHE' },
        SIGNAL_AND_TELECOM:           { cls: 'al-dept-sig',    label: 'S&T' },
        BUNDLE:                       { cls: 'al-dept-bundle', label: 'BUNDLE' }
    };

    /* ---- Severity → chip + left-edge treatment --------------------------- */
    var SEVERITY = {
        critical: 'critical',
        error: 'critical',
        danger: 'critical',
        warning: 'warning',
        warn: 'warning',
        success: 'success',
        ok: 'success',
        info: 'info'
    };

    var PRIORITY_SEVERITY = {
        CRITICAL: 'critical',
        HIGH: 'warning',
        MEDIUM: 'info',
        LOW: 'muted'
    };

    /* ---- Event kinds the simulator emits, in plain control-room words ---- */
    var EVENT_KIND = {
        REPORT_SUBMITTED: 'Field report',
        DEMAND_RAISED: 'Demand raised',
        DEMAND_APPROVED: 'Approved',
        DEMAND_REJECTED: 'Rejected',
        BLOCK_SANCTIONED: 'Sanctioned',
        BLOCK_STARTED: 'Block live',
        BLOCK_COMPLETED: 'Completed',
        BLOCK_CANCELLED: 'Cancelled',
        DISRUPTION: 'Disruption',
        OPTIMISER_RUN: 'Optimiser'
    };

    /* ======================================================================
       Helpers
       ====================================================================== */

    /* Every renderer builds an HTML string, so everything interpolated from
       an API payload goes through here first. */
    function esc(v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
        });
    }

    function clock(value) {
        if (!value) return '';
        var d = value instanceof Date ? value : new Date(value);
        if (isNaN(d.getTime())) return esc(value);
        return String(d.getHours()).padStart(2, '0') + ':' +
               String(d.getMinutes()).padStart(2, '0');
    }

    function duration(min) {
        if (min == null) return '';
        var h = Math.floor(min / 60);
        var m = Math.round(min % 60);
        return h ? h + 'h ' + String(m).padStart(2, '0') + 'm' : m + 'm';
    }

    function chainage(a, b) {
        if (a == null) return '';
        if (b == null || b === a) return 'KM ' + Number(a).toFixed(1);
        return 'KM ' + Number(a).toFixed(1) + '–' + Number(b).toFixed(1);
    }

    function dept(code) {
        return DEPT[code] || { cls: '', label: code ? String(code).replace(/_/g, ' ') : '' };
    }

    function severityOf(value) {
        return SEVERITY[String(value || '').toLowerCase()] || 'muted';
    }

    function chip(text, tone) {
        if (!text) return '';
        return '<span class="al-chip' + (tone ? ' is-' + tone : '') + '">' + esc(text) + '</span>';
    }

    function refChip(text) {
        if (!text) return '';
        return '<span class="al-chip is-ref">' + esc(text) + '</span>';
    }

    /** Shallow merge, later sources win. Lets a page override any preset field. */
    function merge() {
        var out = {};
        for (var i = 0; i < arguments.length; i++) {
            var src = arguments[i];
            if (!src) continue;
            for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k)) out[k] = src[k];
        }
        return out;
    }

    function row(parts) {
        var cls = ['al-row'];
        if (parts.severity) cls.push('al-sev-' + parts.severity);
        if (parts.deptCls) cls.push(parts.deptCls);
        if (parts.clickable) cls.push('is-clickable');

        return '<div class="' + cls.join(' ') + '">' +
            '<div class="al-row-head">' +
                '<span class="al-row-dot' + (parts.live ? ' is-live' : '') + '"></span>' +
                '<span class="al-row-title">' + esc(parts.title) + '</span>' +
                (parts.time ? '<span class="al-row-time">' + esc(parts.time) + '</span>' : '') +
            '</div>' +
            (parts.body
                ? '<div class="al-row-body is-clamped">' + esc(parts.body) + '</div>'
                : '') +
            (parts.meta && parts.meta.length
                ? '<div class="al-row-meta">' + parts.meta.join('') + '</div>'
                : '') +
        '</div>';
    }

    /* ======================================================================
       RENDERERS — one per payload shape
       ====================================================================== */

    /** sim_events.json — the live control-room ticker. */
    function renderEvent(ev) {
        var d = dept(ev.department);
        return row({
            severity: severityOf(ev.severity),
            deptCls: d.cls,
            live: ev.kind === 'BLOCK_STARTED',
            title: ev.title || EVENT_KIND[ev.kind] || ev.kind || 'Event',
            time: clock(ev.sim_time || ev.timestamp),
            body: ev.message,
            meta: [
                chip(EVENT_KIND[ev.kind] || ev.kind, severityOf(ev.severity)),
                chip(d.label),
                refChip(ev.ref_id)
            ]
        });
    }

    /** pending_demands.json — the INCOMING queue on the OCC desk. */
    function renderDemand(dm) {
        var d = dept(dm.department);
        var section = dm.section_from && dm.section_to
            ? dm.section_from + ' – ' + dm.section_to
            : (dm.section_label || '');
        return row({
            severity: PRIORITY_SEVERITY[dm.priority] || 'muted',
            deptCls: d.cls,
            clickable: true,
            title: dm.defect_category || dm.description || dm.demand_id,
            time: clock(dm.raised_at),
            body: dm.description,
            meta: [
                chip(dm.priority, PRIORITY_SEVERITY[dm.priority]),
                chip(section),
                chip(chainage(dm.km_start, dm.km_end)),
                chip(dm.line ? dm.line + ' line' : ''),
                chip(duration(dm.duration_requested_min)),
                dm.power_block_required ? chip('Power block', 'warning') : '',
                dm.disconnection_required ? chip('Disconnection', 'warning') : '',
                refChip(dm.demand_id)
            ]
        });
    }

    /** worker_requests.json — what the field has just sent in. */
    function renderFieldReport(rq) {
        var d = dept(rq.department);
        return row({
            severity: PRIORITY_SEVERITY[rq.priority] || 'muted',
            deptCls: d.cls,
            clickable: true,
            title: rq.defect_category || rq.request_id,
            time: clock(rq.raised_at || rq.reported_at),
            body: rq.description,
            meta: [
                chip(rq.priority, PRIORITY_SEVERITY[rq.priority]),
                chip(rq.section_label || ''),
                chip(chainage(rq.km_start, rq.km_end)),
                chip(rq.gang_crew || ''),
                refChip(rq.request_id)
            ]
        });
    }

    /** Anything ad-hoc: toasts, banners, optimiser chatter. */
    function renderNotice(n) {
        var tone = severityOf(n.severity);
        return row({
            severity: tone,
            title: n.title || n.message,
            time: clock(n.timestamp || n.at),
            body: n.title ? n.message : '',
            meta: [chip(n.tag || '', tone), refChip(n.ref_id)]
        });
    }

    /* ======================================================================
       PRESETS — one per page slot
       ====================================================================== */
    var LIST_PRESETS = {

        /* ---- Central OCC · live event ticker ----------------------------- */
        eventFeed: function (target, overrides) {
            return merge({
                target: target,
                key: 'event_id',
                renderItem: renderEvent,
                maxVisible: 8,
                gap: 8,
                animation: 'scale',
                className: 'al-compact',
                pauseOnHover: true,
                empty: 'No events yet — the corridor is quiet.'
            }, overrides);
        },

        /* ---- Central OCC · INCOMING requisition queue -------------------- */
        demandQueue: function (target, overrides) {
            return merge({
                target: target,
                key: 'demand_id',
                renderItem: renderDemand,
                /* The queue re-renders wholesale on every poll, so rows are
                   compared by content, not identity — otherwise every poll
                   would repaint eight rows that did not change. */
                signature: function (dm) {
                    return dm.status + '|' + dm.priority + '|' + dm.duration_requested_min;
                },
                maxVisible: 12,
                gap: 10,
                animation: 'slide',
                empty: 'Queue clear — no unbundled requisitions.'
            }, overrides);
        },

        /* ---- TMS / TDMS / SMMS · inbound field reports ------------------- */
        fieldReports: function (target, overrides) {
            return merge({
                target: target,
                key: 'request_id',
                renderItem: renderFieldReport,
                signature: function (rq) { return rq.status + '|' + rq.priority; },
                maxVisible: 10,
                gap: 10,
                animation: 'slide',
                empty: 'No open field reports.'
            }, overrides);
        },

        /* ---- Anywhere · dense side-panel notices ------------------------- */
        notices: function (target, overrides) {
            return merge({
                target: target,
                key: 'id',
                renderItem: renderNotice,
                maxVisible: 6,
                animation: 'bounce',
                className: 'al-bare',
                empty: ''
            }, overrides);
        }
    };

    /* Exposed so a page can build one-off rows in the same visual language
       without duplicating the markup. */
    LIST_PRESETS.render = {
        event: renderEvent,
        demand: renderDemand,
        fieldReport: renderFieldReport,
        notice: renderNotice,
        row: row,
        chip: chip,
        refChip: refChip,
        esc: esc,
        clock: clock,
        duration: duration,
        chainage: chainage
    };

    global.LIST_PRESETS = LIST_PRESETS;
    global.LIST_DEPT = DEPT;

})(window);
