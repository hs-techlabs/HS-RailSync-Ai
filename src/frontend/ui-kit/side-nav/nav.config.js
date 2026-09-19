/* ==========================================================================
   UI-KIT · SIDE-NAV — SHARED NAVIGATION CONFIG
   --------------------------------------------------------------------------
   This is the file the team edits to add pages and subpages. Nothing else
   needs to change: every portal page loads side-nav.css + side-nav.js + this
   file, then calls `SideNav.create(NAV_PRESETS.<portal>)`.

   Adding a page      → append an item to the right preset's `items` array.
   Adding a subpage   → append to that item's `children` array.
   New portal/section → copy a preset block and give it its own accent.
   ========================================================================== */

(function (global) {
    'use strict';

    /* ---- Departmental accents, mirrored from style.css tokens ------------ */
    var ACCENT = {
        occ:  { accent: '#0f2b5c', accentInk: '#2563eb' },  /* Railway navy / control blue */
        tms:  { accent: '#1e40af', accentInk: '#1e40af' },  /* Civil track — steel blue    */
        tdms: { accent: '#b45309', accentInk: '#b45309' },  /* Traction OHE — amber        */
        smms: { accent: '#047857', accentInk: '#047857' }   /* Signal & Telecom — emerald  */
    };

    /* ---- Links shared by every portal ----------------------------------- */
    var CROSS_PORTAL = {
        id: 'portals',
        label: 'Other Portals',
        icon: 'layers',
        children: [
            { id: 'x-occ',  label: 'Central OCC Desk', href: '/',     icon: 'home' },
            { id: 'x-tms',  label: 'Track — TMS',      href: '/tms',  icon: 'wrench' },
            { id: 'x-tdms', label: 'Traction — TDMS',  href: '/tdms', icon: 'bolt' },
            { id: 'x-smms', label: 'Signal — SMMS',    href: '/smms', icon: 'signal' }
        ]
    };

    var SUPPORT = [
        { id: 'docs', label: 'Operating Manual', href: '/docs', icon: 'book' },
        { id: 'settings', label: 'Preferences', href: '/settings', icon: 'gear' }
    ];

    /* ======================================================================
       PRESETS — one per page family
       ====================================================================== */
    var NAV_PRESETS = {

        /* ---- Central OCC / Automatic Block Planning ---------------------- */
        occ: {
            side: 'left',
            align: 'stretch',
            mode: 'pinned',
            storageKey: null,
            accent: ACCENT.occ.accent,
            accentInk: ACCENT.occ.accentInk,
            brand: { label: 'Block Planning', sub: 'NDLS–CNB · 440 KM', crest: 'IR', href: '#home' },
            items: [
                { id: 'home', label: 'Control Desk', href: '#home', icon: 'home' },

                { type: 'section', label: 'Monitoring' },
                {
                    id: 'monitor', label: 'Current Monitor', icon: 'signal', defaultOpen: true,
                    children: [
                        { id: 'gantt', label: 'Block Gantt', href: '#gantt', icon: 'bars' },
                        { id: 'marey', label: 'Marey Diagram', href: '#marey', icon: 'chart' },
                        { id: 'map',   label: 'Corridor Map',   href: '#map',   icon: 'map' }
                    ]
                },

                { type: 'section', label: 'Intelligence' },
                {
                    id: 'resource', label: 'Resource & AI', icon: 'layers', defaultOpen: true,
                    children: [
                        { id: 'assets', label: 'Asset Health', href: '#assets', icon: 'shield' }
                    ]
                },
                { id: 'plans', label: 'Block Plans', href: '#plans', icon: 'calendar' },
                { id: 'memos', label: 'Sanction Memos', href: '#memos', icon: 'file' },

                { type: 'divider' },
                CROSS_PORTAL
            ],
            footer: SUPPORT
        },

        /* ---- Track Management System (Civil) ----------------------------- */
        tms: {
            side: 'left',
            align: 'center',
            mode: 'hover',
            storageKey: 'ir.nav.tms',
            accent: ACCENT.tms.accent,
            accentInk: ACCENT.tms.accentInk,
            brand: { label: 'Track Management', sub: 'IRCEP Civil · Sr. DEN', crest: 'TMS', href: '/tms' },
            items: [
                { id: 'tms-home', label: 'Requisition Desk', href: '/tms', icon: 'dashboard' },

                { type: 'section', label: 'Track' },
                {
                    id: 'tms-corridor', label: 'Corridor Track Map', icon: 'map', defaultOpen: true,
                    children: [
                        { id: 'tms-issues', label: 'Reported Issues', href: '/tms#issues', badge: '3', badgeTone: 'danger' },
                        { id: 'tms-blocks', label: 'Live Blocks',     href: '/tms#blocks' },
                        { id: 'tms-routine', label: 'Routine Dues',   href: '/tms#routine' }
                    ]
                },
                {
                    id: 'tms-machines', label: 'Track Machines', icon: 'wrench',
                    children: [
                        { id: 'tms-tamping',  label: 'Tamping Units',  href: '/tms#tamping' },
                        { id: 'tms-grinding', label: 'Rail Grinding',  href: '/tms#grinding' },
                        { id: 'tms-availability', label: 'Availability', href: '/tms#availability' }
                    ]
                },
                { id: 'tms-new', label: 'Raise Block Demand', href: '/tms#new-demand', icon: 'clipboard' },

                { type: 'divider' },
                CROSS_PORTAL
            ],
            footer: [{ id: 'tms-back', label: 'Central OCC Desk', href: '/', icon: 'back' }].concat(SUPPORT)
        },

        /* ---- Traction Distribution Management System --------------------- */
        tdms: {
            side: 'left',
            align: 'center',
            mode: 'hover',
            storageKey: 'ir.nav.tdms',
            accent: ACCENT.tdms.accent,
            accentInk: ACCENT.tdms.accentInk,
            brand: { label: 'Traction Distribution', sub: 'OHE · Sr. DEE (TRD)', crest: 'TD', href: '/tdms' },
            items: [
                { id: 'tdms-home', label: 'OHE Desk', href: '/tdms', icon: 'dashboard' },

                { type: 'section', label: 'Overhead Equipment' },
                {
                    id: 'tdms-ohe', label: 'OHE Sections', icon: 'bolt', defaultOpen: true,
                    children: [
                        { id: 'tdms-faults',  label: 'Fault Log',       href: '/tdms#faults', badge: '2', badgeTone: 'danger' },
                        { id: 'tdms-tower',   label: 'Tower Wagons',    href: '/tdms#tower' },
                        { id: 'tdms-neutral', label: 'Neutral Sections', href: '/tdms#neutral' }
                    ]
                },
                { id: 'tdms-power', label: 'Power Blocks', href: '/tdms#power', icon: 'power' },
                { id: 'tdms-new',   label: 'Raise Power Block', href: '/tdms#new-demand', icon: 'clipboard' },

                { type: 'divider' },
                CROSS_PORTAL
            ],
            footer: [{ id: 'tdms-back', label: 'Central OCC Desk', href: '/', icon: 'back' }].concat(SUPPORT)
        },

        /* ---- Signal Maintenance Management System ------------------------ */
        smms: {
            side: 'left',
            align: 'center',
            mode: 'hover',
            storageKey: 'ir.nav.smms',
            accent: ACCENT.smms.accent,
            accentInk: ACCENT.smms.accentInk,
            brand: { label: 'Signal Maintenance', sub: 'S&T · Sr. DSTE', crest: 'SM', href: '/smms' },
            items: [
                { id: 'smms-home', label: 'S&T Desk', href: '/smms', icon: 'dashboard' },

                { type: 'section', label: 'Signalling' },
                {
                    id: 'smms-assets', label: 'Signal Assets', icon: 'signal', defaultOpen: true,
                    children: [
                        { id: 'smms-points',    label: 'Point Machines', href: '/smms#points' },
                        { id: 'smms-circuits',  label: 'Track Circuits', href: '/smms#circuits' },
                        { id: 'smms-interlock', label: 'Interlocking',   href: '/smms#interlocking' }
                    ]
                },
                { id: 'smms-failures', label: 'Failure Reports', href: '/smms#failures', icon: 'alert', badge: '1', badgeTone: 'danger' },
                { id: 'smms-new',      label: 'Raise S&T Block', href: '/smms#new-demand', icon: 'clipboard' },

                { type: 'divider' },
                CROSS_PORTAL
            ],
            footer: [{ id: 'smms-back', label: 'Central OCC Desk', href: '/', icon: 'back' }].concat(SUPPORT)
        }
    };

    global.NAV_PRESETS = NAV_PRESETS;
    global.NAV_ACCENT = ACCENT;

})(window);
